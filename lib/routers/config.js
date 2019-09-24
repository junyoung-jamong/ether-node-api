const request = require('request');
const express = require('express');
const async = require('async');
const fs = require('fs');
const router = express.Router();

const CONFIG_FILE_PATH = 'config/config.json';
const ENCODING_UTF8 = 'utf-8'

//노드 정보 목록 요청
router.get('/node', function(req, res){
    try{
        let config = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, ENCODING_UTF8));

        res.json({
            result: true,
            data: config.node_list,
        });
    }catch(e){
        res.json({
            result: false,
            message: e,
        })
    }
});

//새로운 노드 추가 요청
router.post('/node', function(req, res){
    let config = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, ENCODING_UTF8));

    let id = req.body.id;
    let ipAddress = req.body.ip_address;
    let logExporter = req.body.log_exporter;

    if(!id || !ipAddress || !logExporter){
        res.json({
            result: false,
            message: "유효하지 않은 요청 양식입니다.",
        })
        return;
    }

    async.forEachOf(config.node_list, function(value, key, callback){
        if(value.id == id || value.ip_address == ipAddress) {
            callback('이미 등록된 노드입니다.');
        }
        else {
            callback();
        }
    },
    function(e){
        if(e){
            res.json({
                result: false,
                message: e,
            })
        }
        else {
            if(!config.node_list) {
                config.node_list = {};
            }
        
            let newNode = {
                id: id,
                ip_address: ipAddress,
                log_exporter: logExporter,
            }
            
            config.node_list[id] = newNode;
        
            fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config), {encoding: ENCODING_UTF8})
        
            res.json({
                result: true,
                data: newNode
            })
        }
    });
});

//단일 노드 정보 요청
router.get('/node/:id', function(req, res){
    let config = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, ENCODING_UTF8));
    let id = req.params.id;

    node = config.node_list[id];

    if(!node){
        res.json({
            result: false,
            message: "유효하지 않은 노드 ID입니다.",
        });

        return;
    }

    res.json({
        result: true,
        data: node,
    })
});

//단일 노드 정보 수정 요청
router.put('/node/:id', function(req, res){
    let config = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, ENCODING_UTF8));
    let id = req.params.id;

    let ipAddress = req.body.ip_address;
    let logExporter = req.body.log_exporter;

    if(!ipAddress && !logExporter){
        res.json({
            result: false,
            message: "유효하지 않은 요청 양식입니다."
        });

        return;
    }

    node = config.node_list[id];

    if(!node){
        res.json({
            result: false,
            message: "유효하지 않은 노드 ID입니다.",
        });

        return;
    }

    if(ipAddress)
        node.ip_address = ipAddress;
    if(logExporter)
        node.log_exporter = logExporter;
    
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config), {encoding: ENCODING_UTF8})

    res.json({
        result: true,
        data: node,
    })
});

//특정 노드 삭제
router.delete('/node/:id', function(req, res){
    let config = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, ENCODING_UTF8));
    let id = req.params.id;

    node = config.node_list[id];

    if(!node){
        res.json({
            result: false,
            message: "유효하지 않은 노드 ID입니다.",
        });

        return;
    }

    delete config.node_list[id];
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config), {encoding: ENCODING_UTF8})

    res.json({
        result: true,
        data: node,
    })
});

module.exports = router;