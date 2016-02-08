import restify = require("restify");
import URL = require("url");


var lastSessionId = 0;

export class Session {
    public request: restify.Request;
    public response: restify.Response;
    public next: restify.Next;
    public started: Date;
    public id: string;
    private nextSessionId(): number { return ++lastSessionId; }

    constructor(request, response, next) {
        this.request = request;
        this.response = response;
        this.next = next;
        this.started = new Date(Date.now());
        this.id = this.nextSessionId().toString();
    }
}

export class SessionManager {
    public add(session: Session): string { this.sessions[session.id] = session; return session.id; }
    public find(sessionId: string): Session { return this.sessions[sessionId]; }
    sessions: { [key: string]: Session } = {};
}

export var sessions = new SessionManager();

export class PipelineClient implements restify.Client {
    public url: URL.Url;
    private implementation: restify.Client;
    // Just a passthrough to the implementation
    public get(path: string, callback?: (err: any, req: restify.Request, res: restify.Response, obj: any) => any): any { return this.implementation.get(path, callback); }
    public head(path: string, callback?: (err: any, req: restify.Request, res: restify.Response) => any): any { return this.implementation.head(path, callback); }
    public post(path: string, object: any, callback?: (err: any, req: restify.Request, res: restify.Response, obj: any) => any): any { return this.implementation.post(path, object, callback); }
    public put(path: string, object: any, callback?: (err: any, req: restify.Request, res: restify.Response, obj: any) => any): any { return this.implementation.put(path, object, callback); }
    public del(path: string, callback?: (err: any, req: restify.Request, res: restify.Response) => any): any { return this.implementation.del(path,callback); }
    public basicAuth(username: string, password: string): any { return this.implementation.basicAuth(username, password); }
    constructor(url : URL.Url, client: restify.Client)
    {
        this.url = url;
        this.implementation = client;
    }
}
export class ClientManager {
    public find(location: string): PipelineClient {
        var url = URL.parse(location);
        var clientAddress = url.protocol + '//' + url.host
        if (!this.clients[clientAddress]) {
            this.clients[clientAddress] = new PipelineClient(url,restify.createJsonClient({ url: clientAddress }));
        }
        return this.clients[clientAddress];
    }
    clients: { [key: string]: PipelineClient } = {};
}

export var clients = new ClientManager();


export interface StageParameters {
    [key: string]: Object;
    session: string;
    initialStageAddress?: string;
    stages?: Stage[];
    trace?: string[];
}

//TODO no good reason to have the HandlePipelineRequest and Process be static on Stage.  Just make it module top-level and it cleans up the syntax to use it.

export class Stage {
    public url: string;
    public path: string;
    public params: Object;

    public static Process(params: Object, stages: Stage[]) {
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


export class PartitionMapper {
    public mapper: (Object) => restify.Client;
    public map(entity: Object): restify.Client {
        return this.mapper(entity);
    }
    constructor(mapper: (Object) => restify.Client) {
        this.mapper = mapper;
    }
}

export class PartitionManager {
    public find(name: string): PartitionMapper {
        return this.partitions[name];
    }
    public add(name: string, partition: PartitionMapper) {
        this.partitions[name] = partition;
    }
    partitions: { [key: string]: PartitionMapper } = {};
}

export var partitionManager = new PartitionManager();


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

