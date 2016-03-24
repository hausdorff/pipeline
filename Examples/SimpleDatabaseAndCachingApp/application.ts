import * as cache from "./Cache/CacheStage";
import * as db from "./Database/DbStage";
import * as processing from "./Processing/ProcessingStage";
import * as sb from "../../src/core/ServiceBroker";
import * as g from "./generated";


const logCacheHit = (k, v) => `CacheStage: Key '${k}' found; forwarding value '${v}' to processing node`;
const logCacheMiss = (k) => `CacheStage: Did not find key '${k}' in cache; forwarding request to database node`;
const logDbGet = (k, v) => `DbStage: Retrieved value '${v}' for key '${k}'; forwarding to both \`CacheStage\` and \`ProcessingStage\``;


// Runs on `CacheStage`. Checks cache for a key; if present, forwards the value
// on to `ProcessingStage`. If it is not, we forward a request to the database.
export function getDataAndProcess(continuum: g.Continuum,
                           cs: cache.CacheStageInterface, params: any): void {
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

// Runs on `DbStage`. Gets value from database, caches it, and forwards that
// data on to `ProcessingStage`.
export function cacheAndProcessData(continuum: g.Continuum, dbs: db.DbStageInterface,
                            params: any): void {
    let dataToProcess = { value: dbs.getThing(params.key) };

    continuum.log.info(logDbGet(params.key, dataToProcess.value));

    // Send data back to both the caching stage and the processing stage.
    //
    // NOTE: We'll want to replace the "bogus_value_for_now" below with v when
    // we get Babel integration and can finally lift the environment out and
    // serialize that too.
    continuum.forward(continuum.cacheStage, dataToProcess,
                    (c, cs, p) => { cs.set(params, "bogus_value_for_now"); });
    continuum.forward(continuum.processingStage, dataToProcess,
                    (c, ps, p) => { ps.processData(c, ps, p); });
};

export function processData(c: g.Continuum, pss: processing.ProcessingStageInterface, params: any) {
    c.log.info("ProcessingStage: processing data '" + params.value + "'");
    pss.doThing(params.value);
};
