import http = require('http');
import restify = require('restify');

var serverPort = 8080;
var pipelinePort = 8082;
var planStoreServerPort = 8083;

var thisStage = "http://localhost:" + pipelinePort;
var planStoreUrl = "http://localhost:" + planStoreServerPort;
var countStoreUrl = "http://localhost:8084";
var executeUrl = "http://localhost:8085";

var server = restify.createServer();
var pipeline = restify.createServer();

var planStoreStage = restify.createStringClient({ url: planStoreUrl });
var countStoreStage = restify.createStringClient({ url: countStoreUrl });
var executeStage = restify.createStringClient({ url: executeUrl });

interface session {
    request: restify.Request;
    response: restify.Response;
    next: restify.Next;
    started: Date;
}

var session = 0;
var sessions: { [sessionId: string]: session } = {};

function operation(request: restify.Request, response: restify.Response, next: restify.Next) {
    console.log('Got message from client with operation ' + request.params.operation + ' and paramaters \r\n' + JSON.stringify(request.params));
    var operation = request.params.operation;
    sessions[session.toString()] = { request: request, response: response, next: next, started: new Date(Date.now()) };
    planStoreStage.post('/lookup/' + operation, { operation: operation, session: session, initialStageAddress: thisStage }, (err, req, res, obj) => {
        if (res.statusCode == 201) {
            // do nothing... the response will be sent back via the pipeline.  
        } else {
            next(err);
        }
    });
}

server.post('/api/:operation', operation);
server.get('/api/:operation', operation);

pipeline.post('/pipeline/:operation', (request, response, next) => {
    console.log('Got message from pipeline with operation ' + request.params.operation);
    request.on('data', (chunk) => {
        console.log('data is \r\n' + JSON.stringify(chunk.toString()));
        var params = null;
        try {
            params = chunk.toString().split('&')
                .map((kv) => kv.split('='))
                .reduce((r, kvp) => { r[kvp[0]] = !kvp[1] ? true : kvp[1]; return r; }, {});
        } catch (err) { console.log('Error parsing request.'); }
        console.log('parsed as ' + JSON.stringify(params));

        var session = sessions[params.session];
        if (!session) {
            console.log('No session found for ' + params.session);
            return next(new restify.InternalServerError("No session in pipeline operation"));
        }
        if (request.params.operation == 'result') {
            session.response.send(201, params.result);
            session.next();
            return next();
        } else if (request.params.operation == 'error') {
            session.response.send(201, 'complete');
            session.next(new restify.InternalServerError(request.params.error));
            return next();
        }
    });
});

server.listen(serverPort);
pipeline.listen(pipelinePort);

// The following would normally be running on other servers

interface Stage {
    url: string,
    path: string,
    params: Object
}

function ProcessNextStage(stages: Stage[], params: Object) {
    if (stages.length == 0) return;
    var current = stages.shift();
    var currentClient = restify.createStringClient({ url: current.url });

    Object.keys(current.params).forEach((key) => params[key] = current.params[key]);
    params["stages"] = stages;
    console.log ('Sending to ' + current.url + current.path + ' ' + JSON.stringify(params));
    currentClient.post(current.path, params, (error, request, response, result) => {
        if (response.statusCode != 201) {
            console.log('Error sending to ' + current.url + current.path);
        }
    });
}

var planStoreServer = restify.createServer();

planStoreServer.post('/lookup/:operation', (request, response, next) => {
    var operation = request.params.operation;
    console.log("Lookup plan for " + operation);
    request.on('data', (chunk) => {
        var params = Object.keys(request.params).reduce((previous,key) => { previous[key] = request.params[key]; return previous; },{});
        try {
            params = chunk.toString().split('&')
                .map((kv) => kv.split('='))
                .reduce((r, kvp) => { r[kvp[0]] = !kvp[1] ? true : kvp[1]; return r; }, {});
        } catch (err) { console.log('Error parsing request.'); }
        console.log('plan parameters '+ JSON.stringify(params));
        if (operation ==  'currentCount') {
            var stages: Stage[] = [
                { url: countStoreUrl, path: '/currentCount', params: { resultName: "count" } },
                { url: executeUrl, path: '/execute', params: { code: "return 'Hello ' + count", resultName: "result" } },
                { url: request.params.resultStageUrl, path: '/pipeline/result', params: { code: "return 'Current count is ' + count", resultName: "result" } }
            ];
            ProcessNextStage(stages, request.params);
        } else if (operation == 'hello') {
            var initialStage = params["initialStageAddress"];
            if (!initialStage) { throw "No initial stage address"; }
            ProcessNextStage([
                { url: initialStage, path: '/pipeline/result', params: { result: "Hello World!"  } }
            ], params);
        }
        response.send(201);
        next();
    });
});

planStoreServer.listen(planStoreServerPort);
