import restify = require("restify");
import URL = require("url");

var log = require('winston');
log.level = 'error';


// ----------------------------------------------------------------------------
// Configuration.
// ----------------------------------------------------------------------------

let sbHost: string = "127.0.0.1";
let sbPort: string = "9000";
let sbUrl: string = "http://" + sbHost + ":" + sbPort;
let sbResource: string = "/broker/stages"

let cacheStageHost: string = "127.0.0.1";
let cacheStagePort: string = "9001";
let cacheStageUrl: string = "http://" + cacheStageHost + ":" + cacheStagePort;
let cacheStageId: string = "CacheStage";
let cacheStageResource: string = "/lookup/cache";

let dbStageHost: string = "127.0.0.1";
let dbStagePort: string = "9002";
let dbStageUrl: string = "http://" + dbStageHost + ":" + dbStagePort;
let dbStageId: string = "DbStage";
let dbStageResource: string = "/lookup/database";

let processingStageHost: string = "127.0.0.1";
let processingStagePort: string = "9003";
let processingStageUrl: string = "http://" + processingStageHost + ":" + processingStagePort;
let processingStageId: string = "ProcessingStage";
let processingStageResource: string = "/lookup/processing";


// ----------------------------------------------------------------------------
// Simple broker server.
// ----------------------------------------------------------------------------

class ServiceBrokerServer {
    constructor() {
        this.server = restify.createServer({});
        this.server.use(restify.bodyParser({ mapParams: true }));
        this.server.get(sbResource, this.stages);
    }

    public listen(...args: any[]) {
        this.port = args[0];
        this.server.listen.apply(this.server, args);

        log.info("ServiceBrokerServer: listening on port " + this.port +
                 " for resource " + sbResource);
    }

    private stages(req, res, next) {
        res.send("Hello world!");
        return next();
    }

    private port: string
    private server: restify.Server;
}

// ----------------------------------------------------------------------------
// Simple service broker client.
//
// Talks to the `ServiceBrokerServer`, both to discover the types which
// machines which `Stage`s run on, and what types they export.
// ----------------------------------------------------------------------------

type Continuation<T> = (stage: T, params: any) => void;
type Selector = (machines: Machine[]) => Machine
type Machine = { url: string, client: restify.Client };

class ServiceBrokerClient {
    constructor(serviceBrokerServerUrl: string) {
        this.serviceBrokerServerUrl = serviceBrokerServerUrl;
        this.client = restify.createJsonClient({
            url: serviceBrokerServerUrl,
            version: '*'
        });

        this.configure();
    }

    public resolve(id: string): [Machine[], string] {
        return this.stages[id];
    }

    private configure() {
        this.client.get(
            sbResource,
            (err, req, res, obj) => {
                if (err) {
                    log.error("ServiceBrokerClient: error connecting to",
                              "ServiceBrokerServer: ", err);
                }

                log.info("ServiceBrokerClient: Successfully connected to ",
                         "ServiceBrokerServer at: ",
                         this.serviceBrokerServerUrl);
            });

        this.stages[cacheStageId] = [
            [{
                url: cacheStageUrl,
                client: restify.createJsonClient({url: cacheStageUrl})
            }],
            cacheStageResource
        ];
        this.stages[dbStageId] = [
            [{
                url: dbStageUrl,
                client: restify.createJsonClient({url: dbStageUrl})
            }],
            dbStageResource
        ];
        this.stages[processingStageId] = [
            [{
                url: processingStageUrl,
                client: restify.createJsonClient({url: processingStageUrl})
            }],
            processingStageResource
        ];
    }

    private serviceBrokerServerUrl: string;
    private client: restify.Client;
    private stages: { [id: string]: [Machine[], string] } = { };
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
// Stage base class.
//
// Abstract base class all stages inherit from. Contains helpful methods like
// `forward` that make it easy to call the next stage.
//
// Exists on `ServiceBroker`, but typings are downloaded by the `Continuum`
// class, so that the application developer, so they can services and take
// advantage of static analysis tooling like dot completion.
// ----------------------------------------------------------------------------

abstract class Stage {
    constructor(private route: string) {
        this.sbc = new ServiceBrokerClient(sbUrl);
        this.server = restify.createServer({});
        this.server.use(restify.bodyParser({ mapParams: true }));

        this.server.post(
            route,
            (req, res, next) => {
                log.info("stage post listener");
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

    public listen(...args: any[]) {
        this.port = args[0];
        this.server.listen.apply(this.server, args);

        log.info("Stage listening on port " + this.port + " for resource " +
                 this.route);

        // TODO: Add John's hack for getting the current IP here.
    }

    public forward<T extends Stage>(params: any, id: string,
                                    c: Continuation<T>) {
        return this.forwardWithSelector<T>(params, id, ss => ss[0], c);
    }

    public forwardWithSelector<T extends Stage>(parameters: any, id: string,
                                                s: Selector, c: Continuation<T>) {
        let [machines, resource] = this.sbc.resolve(id);
        let machine = s(machines);

        let params = this.merge(
            parameters,
            !c
                ? {}
                : { code: c.toString() });

        // POST response.
        machine.client.post(
            resource,
            params,
            (err, req, res, obj) => {
                if (err) {
                    log.error('Error sending to ', machine.url, resource, ':\n', err);
                    throw 'Send error';
                }
                if (res.statusCode == 201) {
                    log.info('Request complete for', sbHost, resource);
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
            let toEval = "(function (stage, params) { var f = " +
                code.replace(/^ *"use strict";/,"") + "; f(stage, params); })";

            var f = eval(toEval);

            f(this, params);
        } catch (err) {
            log.error("Could not eval '", code, "': ", err);
            throw 'Code evaluation error';
        }
    }

    private merge(... args : Object[]) : Object {
        args.unshift({});
        return objectAssign.apply(null, args);
    }

    private port: string
    private server: restify.Server;
    private sbc: ServiceBrokerClient;
}


// ----------------------------------------------------------------------------
// Stages.
//
// Each stage is a service running on a machine. For example, the `CacheStage`
// might just be a TypeScript class wrapping Redis.
//
// They type of each `Stage` exists on `ServiceBroker`, and can be downloaded
// by the `Continuum` class so that the application developer can take
// advantage of statyc analysis tooling like dot completion.
// ----------------------------------------------------------------------------

class CacheStage extends Stage {
    public has(k: string): boolean {
        log.info("CacheStage.has(" + k + ")");
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
    public static thingWasProcessed: boolean = false; // Used for tests.

    public doThing(v: string) {
        log.info("ProcessingStage: processing data '" + v + "'");

        // Allow tests to verify function ran.
        ProcessingStage.thingWasProcessed = true;
    }
}


// ----------------------------------------------------------------------------
// Application logic, continuation-passing style!
//
// The application developer writes this code, which is transmitted to the
// provisioner, so that it can be run on boxes in the cluster.
// ----------------------------------------------------------------------------

// Runs on `CacheStage`. Checks cache for a key; if present, forwards the value
// on to `ProcessingStage`. If it is not, we forward a request to the database.
function getDataAndProcess(cs: CacheStage, params: any): void {
    if (cs.has(params.key)) {
        let dataToProcess = { value: cs.get(params.key) };

        log.info("CacheStage: Key '" + params.key +
                 "' found; forwarding value '" + dataToProcess.value +
                 "' to processing node");

        cs.forward<ProcessingStage>(dataToProcess, processingStageId,
                                    processData);
    } else {
        log.info("CacheStage: Did not find key '" + params.key +
                 "' in cache; forwarding request to database node");

        cs.forward<DbStage>(params, dbStageId, cacheAndProcessData);
    }
};

// Runs on `DbStage`. Gets value from database, caches it, and forwards that
// data on to `ProcessingStage`.
function cacheAndProcessData(dbs: DbStage, params: any): void {
    let dataToProcess = { value: dbs.getThing(params.key) };

    log.info("DbStage: Retrieved value '" + dataToProcess.value +
             "' for key '" + params.key +
             "'; forwarding to both `CacheStage` and `ProcessingStage`");

    // Send data back to both the caching stage and the processing stage.
    //
    // NOTE: We'll want to replace the "bogus_value_for_now" below with v when
    // we get Babel integration and can finally lift the environment out and
    // serialize that too.
    dbs.forward<CacheStage>(
        dataToProcess,
        cacheStageId,
        (cs, p) => { cs.set(params, "bogus_value_for_now"); });

    dbs.forward<ProcessingStage>(dataToProcess, processingStageId, processData);
};

// Runs on `ProcessingStage`. Processes a piece of data it recieves.
function processData(pss: ProcessingStage, params: any): void {
    log.info("ProcessingStage: processing data '" + params.value + "'");

    pss.doThing(params.value);
};


// ----------------------------------------------------------------------------
// Run the example.
// ----------------------------------------------------------------------------

// Set up a little cluster.
let sbs = new ServiceBrokerServer();
sbs.listen(sbPort);

let cacheStage = new CacheStage(cacheStageResource);
cacheStage.listen(cacheStagePort);

let dbStage = new DbStage(dbStageResource);
dbStage.listen(dbStagePort);

let processingStage = new ProcessingStage(processingStageResource);
processingStage.listen(processingStagePort);

// This request will look up the value for `key` below, process it, and cache
// it if necessary.
let keyToLookup = { key: "your_favorite_key" }
cacheStage.forward<CacheStage>(keyToLookup, cacheStageId, getDataAndProcess);


// ----------------------------------------------------------------------------
// Verify code ran with test suite.
// ----------------------------------------------------------------------------

import chai = require('chai'); 
var expect = chai.expect;

describe('Test experimental Continuum API', () => {
    describe('Verify `ProcessingStage` processed some data', () => {
        it('`ProcessingStage.thingWasProcessed` should be `true`', (done) => {
            setTimeout(() => {
                expect(ProcessingStage.thingWasProcessed).to.equals(true);
                done();
            }, 250);
        });
    });
});
