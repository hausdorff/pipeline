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
        pipeline.send('countStoreStage', '/rest/incrementCount', pipes.MergeObjects(params,{ resultName: "result" }), (params) => {
            pipeline.send(params["initialNode"], '/pipeline/result', {});
        });
    }

    else if (operation == 'simpleProgram') {
        pipeline.send('countStore', '/api/incrementCount', pipes.MergeObjects(params,{ resultName: "count" }), (params) => {
            pipeline.execute('processJavascriptStage',{}, (params) => {
              var message = 'Current count is ' + params.count + ' at ' + new Date(Date.now()).toLocaleString();
              pipeline.send(params["initialNode"], '/pipeline/result', pipes.MergeObjects(params,{ result: message}));
            });
        });
    }
    
    next();
});

pipelineServer.listen(pipelineConfig.planStorePorts[0]);
console.log('PlanStore Stage listening on ' + pipelineConfig.planStorePorts[0]);

