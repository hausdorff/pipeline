
import restify = require("restify");
import url = require("url");
import pipeline = require("../pipeline");

import planStoreConfig = require('./planStore');
import countStoreConfig = require('./countStore');
import processJavascriptConfig = require('./processJavaScript');

export var initialPublic = pipeline.clients.find("http://localhost:8080");
export var initialPipeline = pipeline.clients.find("http://localhost:8085");
export var planStoreA = pipeline.clients.find("http://localhost:8086");
export var planStoreB = pipeline.clients.find("http://localhost:8087");
export var countStore = pipeline.clients.find("http://localhost:8088");
export var processJavascript = pipeline.clients.find("http://localhost:8089");

pipeline.partitionManager.add("planStore", new pipeline.PartitionMapper((obj) => {
    if (obj.toString() <= "Middle") return planStoreA;
    else return planStoreB;
}));

// Running the stages locally

export function start() {
    planStoreConfig.start();
    countStoreConfig.start();
    processJavascriptConfig.start();
}
