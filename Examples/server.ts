import http = require('http');
import restify = require('restify');
import pipes = require('../pipes');
import pipelineConfig = require('./pipelineConfig');
import pipelineConfigServer = require('./pipelineConfigServer');

console.log("Starting. ConfigServer does not exist is " + !pipelineConfigServer.server);
var pipeline = pipes.createPipeline(pipelineConfig.pipelineConfigServerUrl.href);

// Start a vanilla restify server that send messages to a pipeline

var server = restify.createServer();

function restifyServerHandler(pipeline: pipes.Pipeline, request: restify.Request, response: restify.Response, next: restify.Next) {
    console.log('Got message from client with paramaters ' + JSON.stringify(request.params));
    var operation = request.params.operation;
    var session = pipeline.restifySessions.add(request, response, next);

    pipeline.send('lookup',
        '/lookup/' + operation,
        pipes.MergeObjects(request.params, { operation: operation, session: session, initialNode: pipelineServer.myUrl.host }));
}

server.post('/api/:operation', (req, res, next) => restifyServerHandler(pipeline, req, res, next));
server.get('/api/:operation', (req, res, next) => restifyServerHandler(pipeline, req, res, next));

server.listen(pipelineConfig.frontdoorRestPort);
console.log("REST interface listening on " + pipelineConfig.frontdoorRestPort);

// Instantiate a pipeline server that will listen on /pipeline/result and send the result to the client.

var pipelineServer = pipeline.createServer('frontdoorStage');

pipelineServer.process('/pipeline/result', (params) => {
    var result = params && params["result"];
    var sessionId = params && params["session"];
    var session = sessionId && this.pipeline.restifySessions.find(params[sessionId]);

    if (!result || !session) { console.log('/pipeline/result called improperly'); return; }

    console.log('Send response to HTTP client with body ' + params["result"]);
    session.response.send(201, params["result"]);
    session.next();
});

pipelineServer.listen(pipelineConfig.frontdoorPort);
console.log("Initial pipeline stage listening on " + pipelineConfig.frontdoorPort);

