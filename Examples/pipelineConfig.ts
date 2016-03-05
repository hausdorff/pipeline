import url = require("url");

import planStoreStage = require('./planStore');
import countStoreStage = require('./countStore');
import processorJavascriptStage = require('./processJavascript');


export var pipelineConfigServerPort = 9000;
export var frontdoorRestPort = 8000;
export var frontdoorPort = 8080;
export var planStorePort = 8081;
export var countStorePort = 8082;
export var processJavascriptPorts = [8083, 8084];

export var pipelineConfigServerUrl = url.parse("http://localhost:" + pipelineConfigServerPort);


