import restify = require("restify");
import URL = require("url");
import net = require('net');

export class Pipeline {
    public lastSessionId = 0;
    public restifySessions = new RestifySessionManager(); // only used by pipeline stages that have a restify server running
    public clients = new ClientManager();
    public config = new StageManager();
    public configServer : restify.Client;
         
    public send(stageName: string, path: string, parameters: any, code? : (any)=> void) {
        this.config.find(stageName).map(parameters).send(path, MergeObjects({}, parameters, code ? {} : { code: code.toString() }), (err) => { throw err; });
    }

    public execute(stageName: string, parameters: any, code: (params: any) => void) {
        this.config.find(stageName).map(parameters).send('/pipeline/execute', MergeObjects({}, parameters, { code: code.toString() }), (err) => { throw err; });
    }
    
    public createServer(stageName: string) : PipelineServer {
         
        return new PipelineServer(this, stageName); 
    }
    
    public loadConfiguration() {
        this.configServer.get('/config',(err,req,res,obj) => {
           if (err) throw err;
           Object.keys(obj).forEach((key)=>{
               this.config.add(key,new Stage(key, obj[key].nodes, obj[key].map))
           }); 
        });  
    }
    
    constructor(configurationUrl: URL.Url) {
        this.configServer = restify.createJsonClient({url: configurationUrl.href});
    }
}

export function createPipeline(configurationUrl: string): Pipeline {
    return new Pipeline(URL.parse(configurationUrl));
}

export class RestifySession {
    public request: restify.Request;
    public response: restify.Response;
    public next: restify.Next;
    public started: Date;
    public id: string;
    
    constructor(sessionId : string, request : restify.Request, response : restify.Response, next : restify.Next) {
        this.request = request;
        this.response = response;
        this.next = next;
        this.started = new Date(Date.now());
        this.id = sessionId;
    }
}

export class RestifySessionManager {
    private curentSessionId = 0;
    public add(request : restify.Request, response : restify.Response, next : restify.Next) {
        var session = new RestifySession((this.curentSessionId++).toString(), request, response, next); 
        this.sessions[session.id] = session; return session.id; }
    public find(sessionId: string): RestifySession { return this.sessions[sessionId]; }
    sessions: { [key: string]: RestifySession } = {};
}

export class PipelineClient implements restify.Client {
    public url: URL.Url;
    private implementation: restify.Client;

    public send(path: string, parameters: Object, error: (any) => void) {
        // Forward message on to the next stage  with additional params including the session and return address
        this.post(path, parameters, (err, req, res, obj) => {
            if (res.statusCode == 201) {
                // very important - do nothing... the response will be sent back via the pipeline.  This us just acknowlegement that the next stage got the request.  
            } else {
                error(err);
            }
        });
    }

    constructor(url: URL.Url, client: restify.Client) {
        this.url = url;
        this.implementation = client;
    }
    
    // For fexiblity also passes through to the resitify client implementation
    public get(path: string, callback?: (err: any, req: restify.Request, res: restify.Response, obj: any) => any): any { return this.implementation.get(path, callback); }
    public head(path: string, callback?: (err: any, req: restify.Request, res: restify.Response) => any): any { return this.implementation.head(path, callback); }
    public post(path: string, object: any, callback?: (err: any, req: restify.Request, res: restify.Response, obj: any) => any): any { return this.implementation.post(path, object, callback); }
    public put(path: string, object: any, callback?: (err: any, req: restify.Request, res: restify.Response, obj: any) => any): any { return this.implementation.put(path, object, callback); }
    public del(path: string, callback?: (err: any, req: restify.Request, res: restify.Response) => any): any { return this.implementation.del(path, callback); }
    public basicAuth(username: string, password: string): any { return this.implementation.basicAuth(username, password); }
}

export class ClientManager {
    public find(location: string): PipelineClient {
        var url = URL.parse(location);
        var clientAddress = url.protocol + '//' + url.host
        if (!this.clients[clientAddress]) {
            this.clients[clientAddress] = new PipelineClient(url, restify.createJsonClient({ url: clientAddress }));
        }
        return this.clients[clientAddress];
    }
    clients: { [key: string]: PipelineClient } = {};
}

export interface StageParameters {
    [key: string]: Object;
    session: string;
    initialStageAddress?: string;
    stages?: OldStageToDelete[];
    trace?: string[];
}

export class OldStageToDelete {
    public url: string;
    public path: string;
    public params: Object;

    public static Process(params: Object, stages: OldStageToDelete[]) {
        if (stages.length == 0) return;
        var current = stages.shift();
        var currentClient = restify.createJsonClient({ url: current.url });  //TODO: Should maintain a map based on address instead of creating each time.
        Object.keys(current.params).forEach((key) => params[key] = current.params[key]);
        params["stages"] = stages;
        console.log('Sending to ' + current.url + current.path + ' ' + JSON.stringify(params));
        currentClient.post(current.path, params, (error, request, response, result) => {
            if (response.statusCode != 201) {
                console.log('Error sending to ' + current.url + current.path);
            }
        });


    }

    public static HandlePipelineRequest(request: restify.Request, response: restify.Response, next: restify.Next, callback: (parameters: StageParameters) => void) {

        request.on('data', (chunk) => {
            var params = <StageParameters>MergeObjects(MergeJsonData({}, chunk.toString()), request.params);
            console.log('Pipeline request paramaters ' + JSON.stringify(params));
            if (!params["session"] && !params["initialStageAddres"]) { console.log("Pipeline stage called without sessionId or initialStageAddress"); }
            callback(params);
        });

        request.on('end', () => {
            response.send(201);
            next();
        });
    }
}

export class Stage {
    public name : string;
    public nodes : string[] = [];
    public mapper: (Object) => PipelineClient;
    public map(parameters: Object): PipelineClient {
        return this.mapper(parameters);
    }
    constructor(name : string, nodes : string[], mapper: (Object) => PipelineClient) {
        this.name = name;
        this.nodes = nodes;
        this.mapper = mapper;
    }
}

export class StageManager {
    public find(name: string): Stage {
        return this.stages[name];
    }
    public add(name: string, stage: Stage) {
        this.stages[name] = stage;
    }
    stages: { [key: string]: Stage } = {};
}

export class PipelineServer {
    private implementation : restify.Server;
    private pipeline : Pipeline;
    public stageName : string;
    public myUrl : URL.Url = null;
    public port : string;
        
    public process(route : string, handler : (params : Object, next? : () => void) => void) {        
        this.implementation.post(route, (req, res) => {
            var code = req.params.code;
            handler(req.params, ()=> { if (code) { eval(code); }});
        });       
        this.implementation.get(route, (req, res) => { 
            var code = req.params.code;
            handler(req.params, ()=> { if (code) { eval(code); }});
        });
    }
    
    constructor(pipeline : Pipeline, stageName : string) {
        this.pipeline = pipeline;
        this.stageName = stageName;
        var serverOptions = {};
        this.implementation = restify.createServer(serverOptions);
    }
    
    public listen(... args : any[]) {
        this.port = args[0];
        this.implementation.listen.apply(this.implementation,args);
        this.pipeline.configServer.post('/stages/' + this.stageName + '/addNode', { stage : this.stageName, port : args[0]}, (err, req, res, obj) => {
            if (res.statusCode !== 201) { throw "Failed to register with configuration service"; }
            this.myUrl = URL.parse(obj.address);
        });
    }    
}

export function MergeJsonData(start: Object, json: string): Object {
    var result = Object.keys(start).reduce((previous, key) => { previous[key] = start[key]; return previous }, {});
    var data = {}
    try { data = JSON.parse(json) } catch (err) { console.log('Error parsing json data'); }
    Object.keys(data).forEach((key) => { result[key] = data[key]; });
    return result;
}

export function MergeObjects(start: Object, next: Object, ...more: Object[]): Object {
    var result = Object.keys(start).reduce((previous, key) => { previous[key] = start[key]; return previous }, {});
    Object.keys(next).forEach((key) => { result[key] = next[key]; });
    if (more.length > 0) { return (result, more.shift(), more) }
    return result;
}

export function NameValues(data: string): Object {
    var result = {};
    try {
        result = data.split('&')
            .map((kv) => kv.split('='))
            .reduce((r, kvp) => {
                if (kvp[0]) r[kvp[0]] = !kvp[1] ? true : kvp[1];
                return r;
            }, {});
    } catch (err) { console.log('Error parsing name/value string.'); }
    return result;
}

