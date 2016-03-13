
import pipes = require('../src/pipes');
import pipelineConfig = require('./pipelineConfig');

var log = require('winston');
log.level = 'error';

// Create a pipeline, configure with the canoncial config server URL.
let pipeline = pipes.createPipeline(pipelineConfig.pipelineConfigServerUrl.href);

export var simulateDelay = true;
let count = 0;
function DoIncrementCount(params) {
    count++;
    return count;
}

// ----------------------------------------------------------------------------
// Application logic. The functions that will be called on the "planning" stage
// that we're defining in this file.
// ----------------------------------------------------------------------------

/**
 * Increment a count held on the server, possibly simulating a delay.
 */
function incrementCount(params, next) {
    let resultName = params['resultName'].toString();
    params[resultName] = DoIncrementCount(params);

    if (simulateDelay) {
        let delay = Math.floor(Math.random() * 100);

        log.info("Simulating long-running count store pipeline stage " +
                    "with delay of " + delay + "ms for session " +
                    params["session"]);

        setTimeout(
            () => {
                log.info("Continuing long-running count store pipeline " +
                        "stage for session " + params["session"]);
                next();
            },
            delay);
    } else {
        next();
    }
}

// ----------------------------------------------------------------------------
// Set up and start the pipeline server.
// ----------------------------------------------------------------------------

// Instantiate Pipeline server, prepare to listen on some port.
let pipelineServer = pipeline.createServer('countStoreStage');
pipelineServer.process(
    '/rest/:operation',
    (params, next) => {
        let operation = params["operation"];

        if (operation == 'incrementCount') {
            incrementCount(params, next);
        }
    });

// Start Pipeline server listening on a port.
pipelineServer.listen(pipelineConfig.countStorePort);
log.info('CountStore Stage listening on ' + pipelineConfig.countStorePort);

// Tell consuming scripts that the servers are provisioned and ready.
export var ready = true;