import * as continuum from "../../src/core/Continuum";
import * as stage from "../../src/core/Stage";
import * as cache from "./Cache/CacheStage";
import * as db from "./Database/DbStage";
import * as processing from "./Processing/ProcessingStage";
import * as sb from "../../src/core/ServiceBroker";

var log = require('winston');
log.level = 'error';


export type CBContinuation<T> = (continuum: Continuum, stage: T, params: any) => void;

export class Continuum extends continuum.ContinuumBase {
    public cacheStage: cache.CacheStageInterface = null;
    public dbStage: db.DbStageInterface = null;
    public processingStage: processing.ProcessingStageInterface = null;

    public log = log;

    public forward<T extends stage.Stage>(toStage: T, params: any,
                                          c: CBContinuation<T>) { 
        return this.forwardWithSelectorImplementation<T, Continuum>(
            toStage,
            params,
            ss => ss[0],
            c);
    }

    public forwardWithSelector<T extends stage.Stage>(toStage: T, params: any,
                                                      s: sb.Selector,
                                                      c: CBContinuation<T>) { 
        return this.forwardWithSelectorImplementation<T, Continuum>(
            toStage,
            params,
            s,
            c);
    }
}
