import http = require('http');
import restify = require('restify');
import pipelineConfig = require('./pipelineConfig');
import pipeline = require('../pipeline');


// The public server
var server = restify.createServer();

function operation(request: restify.Request, response: restify.Response, next: restify.Next) {
    console.log('Got message from client with paramaters ' + JSON.stringify(request.params));
    var operation = request.params.operation;
    var session = sessions.add(new pipeline.Session(request, response, next));
    
    // Get client to vector to appropriate plan store 
    var client = pipelineConfig.partitionManager.find("planStore").map(operation);
    
    // Forwad message on to the next stage (the Plan Store) with additional params including the session and return address
    client.post('/lookup/' + operation,
        pipeline.MergeObjects(request.params, { operation: operation, session: session, initialStageAddress: pipelineConfig.initialPipeline.address }),
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

var sessions = new pipeline.SessionManager();

var pipelineServer = restify.createServer();

pipelineServer.post('/pipeline/:operation', (request, response, next) => {
    
    pipeline.Stage.HandlePipelineRequest(request, response, next, (params) => {
        var session = sessions.find(params["session"]);
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

server.listen(pipelineConfig.initialPublic.port);
console.log("REST interface listening on " + pipelineConfig.initialPublic.port);

pipelineServer.listen(pipelineConfig.initialPipeline.port);
console.log("Initial pipeline stage listening on " + pipelineConfig.initialPipeline.port);

// Start the rest of the pipeline
pipelineConfig.start();