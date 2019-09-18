var request = require('request');
var express = require('express');
var async = require('async');
var router = express.Router();

const PROM_HOST = "http://15.164.155.232:9090"
//const PROM_HOST = "http://localhost:9090"

const FIELD_CPU = "cpu";
const FIELD_MEMORY = "memory";
const FIELD_DISK = "disk";
const FIELD_NETWORK_RECEIVE = "network_recv";
const FIELD_NETWORK_TRANSMIT = "network_trans";

const QUERY_CPU_USAGE_LIST = PROM_HOST + "/api/v1/query?query=1-(avg%20by%20(id)(irate(node_cpu_seconds_total{mode=%27idle%27}[1m])))";
const QUERY_MEMORY_USAGE_LIST = PROM_HOST + "/api/v1/query?query=1-(node_memory_MemAvailable_bytes/node_memory_MemTotal_bytes)";
const QUERY_DISK_USAGE_LIST = PROM_HOST + "/api/v1/query?query=1-(sum(node_filesystem_avail_bytes)%20by%20(id)/sum(node_filesystem_size_bytes)%20by%20(id))";
const QUERY_NETWORK_RECEIVE_LIST = PROM_HOST + "/api/v1/query?query=avg(increase(node_network_receive_bytes_total[1m]))%20by%20(id)/1024/1024";
const QUERY_NETWORK_TRANSMIT_LIST = PROM_HOST + "/api/v1/query?query=avg(increase(node_network_transmit_bytes_total[1m]))%20by%20(id)/1024/1024";

router.get('/node_list', function(req, res){
    const query = PROM_HOST + "/api/v1/query?query=up"

    request(query, function(err, response, body){
        if(err){
            res.json({
                result: false,
                message: 'Query error occured',
            });
            return;
        }
        
        body = JSON.parse(body);
            
        if(body.status != "success"){
            res.json({
                result: false,
                message: 'Invalid query',
            });
            return;
        }

        data = new Array();

        queryResults = body.data.result;        
        queryResults.forEach(element => {
            data.push({
                id: element.metric.id,
                name: element.metric.name
            })
        });

        result = {
            result: true,
            data: data,
            count: data.length,
        };

        res.json(result);
    });
})

router.get('/', function(req, res){
    async.parallel([
        function(callback){
            getResourceList(QUERY_CPU_USAGE_LIST, FIELD_CPU, callback);
        },
        function(callback){
            getResourceList(QUERY_MEMORY_USAGE_LIST, FIELD_MEMORY, callback);
        },
        function(callback){
            getResourceList(QUERY_DISK_USAGE_LIST, FIELD_DISK, callback);
        },
        function(callback){
            getResourceList(QUERY_NETWORK_RECEIVE_LIST, FIELD_NETWORK_RECEIVE, callback);
        },
        function(callback){
            getResourceList(QUERY_NETWORK_TRANSMIT_LIST, FIELD_NETWORK_TRANSMIT, callback);
        }
    ], function(err, results){
        if(err){
            res.json({
                result: false,
                message: err
            })
            return;
        }
        var temp = {}

        results.forEach(element => {
            element.data.forEach(obj => {
                if(!temp[obj.id]){
                    temp[obj.id] = {
                        timestamp : obj.timestamp,
                        id : obj.id
                    };
                }
                switch(element.field){
                    case FIELD_CPU: 
                        temp[obj.id].cpu = obj.value;
                        break;
                    case FIELD_MEMORY:
                        temp[obj.id].memory = obj.value;
                        break;
                    case FIELD_DISK:
                        temp[obj.id].disk = obj.value;
                        break;
                    case FIELD_NETWORK_RECEIVE:
                        temp[obj.id].network_recv = obj.value;
                        break;
                    case FIELD_NETWORK_TRANSMIT:
                        temp[obj.id].network_trans = obj.value;
                        break;
                }
            });
        });

        var data = [];

        for(key in temp){
            data.push(temp[key])
        }

        res.json({
            result: true,
            data: data
        })
    });
})

router.get('/cpu', function(req, res){
    async.waterfall([
        function(callback){
            getResourceList(QUERY_CPU_USAGE_LIST, FIELD_CPU, callback);
        }
    ], function(err, result){
        res.json(result);
    });
})

router.get('/memory', function(req, res){
    async.waterfall([
        function(callback){
            getResourceList(QUERY_MEMORY_USAGE_LIST, FIELD_MEMORY, callback);
        }
    ], function(err, result){
        res.json(result);
    });
})

router.get('/disk', function(req, res){
    async.waterfall([
        function(callback){
            getResourceList(QUERY_DISK_USAGE_LIST, FIELD_DISK, callback);
        }
    ], function(err, result){
        res.json(result);
    });
})

router.get('/network_recv', function(req, res){ 
    async.waterfall([
        function(callback){
            getResourceList(QUERY_NETWORK_RECEIVE_LIST, FIELD_NETWORK_RECEIVE, callback);
        }
    ], function(err, result){
        res.json(result);
    });
})

router.get('/network_trans', function(req, res){
    async.waterfall([
        function(callback){
            getResourceList(QUERY_NETWORK_TRANSMIT_LIST, FIELD_NETWORK_TRANSMIT, callback);
        }
    ], function(err, result){
        res.json(result);
    });
})

router.get('/cpu/:node_id', function(req, res){
    const nodeId = req.params.node_id;

    let interval = req.query.interval;
    let length = req.query.length * 1;

    if(!interval) interval = '5m';
    if(!length) length = 15;

    let end =  Math.floor(+ new Date()/1000);
    let start = end-(getStepToSecond(interval) * (length-1))
    
    const query = PROM_HOST + "/api/v1/query_range?query=1-(avg%20by%20(id)(irate(node_cpu_seconds_total{mode='idle',%20id='" + nodeId + "'}[1m])))&start=" + start + "&end=" + end + "&step=" + interval;
    requestNodeGraphQuery(query, res);
})

router.get('/memory/:node_id', function(req, res){
    const nodeId = req.params.node_id;

    let interval = req.query.interval;
    let length = req.query.length * 1;

    if(!interval) interval = '5m';
    if(!length) length = 15;

    let end =  Math.floor(+ new Date()/1000);
    let start = end-(getStepToSecond(interval) * (length-1))
    
    const query = PROM_HOST + "/api/v1/query_range?query=1-(node_memory_MemAvailable_bytes/node_memory_MemTotal_bytes{id='" + nodeId + "'})&start=" + start + "&end=" + end + "&step=" + interval
    requestNodeGraphQuery(query, res);
})

router.get('/disk/:node_id', function(req, res){
    const nodeId = req.params.node_id;

    let interval = req.query.interval;
    let length = req.query.length * 1;

    if(!interval) interval = '5m';
    if(!length) length = 15;

    let end =  Math.floor(+ new Date()/1000);
    let start = end-(getStepToSecond(interval) * (length-1))

    const query = PROM_HOST + "/api/v1/query_range?query=1-(sum(node_filesystem_avail_bytes{id='" + nodeId + "'})%20by%20(id)/sum(node_filesystem_size_bytes)%20by%20(id))&start=" + start + "&end=" + end + "&step=" + interval
	return requestNodeGraphQuery(query, res)
})

router.get('/network_recv/:node_id', function(req, res){
    const nodeId = req.params.node_id;

    let interval = req.query.interval;
    let length = req.query.length * 1;

    if(!interval) interval = '5m';
    if(!length) length = 15;

    let end =  Math.floor(+ new Date()/1000);
    let start = end-(getStepToSecond(interval) * (length-1))

    const query = PROM_HOST + "/api/v1/query_range?query=sum(increase(node_network_receive_bytes_total{id='" + nodeId + "'}[1m]))/1024/1024&start=" + start + "&end=" + end + "&step=" + interval
	return requestNodeGraphQuery(query, res)
})

router.get('/network_trans/:node_id', function(req, res){
    const nodeId = req.params.node_id;

    let interval = req.query.interval;
    let length = req.query.length * 1;

    if(!interval) interval = '5m';
    if(!length) length = 15;

    let end =  Math.floor(+ new Date()/1000);
    let start = end-(getStepToSecond(interval) * (length-1))

    const query = PROM_HOST + "/api/v1/query_range?query=sum(increase(node_network_transmit_bytes_total{id='" + nodeId + "'}[1m]))/1024/1024&start=" + start + "&end=" + end + "&step=" + inteval
	return requestNodeGraphQuery(query, res)
})

function requestNodeGraphQuery(query, res){
    request(query, function(err, response, body){
        if(err){
            res.json({
                result: false,
                message: 'Query error occured',
            });
            return;
        }
        
        body = JSON.parse(body);
            
        if(body.status != "success"){
            res.json({
                result: false,
                message: 'Invalid query',
            });
            return;
        }

        let data = new Array();

        if(body.data.result.length == 0){
            res.json({
                result: false,
                message: 'Invalid query',
            });
            return;
        }
        queryResults = body.data.result[0].values;        
        queryResults.forEach(element => {
            data.push({
                timestamp: element[0],
                value: element[1],
            })
        });

        res.json({
            result: true,
            data: data,
            count: data.length,
        });
    });
}

function getResourceGraph(query, callback){
    request(query, function(err, response, body){
        if(err){
            var result = {
                result: false,
                message: 'Query error occured',
            }
            callback(null, result);
            return;
        }
        
        body = JSON.parse(body);
            
        if(body.status != "success" || body.data.result.length == 0){
            var result = {
                result: false,
                message: 'Invalid query'
            }
            callback(null, result);
            return;
        }

        let data = new Array();

        queryResults = body.data.result[0].values;        
        queryResults.forEach(element => {
            data.push({
                timestamp: element[0],
                value: element[1],
            })
        });

        var result = {
            result: true,
            data: data,
            count: data.length,
        }

        callback(null, result);
    });
}

function getResourceList(query, field, callback){
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

        if(body.status != "success"){
            var result = {
                result: false,
                message: 'Invalid query'
            }
            callback(null, result);
            return;
        }

        let data = new Array();

        queryResults = body.data.result;
        queryResults.forEach(element => {
            data.push({
                id: element.metric.id,
                timestamp: element.value[0],
                value: parseFloat(element.value[1]),
            })
        });

        var result = {
            result: true,
            field, field,
            data: data,
            count: data.length,
        }

        callback(null, result);
    });
}

//stepExpValidate : 그래프 Step 단위의 형식을 검사합니다.
//[s,m,h,d] 단위를 사용하는 숫자 형식인가 검사. ex) 5s, 10m, 2h, 1d
function stepExpValidate(exp){
    const reg = /^([0-9]+)[smhd]$/;
    return reg.test(exp);
}

function getStepToSecond(step){
    if(stepExpValidate(step)){
        unit = step.slice(-1);
        var temp;
        switch(unit) {
            case "s":
                temp = 1;
                break;
            case "m":
                temp = 60;
                break;
            case "h":
                temp = 3600;
                break;
            case "d":
                temp = 3600 * 24;
                break;
            default:
                temp = 0;
        }

        return step.slice(0, -1) * temp;
    }

    return 300;
}

module.exports = router;
