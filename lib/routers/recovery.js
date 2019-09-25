const request = require('request');
const express = require('express');
const async = require('async');
const fs = require('fs');
const router = express.Router();

const CONFIG_FILE_PATH = 'config/config.json';
const ENCODING_UTF8 = 'utf-8'

//단일 노드 Gmet 재시작 요청
router.get('/restart/:id', function(req, res){
    var id = req.params.id;
    
    async.waterfall([
        function(callback){
            getNodeList(callback);
        },
        function(nodeList, callback){
            var node = nodeList[id];
            if(!node) {
                callback("유효하지 않은 노드ID입니다.", null);
            }
            else {
                let requestParams = {
                    uri: "http://" + node.ip_address + node.log_exporter + "/restart",
                    timeout: 5000,
                };

                callback(null, requestParams);
            }
        }
    ], function(err, requestParams){
        if(err){
            res.json({
                result: false,
                message: err,
            });
        }
        else {
            request(requestParams, function(err, response, body){
                if(err){
                    var result = {
                        result: false,
                        message: 'Gmet 재시작 요청을 실패했습니다:' + err,
                    }
                    res.json(result);
                    return;
                }

                body = JSON.parse(body);

                if(!body.result){
                    var result = {
                        result: false,
                        message: 'Gmet 재시작 요청을 실패했습니다: ' + result.message,
                    }
                    res.json(result);
                    return;
                }

                res.json(body);
            });
        }
    });
});

//단일 노드 재부팅 요청
router.get('/reboot/:id', function(req, res){
    var id = req.params.id;
    
    async.waterfall([
        function(callback){
            getNodeList(callback);
        },
        function(nodeList, callback){
            var node = nodeList[id];
            if(!node) {
                callback("유효하지 않은 노드ID입니다.", null);
            }
            else {
                let requestParams = {
                    uri: "http://" + node.ip_address + node.log_exporter + "/reboot",
                    timeout: 5000,
                };

                callback(null, requestParams);
            }
        }
    ], function(err, requestParams){
        if(err){
            res.json({
                result: false,
                message: err,
            });
        }
        else {
            request(requestParams, function(err, response, body){
                if(err){
                    var result = {
                        result: false,
                        message: 'Gmet 재시작 요청을 실패했습니다:' + err,
                    }
                    res.json(result);
                    return;
                }

                body = JSON.parse(body);

                if(!body.result){
                    var result = {
                        result: false,
                        message: 'Gmet 재시작 요청을 실패했습니다: ' + result.message,
                    }
                    res.json(result);
                    return;
                }

                res.json(body);
            });
        }
    });
});

function getNodeList(callback){
    try{
        let config = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, ENCODING_UTF8));
        callback(null, config.node_list);
    }catch(err){
        callback("노드 목록을 불러올 수 없습니다: " + err, null);
    }
}

module.exports = router;