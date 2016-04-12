import * as continua from "../../src/core/Continuum";
import * as stage from "../../src/core/Stage";
import * as sb from "../../src/core/ServiceBroker";
import * as cs from "./Cache/CacheStage";
import * as dbs from "./Database/DbStage";
import * as pss from "./Processing/ProcessingStage";

var log = require('winston');
log.level = 'info';

export * from "../../src/core/Stage";
export * from "./Cache/CacheStage";
export * from "./Database/DbStage";
export * from "./Processing/ProcessingStage";

export type CBContinuation<T> = (continuum: Continuum, stage: T, params: any) => void;

export class Fabric extends continua.FabricBase {
    public log = log;
}

export class Continuum extends continua.ContinuumBase {
    public static CacheStageId = "CacheStage";
    public static DbStageId = "DbStage";
    public static ProcessingStageId = "ProcessingStage";
}


const ServiceBrokerPort: string = "8090";
const ServiceBrokerUrl = process.env.serviceBrokerUrl || "http://127.0.0.1" + ":" + ServiceBrokerPort;

export const fabric = new Fabric();

export function connect(serviceBrokerUrl: string, route: string,
                        stageId: string): Continuum {
    return new Continuum(serviceBrokerUrl, route, stageId);
}
