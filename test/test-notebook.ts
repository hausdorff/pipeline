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
// Abstract base class all stages inherit from.
//
// Exists on `ServiceBroker`, but typings are downloaded by the `Continuum`
// class, so that the application developer, so they can services and take
// advantage of static analysis tooling like dot completion.
// ----------------------------------------------------------------------------


abstract class Stage {
    constructor(private continuum: ContinuumBase,
        private route: string, public stageId: string) {
        this.sbc = new sb.ServiceBrokerClient(continuum.serviceBrokerUrl); // not needed
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
                    this.handleCode(code, params);
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

    private handleCode(code: string, params: Object) {
        if (!code) return;

        try {
            // Wrap function in something with parameters that have known names,
            // so that we can call it easily.
            let toEval = "(function (continuum, stage, params) { var f = " +
                code.replace(/^ *"use strict";/, "") + "; f(continuum, stage, params); })";

            var f = eval(toEval);

            f(this.continuum, this, params);
        } catch (err) {
            log.error("Could not eval '", code, "': ", err);
            throw 'Code evaluation error';
        }
    }
    private port: string
    private server: restify.Server;
    public sbc: sb.ServiceBrokerClient;  // public for now.
}


abstract class ContinuumBase {
    constructor(public serviceBrokerUrl) { }

    protected forwardImplementation<T extends Stage, U extends ContinuumBase>(toStage: T, params: any,
        c: (continuum: U, stage: T, params: any) => void) { // Hack for now.  The continuum should be typed for the stage
        return this.forwardWithSelectorImplementation<T, U>(toStage, params, ss => ss[0], c);
    }

    protected forwardWithSelectorImplementation<T extends Stage, U extends ContinuumBase>(toStage: T, parameters: any,
        s: sb.Selector,
        c: (continuum: U, stage: T, params: any) => void) {
        let [machines, resource] = toStage.sbc.resolve(toStage.stageId);
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

    private merge(...args: Object[]): Object {
        args.unshift({});
        return objectAssign.apply(null, args);
    }

}


// ----------------------------------------------------------------------------
// Stages Interfaces - all "machine generated" from tool that connects to ServiceBroker
//
// Each stage is a service running on a machine. For example, the `CacheStage`
// might just be a TypeScript class wrapping Redis.
//
// They type of each `Stage` exists on `ServiceBroker`, and can be downloaded
// by the `Continuum` class so that the application developer can take
// advantage of statyc analysis tooling like dot completion.
// ----------------------------------------------------------------------------

interface CacheStageInterface extends Stage { // Auto generated by tool connecting to ServiceBroker
    has: (k: string) => boolean;
    get: (k: string) => string;
    set: (k: string, v: string) => boolean;
    getDataAndProcess: (continuum: ContinuumBase, cs: CacheStageInterface, params: any) => void // Should be Continuum not ContinuumBase
}

interface DbStageInterface extends Stage { // Auto generated by tool connecting to ServiceBroker
    getThing(k: string): string
    cacheAndProcessData: (continuum: ContinuumBase, dbs: DbStageInterface, params: any) => void; // Should be Continuum not ContinuumBase 
}

interface ProcessingStageInterface extends Stage {// Auto generated by tool connecting to ServiceBroker
    thingWasProcessed: boolean;
    doThing: (v: string) => void;
    processData: (continuum: ContinuumBase, pss: ProcessingStageInterface, params: any) => void;// Should be Continuum not ContinuumBase
}

class Continuum extends ContinuumBase {
    public cacheStage: CacheStageInterface = null;
    public dbStage: DbStageInterface = null;
    public processingStage: ProcessingStageInterface = null;
    public forward<T extends Stage>(toStage: T, params: any, c: (continuum: Continuum, stage: T, params: any) => void) { 
        return this.forwardWithSelectorImplementation<T, Continuum>(toStage, params, ss => ss[0], c);
    }
    public forwardWithSelector<T extends Stage>(toStage: T, params: any, s: sb.Selector, c: (continuum: Continuum, stage: T, params: any) => void) { 
        return this.forwardWithSelectorImplementation<T, Continuum>(toStage, params, s, c);
    }
}


// ----------------------------------------------------------------------------
// Application logic, created by stage developer as helper functions
//
// The application developer writes this code, which is transmitted to the
// provisioner, so that it can be run on boxes in the cluster.
//
// NOTICE - these functions NOW only rely on parameters passed in to the continuation.  No globals.
//
// ----------------------------------------------------------------------------

// Runs on `CacheStage`. Checks cache for a key; if present, forwards the value
// on to `ProcessingStage`. If it is not, we forward a request to the database.
function getDataAndProcess(continuum: Continuum, cs: CacheStageInterface, params: any): void {
    if (cs.has(params.key)) {
        let dataToProcess = { value: cs.get(params.key) };
        log.info("CacheStage: Key '" + params.key +
            "' found; forwarding value '" + dataToProcess.value +
            "' to processing node");

        continuum.forward(continuum.processingStage, dataToProcess, (c, ps, state) => ps.processData(c, ps, state));  
    } else {
        log.info("CacheStage: Did not find key '" + params.key +
            "' in cache; forwarding request to database node");
        continuum.forward(continuum.dbStage, params, (c, dbs, state) => dbs.cacheAndProcessData(c, dbs, state));
    }
};

// Runs on `DbStage`. Gets value from database, caches it, and forwards that
// data on to `ProcessingStage`.
function cacheAndProcessData(continuum: Continuum, dbs: DbStageInterface, params: any): void {
    let dataToProcess = { value: dbs.getThing(params.key) };

    log.info("DbStage: Retrieved value '" + dataToProcess.value +
        "' for key '" + params.key +
        "'; forwarding to both `CacheStage` and `ProcessingStage`");

    // Send data back to both the caching stage and the processing stage.
    //
    // NOTE: We'll want to replace the "bogus_value_for_now" below with v when
    // we get Babel integration and can finally lift the environment out and
    // serialize that too.
    continuum.forward(continuum.cacheStage, dataToProcess, (c, cs, p) => { cs.set(params, "bogus_value_for_now"); });
    continuum.forward(continuum.processingStage, dataToProcess, (c, ps, p) => { ps.processData(c, ps, p); });
};


// ----------------------------------------------------------------------------
// Stage implementations - must conform to the interfaces created by the tool
//
// stage developers would write these
// ----------------------------------------------------------------------------

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

    public getDataAndProcess = getDataAndProcess; // Pick up global function and hang off interface to stage - could also be defined inline.

    private store: { [k: string]: string; } = {};
}

class DbStage extends Stage implements DbStageInterface {
    public getThing(k: string): string {
        return "cow";
    }
    public cacheAndProcessData = cacheAndProcessData; // Pick up global function and hang off interface to stage
}


class ProcessingStage extends Stage implements ProcessingStageInterface {
    public thingWasProcessed: boolean = false; // Used for tests.

    public doThing(v: string) {
        log.info("ProcessingStage: processing data '" + v + "'");

        // Allow tests to verify function ran.
        this.thingWasProcessed = true;
    }

    public processData(c: Continuum, pss: ProcessingStageInterface, params: any) {  // Demonstrating that implementations can be inline too
        log.info("ProcessingStage: processing data '" + params.value + "'");
        pss.doThing(params.value);
    };
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

var continuum = new Continuum(ServiceBrokerUrl);

continuum.cacheStage = new CacheStage(continuum, cacheStageResource, cacheStageId);
continuum.cacheStage.listen(cacheStagePort);

continuum.dbStage = new DbStage(continuum, dbStageResource, dbStageId);
continuum.dbStage.listen(dbStagePort);

continuum.processingStage = new ProcessingStage(continuum, processingStageResource, processingStageId);
continuum.processingStage.listen(processingStagePort);


// ----------------------------------------------------------------------------
// Verify code ran with test suite.
// ----------------------------------------------------------------------------

import chai = require('chai');
var expect = chai.expect;

describe('Test experimental Continuum API', () => {
    describe('Verify `ProcessingStage` processed some data', () => {
        it('`ProcessingStage.thingWasProcessed` should be `true`', (done) => {
            let keyToLookup = { key: "your_favorite_key" }
            continuum.forward(continuum.cacheStage, keyToLookup, (continuum, thisStage, state) => thisStage.getDataAndProcess(continuum, thisStage, state));
            // HACK. `setTimeout`, used here to ensure service is invoked
            // before we check if it was successful.
            setTimeout(() => {
                expect(continuum.processingStage.thingWasProcessed).to.equals(true);
                done();
            }, 250);
        });
    });
});
