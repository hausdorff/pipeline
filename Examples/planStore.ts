import pipes = require('../src/pipes');
import pipelineConfig = require('./pipelineConfig');

var log = require('winston');
log.level = 'error';

var pipeline = pipes.createPipeline(pipelineConfig.pipelineConfigServerUrl.href);

var pipelineServer = pipeline.createServer(pipelineConfig.planStoreStage);

pipelineServer.process('/lookup/:operation', (params, next) => {

    var operation = params["operation"];

    log.info('Got lookup operation for ', operation);

    if (operation == 'hello') {
        pipeline.sendToNode(params["initialNode"], '/pipeline/result', pipeline.merge(params, { result: "Hello" }));
    }

    else if (operation == 'counter') {
        pipeline.send(pipelineConfig.countStoreStage, '/rest/incrementCount', pipeline.merge(params, { resultName: "result" }), (ns_params, ns_next) => {
            pipeline.sendToNode(ns_params["initialNode"], '/pipeline/result', ns_params);
            ns_next();
        });
    }

    else if (operation == 'simple') {
        pipeline.execute("processJavascriptStage", params, (nns_params, nns_next) => {
            var message = 'The date is ' + new Date(Date.now()).toLocaleString();
            pipeline.sendToNode(nns_params['initialNode'], '/pipeline/result',pipeline.merge(nns_params,{ result: message }));
            nns_next();
        });
    }

    else if (operation == 'chained') {
        pipeline.send(pipelineConfig.countStoreStage, '/rest/incrementCount', pipeline.merge(params, { resultName: "count" }), (ns_params, ns_next) => {
            pipeline.execute("processJavascriptStage", ns_params, (nns_params, nns_next) => {
                var message = 'Current count is ' + nns_params.count + ' at ' + new Date(Date.now()).toLocaleString();
                pipeline.sendToNode(nns_params["initialNode"], '/pipeline/result', pipeline.merge(nns_params,{ result: message }));
                nns_next();
            });
            ns_next();
        });
    }
    next();
});

pipelineServer.listen(pipelineConfig.planStorePorts[0]);
log.info('PlanStore Stage listening on ' + pipelineConfig.planStorePorts[0]);

export var ready = true;