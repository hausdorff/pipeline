import * as continua from "../../src/core/Continuum";
import * as stage from "../../src/core/Stage";
import * as sb from "../../src/core/ServiceBroker";

var log = require('winston');
log.level = 'error';

export * from "../../src/core/Stage";

export type CBContinuation<T> = (continuum: Continuum, stage: T, params: any) => void;

export interface CacheStageInterface extends stage.Stage {
    has: (k: string) => boolean;
    get: (k: string) => string;
    set: (k: string, v: string) => boolean;
    getDataAndProcess: (continuum: Continuum, cs: CacheStageInterface, params: any) => void

}

export interface DbStageInterface extends stage.Stage {
    getThing(k: string): string
    cacheAndProcessData: (continuum: Continuum, dbs: DbStageInterface, params: any) => void;
}

export interface ProcessingStageInterface extends stage.Stage {
    thingWasProcessed: boolean;
    doThing: (v: string) => void;
    processData: (continuum: Continuum, pss: ProcessingStageInterface, params: any) => void;
}

export class Continuum extends continua.ContinuumBase {
    public cacheStage: CacheStageInterface = null;
    public dbStage: DbStageInterface = null;
    public processingStage: ProcessingStageInterface = null;

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
