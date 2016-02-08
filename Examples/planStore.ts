import http = require('http');
import restify = require('restify');
import pipelineConfig = require('./pipelineConfig');
import pipeline = require('../pipeline');

// An example

export var serverA = restify.createServer();
export var serverB = restify.createServer();

// Simulate Partioning Plans - both servers kown the plans

serverA.post('/lookup/:operation',PlanStore);
serverB.post('/lookup/:operation',PlanStore);

function PlanStore (request, response, next)  {

    console.log('Plan store pipeline operation started.');
    pipeline.Stage.HandlePipelineRequest(request, response, next, (params) => {

        var operation = params["operation"];

        if (operation == 'counter') {
            pipeline.Stage.Process(params,
                [
                    { url: pipelineConfig.countStore.url.href, path: '/api/incrementCount', params: { resultName: "result" } },
                    { url: params.initialStageAddress, path: '/pipeline/result', params: {} }
                ]);
        }

        else if (operation == 'simpleProgram') {
            pipeline.Stage.Process(params,
                [
                    { url: pipelineConfig.countStore.url.href, path: '/api/incrementCount', params: { resultName: "count" } },
                    { url: pipelineConfig.processJavascript.url.href, path: '/execute', params: { 
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
}


export function start() {
    serverA.listen(pipelineConfig.planStoreA.url.port);
    console.log('Plan store A listening on ' + pipelineConfig.planStoreA.url.port);
    serverB.listen(pipelineConfig.planStoreB.url.port);
    console.log('Plan store B listening on ' + pipelineConfig.planStoreB.url.port);
}
