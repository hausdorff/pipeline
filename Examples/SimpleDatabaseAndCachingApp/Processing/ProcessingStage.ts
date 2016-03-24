import * as continua from "../generated";

var log = require('winston');
log.level = 'error';


const serviceBrokerUrl = process.env.serviceBrokerUrl || "http://localhost:8080";
const resourcePath = process.env.resourcePath = "/continuum";
const stageId = "processingStage";
const port = process.env.port || 8083;


export class ProcessingStage extends continua.Stage implements continua.ProcessingStageInterface {
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

var processingStage = new ProcessingStage(continuum, resourcePath, stageId);
processingStage.listen(port);

export var ready = true;