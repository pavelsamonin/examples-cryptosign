// server.js

// BASE SETUP
// =============================================================================

var express = require('express');        
var app = express();                 
var bodyParser = require('body-parser');
var async = require('async');

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

var port = process.env.PORT || 8080;        // set our port

var exec = require('child_process').execFile;
var fs = require('fs');


app.post('/sign', function (rq, rs) {

    var data = rq.body;
    console.log(data.id);
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    var querystring = require('querystring');
    var http = require('http');
    var request = require('request');
    var sync_request = require('sync-request');
    var https = require('https');
    var base64 = require('base-64');
    var needle = require('needle');

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    var myAsync = async.auto({
        get_auth: function (callback) {
            request.post(
                {
                    url: 'https://site.com.ua/api/login',
                    json: {
                        login: 'login',
                        password: 'password'
                    }
                },
                function (err, res, body) {
                    if (err) {
                        console.log('error doAuth');
                        callback(err, false);
                    }
                    if (res.statusCode == 200) {
                        console.log('200 doAuth');
                        callback(null, body.sessionId);
                    }
                }
            );
        },
        get_pdf: function (callback) {
            request.get({
                    url: 'https://generatepdfsite.ua/get_pdf/' + data.id,
                }, function (err, res) {
                    if (err) {
                        console.log('error get_pdf');
                        callback(err, false);
                    }
                    if (res.statusCode == 200) {
                        console.log('200 get_pdf');
                        var array = {
                            id: data.id,
                            body: res.body
                        };
                        callback(null, array);
                    }
                }
            );
        },
        do_upload: ['get_auth', 'get_pdf', function (data, callback) {
            var base = new Buffer(data.get_pdf.body, 'base64');

            request.post(
                {
                    headers: {
                        'Accept':'*/*',
                        'Cache-Control': 'no-cache',
                        'Content-Type': 'application/pdf',
                        'sessionid': data.get_auth,
                        'filename': data.get_pdf.id + '.pdf'
                    },
                    url: 'https://site.com.ua/upload',
                    body: base,
                },
                function (err, res, body) {
                    if (err) {
                        console.log('error doUpload');
                        callback(err, false);
                    }
                    if (res.statusCode == 200) {
                        console.log('200 doUpload');
                        var obj = JSON.parse(body);
                        var array = {
                            id: obj.id,
                            hash: obj.hash,
                            name: obj.name
                        };
                        callback(null, array);
                    }
                }
            );
        }],
        get_sign: ['do_upload', function (upload_data, callback) {
            var data = {                           
                file: 'file.jks',
                password: 'pass',
                alias: 'alias',
                aliaspassword: '',
                filehash: upload_data.do_upload.hash
            };
            var template = '{"function":"openSession","params":{"sessionTimeDuration":900},"sessionId":""}\n' +
                '{"function":"selectFileStorage","params":{"filePath":"' + data.file + '","password":"' + data.password + '"},"lag":false,"sessionId":""}\n' +
                '{"function":"selectKey","params":{"alias":"' + data.alias + '","password":"' + data.aliaspassword + '"},"lag":false,"sessionId":""}\n' +
                '{"function":"CMSSignHash","params":{"hashData":"' + data.filehash + '","timeStamp":"http://acsk.privatbank.ua/services/tsp/","includeCertificate":true,"TSPcertReq":true},"lag":false,"sessionId":""}\n' +
                '{"function":"closeSession","sessionId":""}';
            fs.writeFile("template_node.dat", template, function (err) {
                if (err) {
                    callback(err, false);
                }
            });

            exec('run_sign_node.bat', function (err, data) {
                var result = false;
                try {
                    var d = (data.split('{"sign": "')[1]);
                    var dd = (d.split('"}'))[0];
                    result = true;
                } catch (err) {
                    callback(err, false);
                }
                var j = {
                    'result': result
                };
                if (result)
                    j.sign = dd;
                callback(null, j);

            });
        }],
        sign_it: ['get_auth', 'get_sign', 'do_upload', function (data, callback) {
            request.post(
                {
                    headers: {
                        'Content-Type': 'application/pdf',
                        'sessionid': data.get_auth
                    },
                    url: 'https://site.com.ua/api/sign/' + data.do_upload.id,
                    body: data.get_sign.sign,
                },
                function (err, res, body) {
                    if (err) {
                        console.log('error sign_it');
                        callback(err, false);
                    }
                    if (res.statusCode == 200) {
                        console.log('200 sign_it');
                        callback(null, body);
                    }
                }
            );
        }],
    }, function (err, results) {
        if(err){
            console.log('err = ', err);
        }
        var j = {
            'result': true
        };
        if (results)
            j.body = results;
        rs.json(j);
    });
    myAsync;

});

app.listen(port);

console.log('RESTful API server started on: ' + port);

