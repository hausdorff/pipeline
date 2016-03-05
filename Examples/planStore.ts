import http = require('http');
import restify = require('restify');
import pipes = require('../pipes');
import pipelineConfig = require('./pipelineConfig');

var pipeline = pipes.createPipeline(pipelineConfig.pipelineConfigServerUrl.href);

export var pipelineServer = pipeline.createServer('planStage');

pipelineServer.process('/listen/:operation', (params: Object) => {

    var operation = params["operation"];

    if (operation == 'hello') {
        pipeline.send(params["pipelineInitiallNode"], '/pipeline/result', { result: "Hello" });
    } 
    
    else if (operation == 'counter') {
        pipeline.send('countStoreStage', '/rest/incrementCount', { resultName: "result" }, (params) => {
            pipeline.send(params["initialNode"], '/pipeline/result', {});
        });
    }

    else if (operation == 'simpleProgram') {
        pipeline.send('countStore', '/api/incrementCount', { resultName: "count" }, (params) => {
            pipeline.execute('processJavascriptStage',{}, (params) => {
              var message = 'Current count is ' + params.count + ' at ' + new Date(Date.now()).toLocaleString();
              pipeline.send(params["initialNode"], '/pipeline/result', { result: message});    
            });
        });
    }
});

pipelineServer.listen(pipelineConfig.planStorePort);
console.log('PlanStore Stage listening on ' + pipelineConfig.planStorePort);

