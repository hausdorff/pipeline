import pipes = require('../src/pipes');
import pipelineConfig = require('./pipelineConfig');

var log = require('winston');
log.level = 'error';

// Create a pipeline, configure with the canoncial config server URL.
let pipeline = pipes.createPipeline(pipelineConfig.pipelineConfigServerUrl.href);

// The processing logic for the different stages. We feed this to the
// `PipelineServer` so that it knows what to do with a request.
function processHandler(params: any, next: ()=>void) {
    var operation = params["operation"];

    log.info('Got lookup operation for ', operation);

    // Resouce '/lookup/hello'.
    if (operation == 'hello') {
        // Send a "hello" message back to the initial server that called us.
        pipeline.sendToNode(
            params["initialNode"],
            '/pipeline/result',
            pipeline.merge(params, { result: "Hello" }));
    }

    // Resource '/lookup/counter'.
    else if (operation == 'counter') {
        // Send a message to the stage that increments a count, with a
        // continuation that will tell that stage to forward the message back // to the node that sent us the original message.
        pipeline.send(
            pipelineConfig.countStoreStage,
            '/rest/incrementCount',
            pipeline.merge(params, { resultName: "result" }),
            (ns_params, ns_next) => {
                pipeline.sendToNode(
                    ns_params["initialNode"],
                    '/pipeline/result',
                    ns_params);
                ns_next();
            });
    }

    // Resource '/lookup/counter'.
    else if (operation == 'simple') {
        // Send a continuation to the "JS processing stage", passing a
        // continuation that will calculate the date, and then have that stage
        // send that date back to the original node that sent us the request.
        pipeline.execute(
            "processJavascriptStage",
            params,
            (nns_params, nns_next) => {
                var message = 'The date is ' +
                    new Date(Date.now()).toLocaleString();
                pipeline.sendToNode(
                    nns_params['initialNode'],
                    '/pipeline/result',
                    pipeline.merge(nns_params,{ result: message }));
                nns_next();
            });
    }

    // Resource '/lookup/chained'.
    else if (operation == 'chained') {
        // Send a message to the count-incrementing stage, with a continuation
        // that will forward a request to the JS execution stage, that will
        // print the date and the incremented count, and send that back to the
        // original node that sent us the request.
        pipeline.send(
            pipelineConfig.countStoreStage,
            '/rest/incrementCount',
            pipeline.merge(params, { resultName: "count" }),
            (ns_params, ns_next) => {
                pipeline.execute(
                    "processJavascriptStage",
                    ns_params,
                    (nns_params, nns_next) => {
                        var message = 'Current count is ' + nns_params.count +
                            ' at ' + new Date(Date.now()).toLocaleString();
                        pipeline.sendToNode(
                            nns_params["initialNode"],
                            '/pipeline/result',
                            pipeline.merge(nns_params, { result: message }));
                        nns_next();
                    });
                ns_next();
            });
    }
    next();
}

// Instantiate Pipeline servers, prepare them to listen on some port.
let pipelineServerA = pipeline.createServer(pipelineConfig.planStoreStage);
let pipelineServerB = pipeline.createServer(pipelineConfig.planStoreStage);

pipelineServerA.process('/lookup/:operation', processHandler);
pipelineServerB.process('/lookup/:operation', processHandler);

// Start Pipeline servers listening on a port.
pipelineServerA.listen(pipelineConfig.planStorePorts[0]);
log.info('PlanStore Stage listening on ' + pipelineConfig.planStorePorts[0]);

pipelineServerB.listen(pipelineConfig.planStorePorts[1]);
log.info('PlanStore Stage listening on ' + pipelineConfig.planStorePorts[1]);

// Tell consuming scripts that the servers are provisioned and ready.
export var ready = true;