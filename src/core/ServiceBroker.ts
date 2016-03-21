import fs = require("fs");
import restify = require("restify");

let log = require('winston');
log.level = 'error';


let sbResource: string = "/broker/stages";


export type Continuation<T> = (stage: T, params: any) => void;
export type Selector = (machines: Machine[]) => Machine
export type Machine = { url: string, client: restify.Client };


// ----------------------------------------------------------------------------
// Simple broker server.
// ----------------------------------------------------------------------------
export class ServiceBrokerServer {
    constructor(configuration: ServiceConfigutor) {
        this.configuration = configuration;
        this.server = restify.createServer({});
        this.server.use(restify.bodyParser({ mapParams: true }));
        this.server.get(
            sbResource,
            (req, res, next) => {
                res.send(this.configuration.toJson());
                return next();
            });
    }

    public listen(...args: any[]) {
        this.port = args[0];
        this.server.listen.apply(this.server, args);

        log.info("ServiceBrokerServer: listening on port " + this.port +
                 " for resource " + sbResource);
    }

    private configuration: ServiceConfigutor;
    private port: string
    private server: restify.Server;
}


// ----------------------------------------------------------------------------
// Simple service broker client.
//
// Talks to the `ServiceBrokerServer`, both to discover the types which
// machines which `Stage`s run on, and what types they export.
// ----------------------------------------------------------------------------

export class ServiceBrokerClient {
    constructor(serviceBrokerServerUrl: string) {
        this.serviceBrokerServerUrl = serviceBrokerServerUrl;
        this.client = restify.createJsonClient({
            url: serviceBrokerServerUrl,
            version: '*'
        });

        this.configure();
    }

    public resolve(id: string): [Machine[], string] {
        return this.stages.get(id);
    }

    private configure() {
        this.client.get(
            sbResource,
            (err, req, res, obj) => {
                if (err) {
                    log.error("ServiceBrokerClient: error connecting to",
                              "ServiceBrokerServer: ", err);
                }

                log.info("ServiceBrokerClient: Successfully connected to ",
                         "ServiceBrokerServer at: ",
                         this.serviceBrokerServerUrl);

                this.stages = ServiceConfigutor.fromJson(obj.toString());
            });
    }

    private serviceBrokerServerUrl: string;
    private client: restify.Client;
    private stages: ServiceConfigutor;
}


// ----------------------------------------------------------------------------
// Stage configuration.
// ----------------------------------------------------------------------------
export class ServiceConfigutor {
    constructor() { }

    public get(id: string): [Machine[], string] {
        return this.stages[id];
    }

    private set(id: string, stage: [Machine[], string]): void {
        this.stages[id] = stage;
    }

    public toJson(): string {
        let configurationJson = { };

        for (let id in this.stages) {
            let stage: [Machine[], string] = this.stages[id];
            let machines: Machine[] = stage[0];

            let machinesJson = [];
            for (let machine of machines) {
                machinesJson.push(machine.url);
            }

            var stageJson = {
                machines: machinesJson,
                route: stage[1]
            };

            configurationJson[id] = stageJson;
        }

        return JSON.stringify(configurationJson, null, 2);
    }

    public static fromJson(config: string): ServiceConfigutor {
        let stages = JSON.parse(config);
        let sbc = new ServiceConfigutor();

        for (let stageId in stages) {
            let stage = stages[stageId];

            let machines: Machine[] = [];
            for (let machineUrl of stage["machines"]) {
                var machine: Machine = {
                    url: machineUrl,
                    client: restify.createJsonClient({ url: machineUrl })
                };

                machines.push(machine);
            }

            sbc.set(stageId, [machines, stage["route"]]);
        }

        return sbc;
    }

    public static fromFile(filename: string, encoding: string): ServiceConfigutor {
        let contents = fs.readFileSync(filename, "utf8");
        return ServiceConfigutor.fromJson(contents);
    }

    private stages: { [id: string]: [Machine[], string] } = { };
}
