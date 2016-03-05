import http = require('http');
import restify = require('restify');
import pipes = require('../pipes');
import pipelineConfig = require('./pipelineConfig');

var pipeline = pipes.createPipeline(pipelineConfig.pipelineConfigServerUrl.href);

export var pipelineServer = pipeline.createServer('planStage');

pipelineServer.process('/execute', (params, next) => {
    ProcessJavascript(params);
    next();
});

function ProcessJavascript(params: Object) {
    var code = Code(params);
    var result = null;
    try {
        result = eval(code);
    } catch (err) {
        result = err;
    }
    return result;
}

pipelineServer.listen(pipelineConfig.processJavascriptPorts[0]);
console.log('PlanStore Stage listening on ' + pipelineConfig.processJavascriptPorts[0]);

// -------------------
// Code gen for eval

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

