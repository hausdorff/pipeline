import restify = require("restify");
import URL = require("url");

var defaultMap = (nodes : string[], params) => nodes[0]; // default just takes the first node

export class Pipeline {
    public lastSessionId = 0;
    public restifySessions = new RestifySessionManager(); // only used by pipeline stages that have a restify server running
    public clients = new ClientManager();
    public config = new StageManager();
    public configServer : restify.Client;
         
    public send(stageName: string, path: string, parameters: any, code? : (params : any,next : ()=>void)=> void) {
        var client = this.config.find(stageName).map(parameters);
        var params = MergeObjects({}, parameters, !code ? {} : { code: code.toString() });
        
        console.log('Sending to', stageName, 'with address', client.url.href, 'and parameters\r\n', params);
        client.send(path, params, (err) => { 
            throw err; 
        });
    }
    
    public sendToNode(address: string, path: string, parameters: any, code? : (params : any,next : ()=>void)=> void) {
        var client = this.clients.find(address);
        var params = MergeObjects({}, parameters, !code ? {} : { code: code.toString() });
        
        console.log('Sending to node with address', client.url.href, 'and parameters\r\n',params)
        client.send(path, params, (err) => { 
            throw err; 
        });
    }

    public execute(stageName: string, parameters: any, code: (params : any,next : ()=>void)=> void) {
        this.config.find(stageName).map(parameters).send('/pipeline/execute', MergeObjects({}, parameters, { code: code.toString() }), (err) => { throw err; });
    }
    
    public createServer(stageName: string) : PipelineServer {         
        return new PipelineServer(this, stageName); 
    }
        
    public loadConfiguration() {
        this.configServer.get('/config',(err,req,res,obj) => {
           if (err) throw err;
           
           Object.keys(obj).forEach((key)=>{
               var addressMap = defaultMap;
               try { addressMap = eval('(' + obj[key].map +  ')')} catch (err) {}
               var map = (nodes : string[], params : any) : PipelineClient => {
                   return this.clients.find(addressMap(nodes,params));
               }
               this.config.add(key,new Stage(key, obj[key].nodes, map));
           }); 
        });  
    }
    
    constructor(configurationUrl: URL.Url) {
        this.configServer = restify.createJsonClient({url: configurationUrl.href});
        this.loadConfiguration();
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
            if (err) { console.log('Error sending to ', path); throw 'Send error'; }
            if (res.statusCode == 201) {
                // very important - do nothing... the response will be sent back via the pipeline.  This us just acknowlegement that the next stage got the request.  
            } else {
                console.log('not sure why we are here in send');
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

export class Stage {
    public name : string;
    public nodes : string[] = [];
    public mapper: (nodes : string[], params : Object) => PipelineClient;
    public map(parameters: Object): PipelineClient {
        return this.mapper(this.nodes,parameters);
    }
    constructor(name : string, nodes : string[], mapper: (nodes : string[], params : Object) => PipelineClient) {
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
    private implementation: restify.Server;
    private pipeline: Pipeline;
    public stageName: string;
    public myUrl: URL.Url = null;
    public port: string;

    private handleCode(code: string, params: Object, next: () => void) {
        if (!code) return;
        try {
            var f = eval("(function (pipeline, params, next) { var f = " + code + "; f(params, next); })");
            f(this.pipeline, params, next);
        } catch (err) { console.log('Could not eval ', code); throw 'Code evaluation error'; }
    }

    public process(route: string, handler: (params: Object, next: () => void) => void) {
        this.implementation.post(route, (req, res, next) => {
            var code = req.params.code;
            var params = req.params;
            delete params.code;
            handler(params, () => { this.handleCode(code, params, next); });
        });
        this.implementation.get(route, (req, res, next) => {
            var code = req.params.code;
            var params = req.params;
            delete params.code;
            handler(params, () => { this.handleCode(code, params, next); });
        });
    }

    constructor(pipeline: Pipeline, stageName: string) {
        this.pipeline = pipeline;
        this.stageName = stageName;
        var serverOptions = {};
        this.implementation = restify.createServer(serverOptions);
        this.implementation.use(restify.bodyParser({ mapParams: true }));
    }

    public notifyConfigServerOfAvailablityAndGetAddress() {
        this.pipeline.configServer.post('/stages/' + this.stageName + '/nodeReady', { stage: this.stageName, port: this.port }, (err, req, res, obj) => {
            if (res.statusCode !== 201) { throw "Failed to register with configuration service"; }
            console.log('Setting ' + this.stageName + ' pipeline server address to ' + obj.address);
            this.myUrl = URL.parse(obj.address);
        });
    }

    public listen(...args: any[]) {
        this.port = args[0];
        this.implementation.listen.apply(this.implementation, args);
        this.notifyConfigServerOfAvailablityAndGetAddress();
    }
}

export function MergeJsonData(start: Object, json: string): Object {
    var result = Object.keys(start).reduce((previous, key) => { previous[key] = start[key]; return previous }, {});
    var data = {}
    try { data = JSON.parse(json) } catch (err) { console.log('Error parsing json data'); }
    Object.keys(data).forEach((key) => { result[key] = data[key]; });
    return result;
}

export function MergeObjects(output: Object, ...args: Object[]): Object {
    for (var index = 0; index < args.length; index++) {
        var source = args[index];
        if (source !== undefined && source !== null) {
            Object.keys(source).forEach((key) => {
                output[key] = source[key];
            });
        }
    }
    return output;
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
      