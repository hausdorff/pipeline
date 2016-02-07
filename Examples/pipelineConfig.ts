
import restify = require("restify");
import url = require("url");
import pipeline = require("../pipeline");

import planStoreConfig = require('./planStore');
import countStoreConfig = require('./countStore');
import processJavascriptConfig = require('./processJavaScript');

export class PipelineELementClient {
    public port: number;
    public hostname: string;

    public get address(): string { return this.host; };
    public get host(): string { return this.hostname + ':' + this.port; };

    public client: restify.Client = null;

    constructor(hostname: string, port: number) {
        this.hostname = hostname;
        this.port = port;
        this.client = restify.createJsonClient({ url: this.address });
    }

}

export var initialPublic = new PipelineELementClient("http://localhost", 8080);
export var initialPipeline = new PipelineELementClient("http://localhost", 8085);
export var planStoreA = new PipelineELementClient("http://localhost", 8086);
export var planStoreB = new PipelineELementClient("http://localhost", 8087);
export var countStore = new PipelineELementClient("http://localhost", 8088);
export var processJavascript = new PipelineELementClient("http://localhost", 8089);

export var partitionManager = new pipeline.PartitionManager();

partitionManager.add("planStore", new pipeline.PartitionMapper((obj) => {
    if (obj.toString() <= "Middle") return planStoreA.client;
    else return planStoreB.client;
}));


// Running the stages locally

export function start() {
    planStoreConfig.start();
    countStoreConfig.start();
    processJavascriptConfig.start();
}
