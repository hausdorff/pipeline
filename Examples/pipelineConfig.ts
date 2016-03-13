import url = require("url");
import restify = require('restify');

var log = require('winston');
log.level = 'error';

export var pipelineConfigServerPort = 9000;
export var frontdoorRestPort = 8000;

export var frontdoorStage = 'frontdoorStage';
export var frontdoorPort = 8080;
export var planStoreStage = 'planStoreStage';
export var planStorePorts = [8081, 8081];
export var countStoreStage = 'countStoreStage';
export var countStorePort = 8082;
export var processJavascriptStage = 'processJavascriptStage';
export var processJavascriptPorts = [8083, 8084];

export var pipelineConfigServerUrl = url.parse("http://localhost:" + pipelineConfigServerPort);

var anyMap = (nodes: string[], params: Object) => {
    return nodes[Math.floor(nodes.length * Math.random())];
}

var planMap = (nodes: string[], params: any) => {
    log.info('Plan map parameters are \r\n',params,'\r\n for ',nodes);
    var result = (params.operation && params.operation.toString() <= "Middle") ? nodes[0] : nodes[1];
    log.info('Plan map returning address ', result);
    return result;
}



var config = {};

var pipelineConfig = this;

config[pipelineConfig.frontdoorStage] = { nodes: ['http://localhost:' + pipelineConfig.frontdoorPort], map: anyMap.toString() };
config[pipelineConfig.planStoreStage] = { nodes: ['http://localhost:' + pipelineConfig.planStorePorts[0], 'http://localhost:' + pipelineConfig.planStorePorts[1]], map: planMap.toString() };
config[pipelineConfig.countStoreStage] = { nodes: ['http://localhost:' + pipelineConfig.countStorePort], map: anyMap.toString() };
config[pipelineConfig.processJavascriptStage] = { nodes: ['http://localhost:' + pipelineConfig.processJavascriptPorts[0], 'http://localhost:' + pipelineConfig.processJavascriptPorts[1]], map: anyMap.toString() };

export function updateServer() {
    var configClient = restify.createJsonClient({ url: pipelineConfig.pipelineConfigServerUrl.href });

    log.info('Sending configuration to server');
    configClient.put('/config', config, (err, req, res, obj) => {
        if (err || res.statusCode != 201) throw 'could not put configuration';
    });
}
