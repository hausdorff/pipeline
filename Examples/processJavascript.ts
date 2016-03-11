import http = require('http');
import restify = require('restify');
import pipes = require('../pipes');
import pipelineConfig = require('./pipelineConfig');

var pipeline = pipes.createPipeline(pipelineConfig.pipelineConfigServerUrl.href);

export var pipelineServer1 = pipeline.createServer(pipelineConfig.processJavascriptStage);
export var pipelineServer2 = pipeline.createServer(pipelineConfig.processJavascriptStage);

function handler(pipeline: pipes.Pipeline, params: any, next: () => void) {

    console.log('Got process javascript request', params);

    if (!params.code) { next(); return; }

    var f = pipes.GenerateFunction(params.code as string);
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
console.log('Process Javascript Stage listening on ' + pipelineConfig.processJavascriptPorts[0]);

pipelineServer2.listen(pipelineConfig.processJavascriptPorts[1]);
console.log('Process Javascript Stage listening on ' + pipelineConfig.processJavascriptPorts[1]);




// -------------------
// Code gen for eval
// All old

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

function CodeForParameter(key: string, value: any) {
    return `var ${key} = JSON.parse(${stringify(value)});
    `;
}

function Code(params) {
    // Keeping all variables scoped to minimize any potential conflicts
    return `(function Code() {
        ${
        Object.keys(params).reduce((previous, key) => {
            return previous + ((key != "code") ? CodeForParameter(key, params[key]) : "");
        }, "")
        }
        return ${ params["code"]}
    })();
    `;
}

