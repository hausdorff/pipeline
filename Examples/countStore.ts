import http = require('http');
import restify = require('restify');
import pipelineConfig = require('./pipelineConfig');
import pipeline = require('../pipeline');

// An example

export var server = restify.createServer();

var count = 0;

function DoIncrementCount(params) {
    count++;
    return count;
}


server.post('/api/:operation', (request, response, next) => {
    
    console.log('Count store pipeline operation started.');
    pipeline.Stage.HandlePipelineRequest(request, response, next, (params) => {

        var operation = params["operation"];

        if (operation == 'incrementCount') {
            var resultName = params['resultName'].toString();            
            params[resultName] = DoIncrementCount(params); 
            pipeline.Stage.Process(params,params.stages);
        }
    });
});

export function start() {
    server.listen(pipelineConfig.countStore.port);
    console.log('Listening on ' + pipelineConfig.countStore.port);
}
