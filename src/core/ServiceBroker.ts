import fs = require("fs");
import restify = require("restify");
import * as http from "http";

let log = require('winston');
log.level = 'info';


const stagesPath: string = "/broker/stages";
const connectPath: string = "/broker/connect";
export const heartbeatPath: string = "/stage/heartbeat";

export type Continuation<T> = (continuum : any, stage: T, params: any) => void;
export type Selector = (machines: Machine[]) => Machine
export type Machine = { url: string, client: restify.Client };


// ----------------------------------------------------------------------------
// Simple broker server.
// ----------------------------------------------------------------------------
const sbsHeartbeatResponseRecieved = (clientStage, heartbeatUrl) => `ServiceBrokerServer: hearbeat response recieved from stage '${clientStage}' at '${heartbeatUrl}'`;
const sbsHeartbeatBadStatusCode = (statusCode, clientStage, heartbeatUrl) => `ServiceBrokerServer: heartbeat returned error code '${statusCode}' for stage '${clientStage}' at '${heartbeatUrl}'`;
const sbsHearbeatFailed = (clientStage, heartbeatUrl, err) => `ServiceBrokerServer: heartbeat failed for '${clientStage}' at '${heartbeatUrl}', with error: ${err}`;
const sbsHearbeatTimeout = (clientStage, heartbeatUrl) => `ServiceBrokerServer: heartbeat timeout for stage '${clientStage}' at '${heartbeatUrl}`;
const sbsStagesRequest = (address, port) => `ServiceBrokerServer: recieved request for stages from '${address}:${port}'`;

export class ServiceBrokerServer {
    constructor(configuration: ServiceConfigurator) {
        this.configuration = configuration;
        this.server = restify.createServer({});
        this.server.use(restify.bodyParser({ mapParams: true }));
        this.server.get(
            stagesPath,
            (req, res, next) => {
                log.info(sbsStagesRequest(req.connection.remoteAddress, req.connection.remotePort));
                res.send(this.configuration.toJson());
                return next();
            });

        this.server.post(
            connectPath,
            (req, res, next) => {
                const clientAddress = req.connection.remoteAddress;
                const clientPort = req.params.port;
                const clientRoute = req.params.route;
                const clientStage = req.params.stage;

                // NOTE: There is a '/' at the beginning of `clientRoute`, so
                // it is not necessary to put a '/' between `clientPort` and
                // `clientRoute`.
                const clientUrl = `http://[${clientAddress}]:${clientPort}${clientRoute}`;
                const heartbeatUrl = `http://[${clientAddress}]:${clientPort}${heartbeatPath}`;

                const machine =
                {
                    url: clientUrl,
                    client: null
                };
                if (this.configuration.has(clientStage)) {
                    const [machines, route] = this.configuration.get(clientStage);

                    // TODO: string compare WTF is even going on.
                    if (clientRoute === route) {
                        // TODO: known bug: we may add duplicate IPs.
                        machines.push(machine);
                        this.configuration.addOrReplace(clientStage, [machines, route]);
                    } else {
                        log.error("ServiceBrokerServer: attempted to add existing stage where route doesn't match");
                        res.send(500);
                        return next();
                    }
                } else {
                    this.configuration.addOrReplace(
                        clientStage,
                        [[machine], clientRoute]);
                }

                // TODO: make this heartbeat less ad hoc (possibly using ZK
                // watches).
                // This sets a timer that causes a heartbeat to go out every 
                // 5000ms. If it times out (1000ms), it will delete the client
                // and then delete itself.
                const intervalId = setInterval(() => {
                    const request = http.get(heartbeatUrl, (res) => {
                        if (res.statusCode === 200) {
                            log.info(sbsHeartbeatResponseRecieved(clientStage, heartbeatUrl));
                        } else {
                            log.error(sbsHeartbeatBadStatusCode(res.statusCode, clientStage, clientUrl));
                            this.configuration.delete(clientStage, clientUrl);
                            clearInterval(intervalId);
                        }

                        res.resume();
                    });

                    request.on("error", (err) => {
                        log.error(sbsHearbeatFailed(clientStage, heartbeatUrl, err));
                        this.configuration.delete(clientStage, clientUrl);
                        clearInterval(intervalId);
                    });

                    request.setTimeout(1000, () => {
                        log.error(sbsHearbeatTimeout(clientStage, heartbeatUrl));
                        this.configuration.delete(clientStage, clientUrl);
                        clearInterval(intervalId);
                    });
                }, 5000);

                res.send(200);
                return next();
            });
    }

    public listen(...args: any[]) {
        this.port = args[0];
        this.server.listen.apply(this.server, args);

        log.info("ServiceBrokerServer: listening on port " + this.port +
                 " for resource " + stagesPath);
    }

    private configuration: ServiceConfigurator;
    private port: string
    private server: restify.Server;
}


// ----------------------------------------------------------------------------
// Simple service broker client.
//
// Talks to the `ServiceBrokerServer`, both to discover the types which
// machines which `Stage`s run on, and what types they export.
// ----------------------------------------------------------------------------
const sbcCouldNotConnectToSbs = (url, err) => `ServiceBrokerClient: error connecting to ServiceBrokerServer at url '${url}': ${err}`;

export class ServiceBrokerClient {
    constructor(serviceBrokerServerUrl: string, private stageName: string,
                private route: string) {
        this.serviceBrokerServerUrl = serviceBrokerServerUrl;
        this.client = restify.createJsonClient({
            url: serviceBrokerServerUrl,
            version: '*'
        });

        this.configure();
    }

    public resolve(id: string): [Machine[], string] {
        const s = this.stages.get(id)
        return this.stages.get(id);
    }

    public connect(port: number) {
        this.port = port;

        this.client.post(
            connectPath,
            {
                route: this.route,
                port: this.port,
                stage: this.stageName
            },
            (err, req, res, obj) => {
                if (err) {
                    log.error("ServiceBrokerClient: couldn't register with ServiceBrokerServer", err);
                    // TODO: Error out?
                    return;
                }
            });
    }

    private configure() {
        this.configureFromServer();

        // TODO: poll on changes.
        const intervalId = setInterval(() => {
            this.configureFromServer();
        },
        5000);
    }

    private configureFromServer() {
        this.client.get(
            stagesPath,
            (err, req, res, obj) => {
                if (err) {
                    log.error(sbcCouldNotConnectToSbs(this.serviceBrokerServerUrl, err));
                    // TODO: ERROR OUT.
                    return;
                }

                log.info("ServiceBrokerClient: Successfully connected to ",
                        "ServiceBrokerServer at: ",
                        this.serviceBrokerServerUrl);

                this.stages = ServiceConfigurator.fromJson(obj.toString());
            });
    }

    private serviceBrokerServerUrl: string;
    private client: restify.Client;
    private stages: ServiceConfigurator;
    private port: number;
}


// ----------------------------------------------------------------------------
// Stage configuration.
// ----------------------------------------------------------------------------
export class ServiceConfigurator {
    constructor() { }

    public stageIds(): string[] {
        return Object.keys(this.stages);
    }

    public get(id: string): [Machine[], string] {
        return this.stages[id];
    }

    public delete(id: string, url: string) {
        if (!this.has(id)) {
            return;
        }

        let i = 0;
        let found = false;
        for (const machine of this.stages[id][0]) {
            // TODO: string compare makes sense?
            if (machine.url === url) {
                found = true;
                break;
            }
            i++;
        }

        if (found) {
            this.stages[id][0].splice(i, 1);
        }

        if (this.stages[id][0].length == 0) {
            delete this.stages[id];
        }
    }

    public addOrReplace(id: string, stage: [Machine[], string]): void {
        this.stages[id] = stage;
    }

    public has(id: string): boolean {
        return id in this.stages;
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

    public static fromJson(config: string): ServiceConfigurator {
        let stages = JSON.parse(config);
        let sbc = new ServiceConfigurator();

        for (let stageId in stages) {
            let stage = stages[stageId];

            let machines: Machine[] = [];
            for (let machineUrl of stage["machines"]) {
                var machine: Machine = {
                    url: machineUrl,
                    // TODO: We only need to do this for the SBC, not the SBS, so revisit pulling this.
                    client: restify.createJsonClient({ url: machineUrl })
                };

                machines.push(machine);
            }

            sbc.addOrReplace(stageId, [machines, stage["route"]]);
        }

        return sbc;
    }

    public static fromFile(filename: string, encoding: string): ServiceConfigurator {
        let contents = fs.readFileSync(filename, "utf8");
        return ServiceConfigurator.fromJson(contents);
    }

    private stages: { [id: string]: [Machine[], string] } = { };
}
