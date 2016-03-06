import pipes = require('../pipes');
import pipelineConfig = require('./pipelineConfig');

var pipeline = pipes.createPipeline(pipelineConfig.pipelineConfigServerUrl.href);

export var pipelineServer = pipeline.createServer(pipelineConfig.planStoreStage);

pipelineServer.process('/lookup/:operation', (params, next) => {

    var operation = params["operation"];
    
    console.log('Got lookup operation for ', operation);

    if (operation == 'hello') {
        pipeline.sendToNode(params["initialNode"], '/pipeline/result', pipes.MergeObjects(params,{ result: "Hello" }));
    } 
    
    else if (operation == 'counter') {
        pipeline.send(pipelineConfig.countStoreStage, '/rest/incrementCount', pipes.MergeObjects(params,{ resultName: "result" }), (ns_params, ns_next) => {
            pipeline.sendToNode(ns_params["initialNode"], '/pipeline/result', ns_params);
            ns_next();            
        });
    }

    else if (operation == 'simpleProgram') {
        pipeline.send(pipelineConfig.countStoreStage, '/api/incrementCount', pipes.MergeObjects(params,{ resultName: "count" }), (ns_params, ns_next) => {
            pipeline.execute(pipelineConfig.processJavascriptStage, ns_params, (nns_params, nns_next) => {
              var message = 'Current count is ' + nns_params.count + ' at ' + new Date(Date.now()).toLocaleString();
              pipeline.sendToNode(nns_params["initialNode"], '/pipeline/result', pipes.MergeObjects(nns_params,{ result: message}));
              nns_next();
            });
            ns_next();
        });
    }
    
    next();
});

pipelineServer.listen(pipelineConfig.planStorePorts[0]);
console.log('PlanStore Stage listening on ' + pipelineConfig.planStorePorts[0]);
