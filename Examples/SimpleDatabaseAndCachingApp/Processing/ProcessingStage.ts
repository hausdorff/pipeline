import * as stage from "../../../src/core/Stage";
import * as continua from "../generated";

var log = require('winston');
log.level = 'error';


const serviceBrokerUrl = process.env.serviceBrokerUrl || "http://localhost:8000";
const resourcePath = process.env.resourcePath = "/continuum";
const stageId = "processingStage";
const port = process.env.port || 8001;


export class ProcessingStage extends stage.Stage implements continua.ProcessingStageInterface {
    public thingWasProcessed: boolean = false; // Used for tests.

    public doThing(v: string) {
        log.info("ProcessingStage: processing data '" + v + "'");

        // Allow tests to verify function ran.
        this.thingWasProcessed = true;
    }

    public processData = processData;
}

function processData(c: continua.Continuum, pss: continua.ProcessingStageInterface, params: any) {
    c.log.info("ProcessingStage: processing data '" + params.value + "'");
    pss.doThing(params.value);
};

var continuum = new continua.Continuum(serviceBrokerUrl);

var cacheStage = new ProcessingStage(continuum, resourcePath, stageId);
cacheStage.listen(port);

export var ready = true;