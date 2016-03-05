import http = require('http');
import restify = require('restify');
import pipes = require('../pipes');
import pipelineConfig = require('./pipelineConfig');

var pipeline = pipes.createPipeline(pipelineConfig.pipelineConfigServerUrl.href);

export var pipelineServer = pipeline.createServer('countStoreStage');

export var simulateDelay = true;
var count = 0;
function DoIncrementCount(params) {
    count++;
    return count;
}

pipelineServer.process('/rest/:operation', (params: Object, next : () => void ) => {
    var operation = params["operation"];

    if (operation == 'incrementCount') {
        var resultName = params['resultName'].toString();
        params[resultName] = DoIncrementCount(params);
        if (simulateDelay) {
            var delay = Math.floor(Math.random() * 2000);
            console.log("Simulating long-running count store pipeline stage with delay of " + delay + "ms for session " + params["session"]);
            setTimeout(() => {
                console.log("Continuing long-running count store pipeline stage for session " + params["session"]);
                next();
            }, delay);
        }
        next()
    }
});


pipelineServer.listen(pipelineConfig.countStorePort);
console.log('CountStore Stage listening on ' + pipelineConfig.countStorePort);