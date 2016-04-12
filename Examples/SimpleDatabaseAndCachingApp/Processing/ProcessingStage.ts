import * as continua from "../generated";

var log = require('winston');
log.level = 'info';


const serviceBrokerUrl = process.env.serviceBrokerUrl || "http://localhost:8090";
const resourcePath = process.env.resourcePath = "/continuum";
const stageId = "ProcessingStage";
const port = process.env.port || 8083;


// ----------------------------------------------------------------------------
// Simple processing stage.
// ----------------------------------------------------------------------------
export class ProcessingStage extends continua.Stage /*implements continua.ProcessingStageInterface*/ {
    public thingWasProcessed: boolean = false; // Used for tests.

    public doThing(v: string) {
        log.info("ProcessingStage: processing data '" + v + "'");

        // Allow tests to verify function ran.
        this.thingWasProcessed = true;
        log.error("thingWasProcessed:", this.thingWasProcessed);
    }

    // public processData = processData;
}

// function processData(c: continua.Continuum, pss: continua.ProcessingStageInterface, params: any) {
//     c.log.error("ProcessingStage: processing data '" + params.value + "'");
//     pss.doThing(params.value);
// };


// ----------------------------------------------------------------------------
// Start stage.
// ----------------------------------------------------------------------------
export var processingStage;

if (require.main === module) {
    processingStage = new ProcessingStage(continua.fabric, serviceBrokerUrl,
                                          resourcePath, stageId);
    processingStage.listen(port);
}

// export var ready = true;
