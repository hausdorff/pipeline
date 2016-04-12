import * as restify from 'restify';
import * as continua from './generated';


// ----------------------------------------------------------------------------
// Config.
// ----------------------------------------------------------------------------
const serviceBrokerUrl = process.env.serviceBrokerUrl || "http://localhost:8090";
const frontdoorPort = 8000;
const frontdoorUrl: string = "http://127.0.0.1" + ":" + frontdoorPort;


// ----------------------------------------------------------------------------
// Simple application.
// ----------------------------------------------------------------------------
function getDataAndProcess(cs: continua.CacheStage, params: any): void {
    console.log("Cache node recieved request");
    if (cs.has(params.key)) {
        let dataToProcess = { value: cs.get(params.key) };

        // Data found! Send to processing node to process.
        cs.forward(
            continua.Continuum.ProcessingStageId,
            dataToProcess,
            processData);
    } else {
        // Data not found! Send request to DB to retrieve and then process.
        cs.forward(
            continua.Continuum.DbStageId,
            params,
            cacheAndProcessData);
    }
};

function cacheAndProcessData(dbs: continua.DbStage, params: any): void {
    console.log("Db node recieved request");
    let dataToProcess = { value: dbs.getThing(params.key) };

    // Send data back to cache.
    //
    // NOTE: We'll want to replace the "bogus_value_for_now" below with v when
    // we get Babel integration and can finally lift the environment out and
    // serialize that too.
    dbs.forward<continua.CacheStage>(
        continua.Continuum.CacheStageId,
        dataToProcess,
        (cs, p) => { cs.set(params, "bogus_value_for_now"); });

    // Send data also to processing node.
    dbs.forward<continua.ProcessingStage>(
        continua.Continuum.ProcessingStageId,
        dataToProcess,
        processData);
};

function processData(pss: continua.ProcessingStage, params: any) {
    console.log("Processing node recieved request");
    // Process the data.
    pss.doThing(params.value);
};


// ----------------------------------------------------------------------------
// Simple application.
// ----------------------------------------------------------------------------
const cr = continua.connect(serviceBrokerUrl, "/frondoor", "frondoor");

cr.get('/api/test', (req,res,next) => {
    var keyToLookup = { key: "your_favorite_key" }
    cr.forward(
        continua.Continuum.CacheStageId,
        keyToLookup,
        (cs: continua.CacheStage, params) => {
            console.log("Cache node recieved request");
            if (cs.has(params.key)) {
                let dataToProcess = { value: cs.get(params.key) };

                // Data found! Send to processing node to process.
                cs.forward(
                    continua.Continuum.ProcessingStageId,
                    dataToProcess,
                    processData);
            } else {
                // Data not found! Send request to DB to retrieve and then process.
                cs.forward<continua.DbStage>(
                    "DbStage",
                    params,
                    (dbs, params) => {
                        console.log("Db node recieved request");
                        let dataToProcess = { value: dbs.getThing(params.key) };

                        // Send data back to cache.
                        //
                        // NOTE: We'll want to replace the "bogus_value_for_now" below with v when
                        // we get Babel integration and can finally lift the environment out and
                        // serialize that too.
                        dbs.forward<continua.CacheStage>(
                            "CacheStage",
                            dataToProcess,
                            (cs, p) => { cs.set(params, "bogus_value_for_now"); });

                        // Send data also to processing node.
                        dbs.forward<continua.ProcessingStage>(
                            "ProcessingStage",
                            dataToProcess,
                            (pss, p) => {
                                console.log("Processing node recieved request");
                                // Process the data.
                                pss.doThing(params.value);
                            });
                    });
            }
        });
    res.end();
});
cr.listen(frontdoorPort);
