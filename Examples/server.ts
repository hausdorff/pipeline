import http = require('http');
import restify = require('restify');
import pipes = require('../src/pipes');
import pipesConfigServer = require('../src/pipesConfigurationServer');
import pipelineConfig = require('./pipelineConfig');

var log = require('winston');
log.level = 'error';

// ----------------------------------------------------------------------------
// Start up the configuration server.
// ----------------------------------------------------------------------------
pipesConfigServer.listen(pipelineConfig.pipelineConfigServerPort);

if (pipesConfigServer.server) { 
    pipelineConfig.updateServer();
} else {
    throw 'Configuration server not available.';
}

// ----------------------------------------------------------------------------
// Start the pipeline, including two stages, `countStore` and `planStore`.
// ----------------------------------------------------------------------------
import startPipeline = require('./startPipeline');
if (!startPipeline.ready()) { throw 'Pipeline is not ready'; }

// Get pipeline pointed at configuration server at `http://localhost:9000`. The
// configuration server will tell it things like the names of stages, so that
// the `Pipeline` object can broker interactions between stages.
var pipeline = pipes.createPipeline(pipelineConfig.pipelineConfigServerUrl.href);
var restifySessions = new pipes.RestifySessionManager();

// ----------------------------------------------------------------------------
// Start a frontdoor server.
// ----------------------------------------------------------------------------
var server = restify.createServer();

function restifyServerHandler(pipeline: pipes.Pipeline,
                              request: restify.Request,
                              response: restify.Response, next: restify.Next) {
    log.info('Got message from client with paramaters ' +
             JSON.stringify(request.params));
    let operation = request.params.operation;
    let session = restifySessions.add(request, response, next);

    pipeline.send(pipelineConfig.planStoreStage,
        '/lookup/' + operation,
        pipeline.merge(
            request.params,
            {
                operation: operation,
                session: session,
                initialNode: pipelineServer.myUrl.href
            }));
}

// Set up the front door's routes.
server.post(
    '/api/:operation',
    (req, res, next) => restifyServerHandler(pipeline, req, res, next));
server.get(
    '/api/:operation',
    (req, res, next) => restifyServerHandler(pipeline, req, res, next));

// Start listening.
server.listen(pipelineConfig.frontdoorRestPort);
log.info("REST interface listening on", pipelineConfig.frontdoorRestPort);

// ----------------------------------------------------------------------------
// Create a pipeline server for the results.
// ----------------------------------------------------------------------------
var pipelineServer = pipeline.createServer('frontdoorStage');

// Set up a handler to process results.
pipelineServer.process(
    '/pipeline/result',
    (params, next) => {
        log.info("Got result ", params);
        let result = params && params["result"];
        let sessionId = params && params["session"];
        let session = sessionId && restifySessions.find(sessionId);

        if (!result || !session) {
            log.info('/pipeline/result called improperly');
            return;
        }

        log.info('Send response to HTTP client with body', params["result"]);
        session.response.send(201, params["result"]);
        session.next();
        next();
    });

// Start the server.
pipelineServer.listen(pipelineConfig.frontdoorPort);

log.info("Initial pipeline stage listening on", pipelineConfig.frontdoorPort);

// Tell scripts consuming this file that we're read.
export var ready = true;