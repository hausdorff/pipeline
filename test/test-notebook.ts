import restify = require("restify");
import URL = require("url");

import sb = require("../src/core/ServiceBroker");

var log = require('winston');
log.level = 'error';


// ----------------------------------------------------------------------------
// Configuration.
// ----------------------------------------------------------------------------
const ServiceBrokerPort: string = "9000";
const ServiceBrokerUrl: string = "http://127.0.0.1" + ":" + ServiceBrokerPort;

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
    constructor(private serviceBrokerUrl,
                private route: string) {
        this.sbc = new sb.ServiceBrokerClient(serviceBrokerUrl);
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
                                    c: sb.Continuation<T>) {
        return this.forwardWithSelector<T>(params, id, ss => ss[0], c);
    }

    public forwardWithSelector<T extends Stage>(parameters: any, id: string,
                                                s: sb.Selector,
                                                c: sb.Continuation<T>) {
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
                    log.error('Error sending to ', machine.url, resource, ':\n',
                              err);
                    throw 'Send error';
                }
                if (res.statusCode == 201) {
                    log.info('Request complete for', resource);
                    // very important - do nothing... the response will be sent
                    // back via the pipeline. This is just acknowlegement that
                    // the next stage got the request.  
                } else {
                    log.info('not sure why we are here in send');
                }
            });
    }

    private handleCode(code: string, params: Object,
                       sbc: sb.ServiceBrokerClient) {
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
    private sbc: sb.ServiceBrokerClient;
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



interface CacheStageInterface  { // Autogenerated by tool talking to ServiceBroker
    has : (k: string) => boolean;
    get : (k: string) => string;
    set : (k: string, v: string) => boolean;
    getDataAndProcess : (cs: CacheStage, params: any) => void
} 

interface DbStageInterface { // Autogenerated by tool talking to ServiceBroker
    getThing(k: string): string
    cacheAndProcessData(dbs: DbStage, params: any): void 
} 

interface ProcessingStageInterface {// Autogenerated by tool talking to ServiceBroker
    doThing : (v: string) => void;
    processData: (pss: ProcessingStage, params: any) => void;
} 



// ----------------------------------------------------------------------------
// Application logic, created by stage developer as helper functions
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

        cs.forward<ProcessingStage>(dataToProcess, processingStageId, (ps, state) => ps.processData(ps,state));
                                    
    } else {
        log.info("CacheStage: Did not find key '" + params.key +
                 "' in cache; forwarding request to database node");

        cs.forward<DbStage>(params, dbStageId, (dbs, state) => dbs.cacheAndProcessData(dbs,state));
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
    dbs.forward<CacheStage>(dataToProcess, cacheStageId, (cs, p) => { cs.set(params, "bogus_value_for_now"); });
    dbs.forward<ProcessingStage>(dataToProcess, processingStageId, (ps, p) => { ps.processData(ps,p); });
};

// Runs on `ProcessingStage`. Processes a piece of data it recieves.
function processData(pss: ProcessingStage, params: any): void {
    log.info("ProcessingStage: processing data '" + params.value + "'");
    pss.doThing(params.value);
};

// -------------
// Stage implementations - must conform to the interfaces created by the tool


class CacheStage extends Stage implements CacheStageInterface {
    public has(k: string): boolean {
        log.info("CacheStage.has(" + k + ")");
        return !(typeof this.store[k] === "undefined");
    }

    public get(k: string): string { return this.store[k]; }

    public set(k: string, v: string): boolean {
        this.store[k] = v;
        return true;
    }
    
    public getDataAndProcess = getDataAndProcess;

    private store: { [k: string]: string; } = { };
}

class DbStage extends Stage implements DbStageInterface {
    public getThing(k: string): string {
        return "cow";
    }
    public cacheAndProcessData = cacheAndProcessData;
}


class ProcessingStage extends Stage implements ProcessingStageInterface {
    public static thingWasProcessed: boolean = false; // Used for tests.

    public doThing(v: string) {
        log.info("ProcessingStage: processing data '" + v + "'");

        // Allow tests to verify function ran.
        ProcessingStage.thingWasProcessed = true;
    }
    public processData = processData;
}



// ----------------------------------------------------------------------------
// Run the example.
// ----------------------------------------------------------------------------

// Set up a little cluster.
let configuration = sb.ServiceConfigutor.fromFile(
    "./test/config/simpleOneboxConfig.json",
    "utf8");
let sbs = new sb.ServiceBrokerServer(configuration);
sbs.listen(ServiceBrokerPort);

let cacheStage = new CacheStage(ServiceBrokerUrl, cacheStageResource);
cacheStage.listen(cacheStagePort);

let dbStage = new DbStage(ServiceBrokerUrl, dbStageResource);
dbStage.listen(dbStagePort);

let processingStage = new ProcessingStage(ServiceBrokerUrl,
                                          processingStageResource);
processingStage.listen(processingStagePort);

// ----------------------------------------------------------------------------
// Verify code ran with test suite.
// ----------------------------------------------------------------------------

import chai = require('chai'); 
var expect = chai.expect;

// HACK. `setTimeout` used here to ensure the service is configured before we
// attempt to invoke it.
setTimeout(
    () => {
        // This request will look up the value for `key` below, process it, and
        // cache it if necessary.
        let keyToLookup = { key: "your_favorite_key" }
        cacheStage.forward<CacheStage>(keyToLookup, cacheStageId,
                                       getDataAndProcess);
    },
    250);

describe('Test experimental Continuum API', () => {
    describe('Verify `ProcessingStage` processed some data', () => {
        it('`ProcessingStage.thingWasProcessed` should be `true`', (done) => {
            // HACK. `setTimeout`, used here to ensure service is invoked
            // before we check whether it was successful.
            setTimeout(() => {
                expect(ProcessingStage.thingWasProcessed).to.equals(true);
                done();
            }, 500);
        });
    });
});
