import pipes = require('../pipes');
import pipelineConfig = require('./pipelineConfig');


//
// Helper functions.
//

var incrementCount =
    (ns_params, ns_next) => {
        pipeline.sendToNode(
            ns_params["initialNode"],
            '/pipeline/result',
            ns_params);
        ns_next();
    };

var simpleProgram =
    (ns_params, ns_next) => {
        pipeline.execute(
            pipelineConfig.processJavascriptStage,
            ns_params,
            (nns_params, nns_next) => {
                var message = 'Current count is ' + nns_params.count + ' at ' + new Date(Date.now()).toLocaleString();
                pipeline.sendToNode(
                    nns_params["initialNode"],
                    '/pipeline/result',
                    pipes.MergeObjects(nns_params,{ result: message}));
                nns_next();
            });
        ns_next();
    };


//
// The pipeline.
//

// Create pipeline plan.
var pipeline = pipes.createPipeline(pipelineConfig.pipelineConfigServerUrl.href);

// Create pipeline server.
export var pipelineServer = pipeline.createServer(pipelineConfig.planStoreStage);

// Set up pipeline.
pipelineServer.process(
    '/lookup/:operation',
    (params, next) => {
        var operation = params["operation"];

        console.log('Got lookup operation for ', operation);

        // If the operation is 'hello', send a message back to the initial node,
        // saying "hello".
        if (operation == 'hello') {
            pipeline.sendToNode(
                params["initialNode"],
                '/pipeline/result',
                pipes.MergeObjects(params, { result: "Hello" }));
        }

        // If the operation is 'counter', send message to the servers that
        // increment a count.
        else if (operation == 'counter') {
            pipeline.send(
                pipelineConfig.countStoreStage,
                '/rest/incrementCount',
                pipes.MergeObjects(params, { resultName: "result" }),
                incrementCount);
        }

        // Set up simple program pipe.
        else if (operation == 'simpleProgram') {
            pipeline.send(
                pipelineConfig.countStoreStage,
                '/api/incrementCount',
                pipes.MergeObjects(params, { resultName: "count" }),
                simpleProgram);
        }

        next();
    });

// Run pipeline.
pipelineServer.listen(pipelineConfig.planStorePorts[0]);
console.log('PlanStore Stage listening on ' + pipelineConfig.planStorePorts[0]);
