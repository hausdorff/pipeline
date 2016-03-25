import * as continua from "../generated";

var log = require('winston');
log.level = 'error';

const serviceBrokerUrl = process.env.serviceBrokerUrl || "http://localhost:8080";
const resourcePath = process.env.resourcePath = "/continuum";
const stageId = "CacheStage";
const port = process.env.port || 8081;

const logCacheHit = (k, v) => `CacheStage: Key '${k}' found; forwarding value '${v}' to processing node`;
const logCacheMiss = (k) => `CacheStage: Did not find key '${k}' in cache; forwarding request to database node`;


export class CacheStage extends continua.Stage implements continua.CacheStageInterface {
    public has(k: string): boolean {
        log.info("CacheStage.has(" + k + ")");
        return !(typeof this.store[k] === "undefined");
    }

    public get(k: string): string { return this.store[k]; }

    public set(k: string, v: string): boolean {
        this.store[k] = v;
        return true;
    }

    public getDataAndProcess(continuum: continua.Continuum, cs: continua.CacheStageInterface, params: any): void {
        if (cs.has(params.key)) {
            let dataToProcess = { value: cs.get(params.key) };

            continuum.log.info(logCacheHit(params.key, dataToProcess.value));
            continuum.forward(continuum.processingStage, dataToProcess,
                (c, ps, state) => ps.processData(c, ps, state));
        } else {
            continuum.log.info(logCacheMiss(params.key));
            continuum.forward(continuum.dbStage, params,
                (c, dbs, state) => dbs.cacheAndProcessData(c, dbs, state));
        }
    };

    private store: { [k: string]: string; } = {};
}

// var continuum = new continua.Continuum(serviceBrokerUrl);

export var cacheStage = new CacheStage(continua.continuum, resourcePath, stageId);
cacheStage.listen(port);

// continua.continuum.cacheStage = cacheStage;

export var ready = true;
