import http = require('http');
import restify = require('restify');
import pipelineConfig = require('./pipelineConfig');
import pipeline = require('../pipeline');

// An example

var planStoreServer = restify.createServer();

planStoreServer.post('/lookup/:operation', (request, response, next) => {

    pipeline.Stage.HandlePipelineRequest(request, response, next, (params) => {

        var operation = params["operation"];

        if (operation == 'currentCount') {
            pipeline.Stage.Process(params,
                [
                    { url: pipelineConfig.countStore.address, path: '/currentCount', params: { resultName: "count" } },
                    { url: pipelineConfig.processJavascript.address, path: '/execute', params: { code: "return 'Current count is ' + count;", resultName: "result" } },
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

planStoreServer.listen(pipelineConfig.planStore.port);
