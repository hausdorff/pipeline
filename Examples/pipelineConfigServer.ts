
import restify = require("restify");
import url = require("url");
import pipes = require('../pipes');
import pipelineConfig = require('./pipelineConfig');



export var server = restify.createServer();

server.get('/config', (req, res) => {
    res.send(config);
});

server.post('/stages/:stage/addNode', (req, res) => {
    var stage = req.params.stage;
    var address = 'http://' + req.connection.remoteAddress + ':' + req.params.port;
    console.log('Adding ' + address + ' to ' + stage);
    var stageConfig = config[stage] ? config[stage] : config[stage] = { nodes: [], map: null };
    stageConfig.nodes.push(address);
    res.send(201, { address: address });
});


server.listen(pipelineConfig.pipelineConfigServerPort);
console.log('Configuration server listening on ' + pipelineConfig.pipelineConfigServerPort);




var config: { [key: string]: StageConfig } = {};




// These following should be set by calling the configServer

interface StageConfig {
    nodes: string[];
    map: (stages: string[], any) => string;
}

var anyMap = (stages: string[], obj) => {
    return stages[Math.floor(stages.length * Math.random())];
}

var planMap = (stages: string[], obj) => {
    if (obj.toString() <= "Middle") return stages[0]
    else return stages[1];
}

config['frontdoorStage'] = { nodes: [], map: anyMap }
config['planStoreStage'] = { nodes: [], map: planMap }
config['countStoreStage'] = { nodes: [], map: anyMap }
config['processJavascriptStage'] = { nodes: [], map: anyMap }

