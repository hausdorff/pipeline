import restify = require("restify");

var lastSessionId = 1;

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


export interface StageParameters {
    [key: string]: Object;
    session: string;
    initialStageAddress?: string;
    stages?: Stage[];
    trace?: string[];
}

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
            var params = <StageParameters>MergeObjects(MergeJsonData({}, chunk.toString()),request.params);            
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