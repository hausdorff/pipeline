import restify = require("restify");

var log = require('winston');
log.level = 'error';


// Simple service schema declaration.
let serviceSchema = [
    {
        name: "Hello"
    }
];


// ----------------------------------------------------------------------------
// Configuration.
// ----------------------------------------------------------------------------

let sbHost: string = "http://127.0.0.1:8000";

let cacheStageHost: string = "http://127.0.0.1:8001";
let cacheStageId: string = "CacheStage";
let cacheStageResouce: string = "/lookup/cache";

let dbStageHost: string = "http://127.0.0.1:8002";
let dbStageId: string = "DbStage";
let dbStageResouce: string = "/lookup/database";

let processingStageHost: string = "http://127.0.0.1:8003";
let processingStageId: string = "ProcessingStage";
let processingStageResouce: string = "/lookup/cache";


// ----------------------------------------------------------------------------
// Simple service broker.
// ----------------------------------------------------------------------------

type K<T> = (sb: ServiceBrokerClient, stage: T, params: any) => void;
type Selector = (ips: string[]) => string;

class ServiceBrokerClient {
    constructor() {
        this.stages[cacheStageId] = [
            [cacheStageHost],
            cacheStageResouce,
            this.cacheStage];
        this.stages[dbStageId] = [
            [dbStageHost],
            dbStageResouce,
            this.dbStage];
        this.stages[processingStageId] = [
            [processingStageHost],
            processingStageResouce,
            this.processingStage];
    }

    public resolve(id: string): [string[], string, Stage] {
        return this.stages[id];
    }

    // TODO: store the groups of machines that each stage consists of, so that
    // the `Selector` to can select one.
    // TODO: add a RESTify client that will POST to the other stages.
    private cacheStage = new CacheStage(cacheStageHost, this);
    private dbStage = new DbStage(dbStageHost, this);
    private processingStage = new ProcessingStage(processingStageHost, this);

    private stages: { [id: string]: [string[], string, Stage] } = { };
}


// ----------------------------------------------------------------------------
// Helper functions.
// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------
// Stage boilerplate.
// ----------------------------------------------------------------------------

abstract class Stage {
    constructor(private route: string, sbc: ServiceBrokerClient) {
        this.server = restify.createServer({});
        this.server.use(restify.bodyParser({ mapParams: true }));

        this.server.post(
            route,
            (req, res, next) => {
                res.send(201);

                let code = req.params.code;
                let params = req.params;

                delete params.code;

                if (code) {
                    this.handleCode(code, params, this.sbc);
                }

                return next();
            });
    }

    public callcc<T extends Stage>(k: K<T>, params: any, id: string,
                                   sbc: ServiceBrokerClient) {
        return this.callccSelector<T>(k, ss => ss[0], params, id, sbc);
    }

    public callccSelector<T extends Stage>(k: K<T>, s: Selector,
                                           parameters: any, id: string,
                                           sbc: ServiceBrokerClient) {
        // TODO: do stuff here.
        let [hosts, resource, stage] = sbc.resolve(id);

        let params = this.merge(
            parameters,
            !k ? {} : { code: k.toString() });

        // POST response.
        this.client.post(
            this.route,
            params,
            (err, req, res, obj) => {
                if (err) {
                    log.info('Error sending to ', this.route);
                    throw 'Send error';
                }
                if (res.statusCode == 201) {
                    log.info('Request complete for', sbHost, this.route);
                    // very important - do nothing... the response will be sent
                    // back via the pipeline. This is just acknowlegement that
                    // the next stage got the request.  
                } else {
                    log.info('not sure why we are here in send');
                }
            });
    }

    private handleCode(code: string, params: Object, sbc: ServiceBrokerClient) {
        if (!code) return;

        try {
            // Wrap function in something with parameters that have known names,
            // so that we can call it easily.
            var f = eval("(function (sbc, stage, params) { var f = " +
                         code + "; f(sbc, stage, params); })");

            f(sbc, this, params);
        } catch (err) {
            log.info('Could not eval ', code);
            throw 'Code evaluation error';
        }
    }

    private merge(... args : Object[]) : Object {
        args.unshift({});
        return objectAssign.apply(null, args);
    }

    private client: restify.Client = restify.createJsonClient({url: sbHost});
    private server: restify.Server;
    private sbc: ServiceBrokerClient;
}


// ----------------------------------------------------------------------------
// Stages.
// ----------------------------------------------------------------------------

class CacheStage extends Stage {
    public has(k: string): boolean {
        return !(typeof this.store[k] === "undefined");
    }

    public get(k: string): string { return this.store[k]; }

    public set(k: string, v: string): boolean {
        this.store[k] = v;
        return true;
    }

    private store: { [k: string]: string; } = { };
}

class DbStage extends Stage {
    public getThing(k: string): string {
        return "cow";
    }
}

class ProcessingStage extends Stage {
    public doThing(v: string) {
        console.log("PROCESSING: " + v);
    }
}


// ----------------------------------------------------------------------------
// Application logic, continuation-passing style!
// ----------------------------------------------------------------------------

let getAndProcess = (sbc: ServiceBrokerClient, cs: CacheStage, params: any) => {
    let k: string = "your_favorite_key";
    if (cs.has(k)) {
        cs.callcc<ProcessingStage>(processData, cs.get(k), "ProcessingStage",
                                   sbc);
    } else {
        cs.callcc<DbStage>(getFromDbAndCache, k, "DbStage", sbc);
    }
};

let getFromDbAndCache = (sbc: ServiceBrokerClient, dbs: DbStage,
                         params: any) => {
    let v = dbs.getThing("your_favorite_key");

    // Send data back to caching layer. NOTE: We'll want to be able to get `k`
    // from the closure if this function was a function literal.
    dbs.callcc<CacheStage>(
        (sbc, cs, p) => { cs.set(params, v); },
        {},
        "CacheStage",
        sbc);
};

let processData = (sb: ServiceBrokerClient, pss: ProcessingStage,
                   params: any) => {
    // TODO: retrieve data from cache, put into this call here.
    pss.doThing("put data here");
};


// ----------------------------------------------------------------------------
// Tests.
// ----------------------------------------------------------------------------

import chai = require('chai');
var expect = chai.expect;

// Placeholder tests.
describe('Test classname', () => {

    describe('2 + 4', () => {
        it('should be 6', (done) => {
            expect(2+4).to.equals(6);
            done();
        });
    });
});

