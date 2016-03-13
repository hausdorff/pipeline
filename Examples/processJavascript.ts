import http = require('http');
import restify = require('restify');
import pipes = require('../src/pipes');
import pipelineConfig = require('./pipelineConfig');

var log = require('winston');
log.level = 'error';

var pipeline = pipes.createPipeline(pipelineConfig.pipelineConfigServerUrl.href);

var pipelineServer1 = pipeline.createServer(pipelineConfig.processJavascriptStage);
var pipelineServer2 = pipeline.createServer(pipelineConfig.processJavascriptStage);

function handler(pipeline: pipes.Pipeline, params: any, next: () => void) {

    log.info('Got process javascript request', params);

    if (!params.code) { next(); return; }

    var f = pipes.createFunction(params.code);
    delete params.code;

    ((pipeline: pipes.Pipeline, params: any, next: () => void) => {
        f(params, next);
    })(this.pipeline, params, next);
}

pipelineServer1.process('/pipeline/execute', (params, next) => {
    handler(this.pipeline, params, next);
});

pipelineServer2.process('/pipeline/execute', (params, next) => {
    handler(this.pipeline, params, next);
});


pipelineServer1.listen(pipelineConfig.processJavascriptPorts[0]);
log.info('Process Javascript Stage listening on ' + pipelineConfig.processJavascriptPorts[0]);

pipelineServer2.listen(pipelineConfig.processJavascriptPorts[1]);
log.info('Process Javascript Stage listening on ' + pipelineConfig.processJavascriptPorts[1]);

export var ready = true;

/* 

// OLD code gen helpers

function escape(s) {
    return s
        .replace(/[\\]/g, '\\\\')
        .replace(/[\"]/g, '\\\"')
        .replace(/[\/]/g, '\\/')
        .replace(/[\b]/g, '\\b')
        .replace(/[\f]/g, '\\f')
        .replace(/[\n]/g, '\\n')
        .replace(/[\r]/g, '\\r')
        .replace(/[\t]/g, '\\t');
}

function stringify(s) {
    return '"' + escape(JSON.stringify(s)) + '"';
};

*/
