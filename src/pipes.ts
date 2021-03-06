import restify = require("restify");
import URL = require("url");

var log = require('winston');
log.level = 'error';


//
// Common.
//

var defaultMap = (nodes : string[], params) => nodes[0]; // default just takes the first node

type Continuation = (params: any, next: () => void) => void;

//
// Pipeline Server.
//

type PipelineRequestHandler = (handlerParams: any, handlerNext: () => void) => void;

/**
 * The unit of work in a pipeline: this server executes continuations that are
 * passed to it. You can bind different continuations to different URI
 * resources, so that a resource like `/pipeline/:operation` can have its own
 * continuation processing logic, apart from other resources.
 */
export class PipelineServer {
    public myUrl: URL.Url = null;
    public port: string;

    private implementation: restify.Server;

    constructor(private pipeline: Pipeline,
                public stageName: string) {
        let serverOptions = {};
        this.implementation = restify.createServer(serverOptions);
        this.implementation.use(restify.bodyParser({ mapParams: true }));
    }

    /**
     * Binds a URI resource `route` (e.g., `/pipeline/:operation`) to be
     * processed with a request `handler`. The `handler` is responsible for
     * processing continuations that are passed to it.
     * 
     * @param route   A resource to bind the request handler to. ex:
     *                `/pipeline/:operation`
     * @param handler Processes continuations send to the `route`.
     */
    public process(route: string, handler: PipelineRequestHandler) {
        this.implementation.post(
            route,
            (req, res, next) => {
                res.send(201);
                let code = req.params.code;
                let params = req.params;
                delete params.code;
                handler(
                    params,
                    () => { 
                        if (code) { this.handleCode(code, params, next); }
                        else { next(); }
                    });
            });

        this.implementation.get(
            route,
            (req, res, next) => {
                let code = req.params.code;
                let params = req.params;
                delete params.code;
                handler(
                    params,
                    () => {
                        if (code) { this.handleCode(code, params, next); }
                        else { next(); }
                    });
            });
    }

    /**
     * Cause the server to start listening for continuations to process.
     * 
     * @param args The arguments passed to the underlying server
     *             implementation. Often something like:
     *             `pipelineServer.listen(yourPortHere)`.
     */
    public listen(...args: any[]) {
        this.port = args[0];
        this.implementation.listen.apply(this.implementation, args);
        this.notifyConfigServerOfAvailablityAndGetAddress();
    }

    private notifyConfigServerOfAvailablityAndGetAddress() {
        // HACK: POST to the config server and get addresss back. This is due // to a limitation in node -- it is hard to get your own IP.
        this.pipeline.configServer.post(
            '/stages/' + this.stageName + '/nodeReady',
            { stage: this.stageName, port: this.port },
            (err, req, res, obj) => {
                if (res.statusCode !== 201) {
                    throw "Failed to register with configuration service";
                }

                log.info('Setting ' + this.stageName +
                         ' pipeline server address to ' + obj.address);

                this.myUrl = URL.parse(obj.address);
            });
    }

    private handleCode(code: string, params: Object, next: restify.Next) {
        if (!code) return;

        try {
            var f = eval("(function (pipeline, params, next) { var f = " +
                         code + "; f(params, next); })");

            f(this.pipeline, params, next);
        } catch (err) {
            log.info('Could not eval ', code);
            throw 'Code evaluation error';
        }
    }
}


//
// Pipeline.
//

/**
 * Brokers the interaction between a set of stages, which collectively form a
 * "pipeline" that is meant to process some request. The topology of the
 * network is completely up to the user: the stages can be organized into a
 * series of stages executing one after another, or they can form complex
 * cyclical graphs.
 */
export class Pipeline {
    public broker = new ServiceBroker();

    public clients = new ClientManager();
    public configServer: restify.Client;

    /**
     * Instantiates a Pipeline. The configuration server found at the URL
     * supplied to this constructor will allow this Pipeline to discover the
     * things it needs to broker messages passed between stages: information
     * like the names of the stages, and the stage-specific "mapping" function
     * that allows other stages to select a machine from a stage to send
     * messages to.
     * 
     * @param configurationServer The URL of the pipeline configuration server.
     */
    constructor(configurationServer: URL.Url) {
        this.configServer = restify.createJsonClient(
            {url: configurationServer.href});
        this.loadConfiguration();
    }

    public merge(... args : Object[]) : Object {
        args.unshift({});
        return objectAssign.apply(null, args);
    }

    public createServer(stageName: string) : PipelineServer {
        return new PipelineServer(this, stageName); 
    }

    /**
     * Forward a continuation to a stage, `stageName`.
     * 
     * @param stageName  The id of the stage to send the continuation to.
     * @param path       The REST resource we will send the continuation to. For
     *                   example, `/pipeline/hello` might expect to recieve a
     *                   continuation that writes "Hello world!" to console.
     * @param parameters The parameters to invoke the continuation with.
     * @param code       The continuation to execute.
     */
    public send(stageName: string, path: string, parameters: any,
                code?: Continuation) {
        // Find stage, select server from that stage to send to.
        let client = this.broker.find(stageName).mapToNode(parameters);
        let params = this.merge(
            parameters,
            !code ? {} : { code: code.toString() });

        log.info('Sending to', stageName, 'with address', client.url.href,
                 'and parameters\r\n', params);

        // Send.
        client.send(path, params, (err) => { throw err; });
    }

    /**
     * Forward a continuation to a node at a specific `address`.
     * 
     * @param stageName  The address of the stage to send the continuation to.
     *                   For example, an IP address, or a domain name.
     * @param path       The REST resource we will send the continuation to. For
     *                   example, `/pipeline/hello` might expect to recieve a
     *                   continuation that writes "Hello world!" to console.
     * @param parameters The parameters to invoke the continuation with.
     * @param code       The continuation to execute.
     */
    public sendToNode(address: string, path: string, parameters: any,
                      code?: Continuation) {
        // Find stage, select server from that stage to send to.
        let client = this.clients.find(address);
        let params = this.merge(
            parameters,
            !code ? {} : { code: code.toString() });

        log.info('Sending to node with address', client.url.href,
                 'and parameters\r\n',params);

        // Send.
        client.send(path, params, (err) => { throw err; });
    }

    /**
     * Forward a continuation to a stage, `stageName`; send the request to the
     * `/pipeline/execute` resource.
     * 
     * @param stageName  The address of the stage to send the continuation to.
     *                   For example, an IP address, or a domain name.
     * @param parameters The parameters to invoke the continuation with.
     * @param code       The continuation to execute.
     */
    public execute(stageName: string, parameters: any, code: Continuation) {
        log.info('Executing to stage', stageName, 'with parameter \r\n',
                 parameters);

        let params = objectAssign({}, parameters, { code: code.toString() });
        this.broker
            .find(stageName)
            .mapToNode(parameters)
            .send('/pipeline/execute', params, (err) => { throw err; });
    }

    private loadConfiguration() {
        this.configServer.get('/config', (err, req, res, obj) => {
            if (err) throw err;

            Object.keys(obj).forEach(key => {
                let addressMap = createFunction(obj[key].map);
                if (!addressMap) { addressMap = defaultMap };
                let map = (nodes: string[], params): PipelineClient => {
                    return this.clients.find(addressMap(nodes, params));
                }
                this.broker.add(key, new Stage(key, obj[key].nodes, map));
            });
        });
    }
}

export class ClientManager {
    private clients: { [key: string]: PipelineClient } = {};

    /**
     * Takes a string representing a URL, parses it, and returns a
     * `PipelineClient` for domain/IP address/name that it points at. For
     * example, if you pass us `http://127.0.0.1:8080`, we will return a
     * `PipelineClient` for the address `127.0.0.1`.
     * 
     * @param  url The string with the URL pointing at a pipeline.
     * @return     A `PipelineClient` for the address of that URL.
     */
    public find(url: string): PipelineClient {
        let parsedUrl = URL.parse(url);
        let clientAddress = parsedUrl.protocol + '//' + parsedUrl.host;

        if (!this.clients[clientAddress]) {
            this.clients[clientAddress] = new PipelineClient(
                parsedUrl,
                restify.createJsonClient({ url: clientAddress }));
        }

        return this.clients[clientAddress];
    }
}

export class PipelineClient /* implements restify.Client */ { // Removing implements restify.Client as this functionality not currently used.
    public url: URL.Url;
    private implementation: restify.Client;

    constructor(url: URL.Url, client: restify.Client) {
        this.url = url;
        this.implementation = client;
    }

    public send(path: string, parameters: Object, error: (any) => void) {
        // Forward message on to the next stage  with additional params including the session and return address
        this.post(path, parameters, (err, req, res, obj) => {
            if (err) { log.info('Error sending to ', path); throw 'Send error'; }
            if (res.statusCode == 201) {
                log.info('Request complete for', this.url.href, path);
                // very important - do nothing... the response will be sent back via the pipeline.  This is just acknowlegement that the next stage got the request.  
            } else {
                log.info('not sure why we are here in send');
            }
        });
    }

    private post(path: string, object: any, callback?: (err: any, req: restify.Request, res: restify.Response, obj: any) => any): any { 
        return this.implementation.post(path, object, callback); 
    }
    
    /* Flexibility to operate as a restify.Client is not needed currently so disabling.   
    // For fexiblity PipelineClient can act as a resitify client
    public get(path: string, callback?: (err: any, req: restify.Request, res: restify.Response, obj: any) => any): any { return this.implementation.get(path, callback); }
    public head(path: string, callback?: (err: any, req: restify.Request, res: restify.Response) => any): any { return this.implementation.head(path, callback); }
    public put(path: string, object: any, callback?: (err: any, req: restify.Request, res: restify.Response, obj: any) => any): any { return this.implementation.put(path, object, callback); }
    public del(path: string, callback?: (err: any, req: restify.Request, res: restify.Response) => any): any { return this.implementation.del(path, callback); }
    public basicAuth(username: string, password: string): any { return this.implementation.basicAuth(username, password); }
    */
}

export function createPipeline(configurationUrl: string): Pipeline {
    return new Pipeline(URL.parse(configurationUrl));
}


//
// Stage.
//

type Mapper = (nodes: string[], params : Object) => PipelineClient;

export class Stage {
    constructor(private name: string,
                private nodes: string[],
                private mapper: Mapper) { }

    /**
     * Selects from a set of possible nodes using the `mapper` function passed
     * into the constructor, and produces a `PipelineClient` for it.
     * 
     * @param  parameters A JSON object containing a miscelleneous bag of
     *                    properties the `mapper` could need to make its
     *                    decision.
     * @return            A `PipelineClient` for the node selected by the
     *                    `mapper` function.
     */
    public mapToNode(parameters: Object): PipelineClient {
        return this.mapper(this.nodes, parameters);
    }
}


//
// Service broker.
//

export class ServiceBroker {
    private stages: { [key: string]: Stage } = {};

    public find(name: string): Stage {
        return this.stages[name];
    }

    public add(name: string, stage: Stage) {
        this.stages[name] = stage;
    }
}


//
// Restify Sesion Manager.
//
// Used by front end restify servers to help when computation is handled by forwarding to a pipeline.
//

export class RestifySession {
    public started: Date;
        
    constructor(public id : string, public request : restify.Request, public response : restify.Response, public next : restify.Next) {
        this.started = new Date(Date.now());
    }
}

export class RestifySessionManager {
    private curentSessionId = 0;
    public add(request : restify.Request, response : restify.Response, next : restify.Next) {
        var session = new RestifySession((this.curentSessionId++).toString(), request, response, next); 
        this.sessions[session.id] = session; return session.id; }
    public find(sessionId: string): RestifySession { return this.sessions[sessionId]; }
    private sessions: { [key: string]: RestifySession } = {};
}


//
// Helper functions.
//

function objectAssign(output: Object, ...args: Object[]): Object {  // Provides ES6 object.assign functionality
    for (let index = 0; index < args.length; index++) {
        var source = args[index];
        if (source !== undefined && source !== null) {
            Object.keys(source).forEach((key) => {
                output[key] = source[key];
            });
        }
    }
    return output;
}

export function createFunction(code: string): (...args: any[]) => any {
    var f = null;
    if (!code) return f;
    try {
        f = eval('(' + code + ')');  // could consider parsing the code for paramaters and then using new Function... probably safer.
    }
    catch (err) { log.info('Could not eval ', code); throw 'Code evaluation error'; }
    return f;
}