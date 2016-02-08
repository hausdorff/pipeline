import http = require('http');
import restify = require('restify');
import pipelineConfig = require('./pipelineConfig');
import pipeline = require('../pipeline');


// The public server
var server = restify.createServer();

function operation(request: restify.Request, response: restify.Response, next: restify.Next) {
    console.log('Got message from client with paramaters ' + JSON.stringify(request.params));
    var operation = request.params.operation;
    var session = pipeline.sessions.add(new pipeline.Session(request, response, next));
    
    // Get client to vector to appropriate plan store 
    var client = pipeline.partitionManager.find("planStore").map(operation);
    
    // Forwad message on to the next stage (the Plan Store) with additional params including the session and return address
    client.post('/lookup/' + operation,
        pipeline.MergeObjects(request.params, { operation: operation, session: session, initialStageAddress: pipelineConfig.initialPipeline.url.href }),
        (err, req, res, obj) => {
            if (res.statusCode == 201) {
                // very important - do nothing... the response will be sent back via the pipeline.  This us just acknowlegement that the next stage got the request.  
            } else {
                next(err);
            }
        });
}

server.post('/api/:operation', operation);
server.get('/api/:operation', operation);

// the Pipeline interface for this app

var pipelineServer = restify.createServer();

pipelineServer.post('/pipeline/:operation', (request, response, next) => {
    
    pipeline.Stage.HandlePipelineRequest(request, response, next, (params) => {
        var session = pipeline.sessions.find(params["session"]);
        if (params["operation"] == 'result') {
            console.log('Send to client with body ' + params["result"]);                
            session.response.send(201, params["result"]);
            session.next();            
        } 
        
        else if (params["operation"] == 'error') {
            session.next(new restify.InternalServerError(request.params.error));            
        }
    });
});

// Startup the listeners

server.listen(pipelineConfig.initialPublic.url.port);
console.log("REST interface listening on " + pipelineConfig.initialPublic.url.port);

pipelineServer.listen(pipelineConfig.initialPipeline.url.port);
console.log("Initial pipeline stage listening on " + pipelineConfig.initialPipeline.url.port);

// Start the rest of the pipeline

pipelineConfig.start();