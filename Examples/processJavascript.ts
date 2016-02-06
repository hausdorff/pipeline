import http = require('http');
import restify = require('restify');
import pipelineConfig = require('./pipelineConfig');
import pipeline = require('../pipeline');

// An example

export var server = restify.createServer();


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

server.post('/execute', (request, response, next) => {

    console.log('Process Javascript started.');
    pipeline.Stage.HandlePipelineRequest(request, response, next, (params) => {
        var resultName = params['resultName'].toString();
        params[resultName] = ProcessJavascript(params);
        pipeline.Stage.Process(params, params.stages);

    });
});

export function start() {
    server.listen(pipelineConfig.processJavascript.port);
    console.log('Listening on ' + pipelineConfig.processJavascript.port);
}




/// Generate code for eval

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

