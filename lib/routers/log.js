var request = require('request');
var express = require('express');
var async = require('async');
var router = express.Router();

var NODE_LIST = {
    admin: "http://50.0.10.31:9101",
    was: "http://50.0.10.30:9101",
    meta1: "http://50.0.10.32:9101",
    meta2: "http://50.0.10.33:9101",
    meta3: "http://50.0.10.34:9101",
    meta4: "http://50.0.10.35:9101",
}

router.get('/', function(req, res){
    var start = req.query.start;

    if(start) {
        start = new Date(start*1).toISOString(); //TODO: timestamp 형식 유효성 검사
    }

    var workings = {}
    async.forEachOf(NODE_LIST, function(value, key, callback){
        workings[key] = function(callback){
            let query = NODE_LIST[key] + "/log?start=" + start;
            request(query, function(err, response, body){
                if(err){
                    var result = {
                        result: false,
                        message: 'Query request error occured :' + err,
                    }
                    callback(null, result);                    
                    return;
                }

                body = JSON.parse(body);

                if(!body.result){
                    var result = {
                        result: false,
                        message: 'failed to get logs'
                    }
                    callback(null, result);
                    return;
                }

                callback(null, body)
            });
        };

        callback();
    }, function(err){
        if(err){
            res.json({
                result: false,
                message: "failed to get logs",
            })
            return;
        }

        async.parallel(workings, function(err, results){
            if(err){
                res.json({
                    result:false,
                    message: "failed to get logs",
                })
                return;
            }
            res.json({
                result: true,
                data: results,
            });
        })
    });
});

router.get('/:id', function(req, res){
    var id = req.params.id;
    var start = req.query.start;

    if(start){
        start = new Date(start*1).toISOString(); //TODO: timestamp 형식 유효성 검사
    }

    var node = NODE_LIST[id];
    if(!node){
        res.json({
            result: false,
            message: "유효하지 않은 노드ID입니다."
        })
        return;
    }
    
    query = node + "/log?start=" + start;
    request(query, function(err, response, body){
        if(err){
            var result = {
                result: false,
                message: 'Query request error occured :' + err,
            }
            res.json(result);
            return;
        }

        body = JSON.parse(body);

        if(!body.result){
            var result = {
                result: false,
                message: 'failed to get logs'
            }
            res.json(result);
            return;
        }

        res.json(body);
    });
})

module.exports = router;