import http = require('http');
import restify = require('restify');
import pipelineConfig = require('./pipelineConfig');
import pipeline = require('../pipeline');

// An example

export var server = restify.createServer();

server.post('/lookup/:operation', (request, response, next) => {

    console.log('Plan store pipeline operation started.');
    pipeline.Stage.HandlePipelineRequest(request, response, next, (params) => {

        var operation = params["operation"];

        if (operation == 'counter') {
            pipeline.Stage.Process(params,
                [
                    { url: pipelineConfig.countStore.address, path: '/api/incrementCount', params: { resultName: "result" } },
                    { url: params.initialStageAddress, path: '/pipeline/result', params: {} }
                ]);
        }

        else if (operation == 'simpleProgram') {
            pipeline.Stage.Process(params,
                [
                    { url: pipelineConfig.countStore.address, path: '/api/incrementCount', params: { resultName: "count" } },
                    { url: pipelineConfig.processJavascript.address, path: '/execute', params: { 
                        code: "'Current count is ' + count + ' at ' + new Date(Date.now()).toLocaleString();",
                        resultName: "result" } 
                    },
                    { url: params.initialStageAddress, path: '/pipeline/result', params: {} }
                ]);
        }

        else if (operation == 'hello') {
            pipeline.Stage.Process(params,
                [
                    { url: params.initialStageAddress, path: '/pipeline/result', params: { result: "Hello World!" } }
                ]);
        }

    });
});

export function start() {
    server.listen(pipelineConfig.planStore.port);
    console.log('Listening on ' + pipelineConfig.planStore.port);
}
