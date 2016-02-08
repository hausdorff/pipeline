import http = require('http');
import restify = require('restify');
import pipelineConfig = require('./pipelineConfig');
import pipeline = require('../pipeline');

// An example

export var simulateDelay = true;

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
            if (simulateDelay) {
                var delay = Math.floor(Math.random() * 2000);
                console.log("Simulating long-running count store pipeline stage with delay of " + delay + "ms for session " + params["session"]);
                setTimeout(() => {
                    console.log("Continuing long-running count store pipeline stage for session " + params["session"]);
                    pipeline.Stage.Process(params, params.stages);
                }, delay);
            }            
            else pipeline.Stage.Process(params, params.stages);
        }
    });
});

export function start() {
    server.listen(pipelineConfig.countStore.url.port);
    console.log('Count Store listening on ' + pipelineConfig.countStore.url.port);
}
