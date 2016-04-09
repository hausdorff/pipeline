// import restify = require("restify");
// import URL = require("url");

// import sb = require("../src/core/ServiceBroker");
// import stage = require("../src/core/Stage");

// import cntm = require("../src/core/Continuum");
// import g = require("../Examples/SimpleDatabaseAndCachingApp/generated");
// import cache = require("../Examples/SimpleDatabaseAndCachingApp/Cache/CacheStage");
// import db = require("../Examples/SimpleDatabaseAndCachingApp/Database/DbStage");
// import processing = require("../Examples/SimpleDatabaseAndCachingApp/Processing/ProcessingStage");
// import app = require("../Examples/SimpleDatabaseAndCachingApp/application");

// var log = require('winston');
// log.level = 'error';


// // ----------------------------------------------------------------------------
// // Configuration.
// // ----------------------------------------------------------------------------
// const ServiceBrokerPort: string = "9000";
// const ServiceBrokerUrl: string = "http://127.0.0.1" + ":" + ServiceBrokerPort;

// let cacheStagePort: string = "9001";
// let cacheStageId: string = "CacheStage";
// let cacheStageResource: string = "/lookup/cache";

// let dbStagePort: string = "9002";
// let dbStageId: string = "DbStage";
// let dbStageResource: string = "/lookup/database";

// let processingStagePort: string = "9003";
// let processingStageId: string = "ProcessingStage";
// let processingStageResource: string = "/lookup/processing";


// // Set up a little cluster.
// let configuration = sb.ServiceConfigutor.fromFile(
//     "./test/config/simpleOneboxConfig.json",
//     "utf8");
// let sbs = new sb.ServiceBrokerServer(configuration);
// sbs.listen(ServiceBrokerPort);

// var c = new g.Continuum(ServiceBrokerUrl);

// c.cacheStage = new cache.CacheStage(c, cacheStageResource, cacheStageId);
// c.cacheStage.getDataAndProcess = app.getDataAndProcess; // "Register" function with stage.
// c.cacheStage.listen(cacheStagePort);

// c.dbStage = new db.DbStage(c, dbStageResource, dbStageId);
// c.dbStage.cacheAndProcessData = app.cacheAndProcessData; // "Register" function with stage.
// c.dbStage.listen(dbStagePort);

// c.processingStage = new processing.ProcessingStage(c, processingStageResource,
//                                         processingStageId);
// c.processingStage.processData = app.processData; // "Register" function with stage.
// c.processingStage.listen(processingStagePort);


// import chai = require('chai');
// var expect = chai.expect;

// describe('Test experimental Continuum API', () => {
//     describe('Verify `ProcessingStage` processed some data', () => {
//         it('`ProcessingStage.thingWasProcessed` should be `true`', (done) => {
//             let keyToLookup = { key: "your_favorite_key" }
//             c.forward(c.cacheStage, keyToLookup,
//                               (continuum, thisStage, state) => thisStage.getDataAndProcess(continuum, thisStage, state));
//             // HACK. `setTimeout`, used here to ensure service is invoked
//             // before we check if it was successful.
//             setTimeout(() => {
//                 expect(c.processingStage.thingWasProcessed).to.equals(true);
//                 done();
//             }, 250);
//         });
//     });
// });


// // Set up service broker.
// import * as sb from "../src/core/ServiceBroker"

// const ServiceBrokerPort: string = "8090";
// const ServiceBrokerUrl: string = "http://127.0.0.1" + ":" + ServiceBrokerPort;
// const configuration = sb.ServiceConfigutor.fromFile(
//     "./test/config/simpleOneboxConfig.json",
//     "utf8");
// const sbs = new sb.ServiceBrokerServer(configuration);
// sbs.listen(ServiceBrokerPort);


import * as restify from 'restify';
import * as continua from '../Examples/SimpleDatabaseAndCachingApp/generated';


// const serviceBrokerUrl = process.env.serviceBrokerUrl || ServiceBrokerUrl;

// var continuum = new continua.Continuum(serviceBrokerUrl);
var continuum = continua.continuum;

// Set up stages.
import cache = require("../Examples/SimpleDatabaseAndCachingApp/Cache/CacheStage");
import db = require("../Examples/SimpleDatabaseAndCachingApp/Database/DbStage");
import processing = require("../Examples/SimpleDatabaseAndCachingApp/Processing/ProcessingStage");

continuum.cacheStage = cache.cacheStage;
continuum.dbStage = db.dbStage;
continuum.processingStage = processing.processingStage;

// Set up front door.
const FrontDoorPort = 8000;
const FrontDoorUrl: string = "http://127.0.0.1" + ":" + FrontDoorPort;
var frontdoor = restify.createServer();
frontdoor.get('/api/test', (req,res,next) => {
    var keyToLookup = { key: "your_favorite_key" }
    continuum.forward(
        continuum.cacheStage,
        keyToLookup,
        (continuum, stage, state) => stage.getDataAndProcess(continuum, stage, state));
    res.end();
});
frontdoor.listen(FrontDoorPort);

const client = restify.createJsonClient({
    url: FrontDoorUrl,
    version: '*'
});

setTimeout(() => {
    client.get("/api/test", (err, req, res) => {
        if (err) {
            console.log(err);
        }
        // TODO: verify the thingWasProcessed member actually is true.
    });
},
2000);



// import chai = require('chai');
// var expect = chai.expect;

// describe('Test experimental Continuum API', () => {
//     describe('Verify `ProcessingStage` processed some data', () => {
//         it('`ProcessingStage.thingWasProcessed` should be `true`', (done) => {
//             const client = restify.createJsonClient({
//                 url: FrontDoorUrl,
//                 version: '*'
//             });

//             client.get("/api/test", (err, req, res) => {
//                     // TODO: verify the thingWasProcessed member actually is true.
//             });

//             setTimeout(() => {
//                 done();
//             },
//             250);
//         });
//     });
// });

