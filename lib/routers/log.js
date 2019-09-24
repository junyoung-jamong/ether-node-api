const request = require('request');
const express = require('express');
const async = require('async');
const fs = require('fs');
const router = express.Router();

const CONFIG_FILE_PATH = 'config/config.json';
const ENCODING_UTF8 = 'utf-8'

router.get('/', function(req, res){
    var start = req.query.start; //unix timestamp 형식을 만족해야 함 - ex)1569211726011

    if(start){
        try{
            start = new Date(Number(start)).toISOString();
        } catch(e){
            res.json({
                result: false,
                message: "Query 형식이 유효하지 않습니다.",
            })
            return;
        }
    }

    async.waterfall([
        function(callback){
            getNodeList(callback);
        },
        function(nodeList, callback){
            var workings = {}
            async.forEachOf(nodeList, function(node, key, callback2){
                workings[key] = function(callback3){
                    let requestParams = {
                        uri: "http://" + node.ip_address + node.log_exporter + "/log?start=" + start,
                        timeout: 5000,
                    };

                    request(requestParams, function(err, response, body){
                        if(err){
                            var result = {
                                result: false,
                                message: '로그 정보를 불러오는 데 실패하였습니다: ' + err,
                            }
                            callback3(null, result);                    
                            return;
                        }

                        body = JSON.parse(body);

                        if(!body.result){
                            var result = {
                                result: false,
                                message: '로그 정보를 불러오는 데 실패하였습니다: ' + result.message,
                            }
                            callback3(null, result);
                            return;
                        }

                        callback3(null, body)
                    });
                };

                callback2();
            }, 
            function(err){
                if(err){
                    callback('로그 정보를 불러오는 데 실패하였습니다: ' + err, null);
                }
                else {
                    callback(null, workings);
                }
            });
        }
    ], function(err, workings){
        if(err){
            res.json({
                result: false,
                message: err,
            });
        }
        else {
            async.parallel(workings, function(err, results){
                if(err){
                    res.json({
                        result:false,
                        message: '로그 정보를 불러오는 데 실패하였습니다: ' + err,
                    })
                    return;
                }
    
                var data = [];
    
                for(key in results){
                    var node = results[key];
                    node.id = key;
                    data.push(node);
                }
    
                res.json({
                    result: true,
                    data: data,
                });
            })
        }
    });
});


//단일 노드 로그 요청 API
router.get('/:id', function(req, res){
    var id = req.params.id;
    var start = req.query.start;

    if(start){
        try{
            start = new Date(Number(start)).toISOString();
        } catch(e){
            res.json({
                result: false,
                message: "Query 형식이 유효하지 않습니다.",
            })
            return;
        }
    }

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
                    uri: "http://" + node.ip_address + node.log_exporter + "/log?start=" + start,
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
                        message: '로그 정보를 불러오는 데 실패하였습니다:' + err,
                    }
                    res.json(result);
                    return;
                }

                body = JSON.parse(body);

                if(!body.result){
                    var result = {
                        result: false,
                        message: '로그 정보를 불러오는 데 실패하였습니다: ' + result.message,
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