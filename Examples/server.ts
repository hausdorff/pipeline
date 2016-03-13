import http = require('http');
import restify = require('restify');
import pipes = require('../src/pipes');
import pipesConfigServer = require('../src/pipesConfigurationServer');
import pipelineConfig = require('./pipelineConfig');

var log = require('winston');
log.level = 'error';

pipesConfigServer.listen(pipelineConfig.pipelineConfigServerPort);

if (pipesConfigServer.server) { 
    pipelineConfig.updateServer();
} else {
    throw 'Configuration server not available.';
}

import pipelineManager = require('./pipelineManager');
pipelineManager.confirmServersReady();

var pipeline = pipes.createPipeline(pipelineConfig.pipelineConfigServerUrl.href);
var restifySessions = new pipes.RestifySessionManager();

// Start a vanilla restify server that send messages to a pipeline

var server = restify.createServer();

function restifyServerHandler(pipeline: pipes.Pipeline, request: restify.Request, response: restify.Response, next: restify.Next) {
    log.info('Got message from client with paramaters ' + JSON.stringify(request.params));
    var operation = request.params.operation;
    var session = restifySessions.add(request, response, next);

    pipeline.send(pipelineConfig.planStoreStage,
        '/lookup/' + operation,
        pipes.mergeObjects(request.params, { operation: operation, session: session, initialNode: pipelineServer.myUrl.href }));
}

server.post('/api/:operation', (req, res, next) => restifyServerHandler(pipeline, req, res, next));
server.get('/api/:operation', (req, res, next) => restifyServerHandler(pipeline, req, res, next));

server.listen(pipelineConfig.frontdoorRestPort);
log.info("REST interface listening on " + pipelineConfig.frontdoorRestPort);

// Instantiate a pipeline server that will listen on /pipeline/result and send the result to the client.

var pipelineServer = pipeline.createServer('frontdoorStage');

pipelineServer.process('/pipeline/result', (params, next) => {
    log.info("Got result ", params);
    var result = params && params["result"];
    var sessionId = params && params["session"];
    var session = sessionId && restifySessions.find(sessionId);

    if (!result || !session) { log.info('/pipeline/result called improperly'); return; }

    log.info('Send response to HTTP client with body ' + params["result"]);
    session.response.send(201, params["result"]);
    session.next();
    next();
});

pipelineServer.listen(pipelineConfig.frontdoorPort);
log.info("Initial pipeline stage listening on " + pipelineConfig.frontdoorPort);

export var ready = true;