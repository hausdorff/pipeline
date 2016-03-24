import * as stage from "../../../src/core/Stage";
import * as continua from "../generated";

var log = require('winston');
log.level = 'error';

const logDbGet = (k, v) => `DbStage: Retrieved value '${v}' for key '${k}'; forwarding to both \`CacheStage\` and \`ProcessingStage\``;


export class DbStage extends stage.Stage implements continua.DbStageInterface {
    public getThing(k: string): string {
        return "cow";
    }
    public cacheAndProcessData = cacheAndProcessData;
}

function cacheAndProcessData(continuum: continua.Continuum, dbs: continua.DbStageInterface, params: any): void {
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