import restify = require("restify");

import sb = require("./ServiceBroker");
import cntm = require("./Continuum");

var log = require('winston');
log.level = 'error';



// ----------------------------------------------------------------------------
// Helper functions.
// ----------------------------------------------------------------------------
function objectAssign(output: Object, ...args: Object[]): Object {  // Provides ES6 object.assign functionality
    for (let index = 0; index < args.length; index++) {
        var source = args[index];
        if (source !== undefined && source !== null) {
            Object.keys(source).forEach((key) => {
                output[key] = source[key];
            });
        }
    }
    return output;
}


// ----------------------------------------------------------------------------
// Stage base class.
//
// Abstract base class all stages inherit from.
//
// Exists on `ServiceBroker`, but typings are downloaded by the `Continuum`
// class, so that the application developer, so they can services and take
// advantage of static analysis tooling like dot completion.
// ----------------------------------------------------------------------------
export abstract class Stage {
    constructor(private continuum: cntm.ContinuumBase,
                private route: string, public stageId: string) {
        this.sbc = new sb.ServiceBrokerClient(continuum.serviceBrokerUrl,
                                              stageId, route);
        this.server = restify.createServer({});
        this.server.use(restify.bodyParser({ mapParams: true }));

        this.server.get(
            sb.heartbeatPath,
            (req, res, next) => {
                res.send(200);
                return next();
            });

        this.server.post(
            route,
            (req, res, next) => {
                log.info("stage post listener");
                res.send(201);

                let code = req.params.code;
                let params = req.params;

                delete params.code;

                if (code) {
                    this.handleCode(code, params);
                }

                return next();
            });
    }

    public forward<T extends Stage, U extends cntm.ContinuumBase>(
            stageId: string,
            continuum: U,
            parameters: any,
            s: sb.Selector,
            c: (continuum: U, stage: T, params: any) => void) {
        let [machines, resource] = this.sbc.resolve(stageId);
        let machine = s(machines);

        let params = this.merge(
            parameters,
            !c
                ? {}
                : { code: c.toString() });

        // POST response.
        machine.client.post(
            resource,
            params,
            (err, req, res, obj) => {
                if (err) {
                    log.error('Error sending to ', machine.url, resource, ':\n',
                        err);
                    throw 'Send error';
                }
                if (res.statusCode == 201) {
                    log.info('Request complete for', resource);
                    // very important - do nothing... the response will be sent
                    // back via the pipeline. This is just acknowlegement that
                    // the next stage got the request.
                } else {
                    log.info('not sure why we are here in send');
                }
            });
    }

    private merge(...args: Object[]): Object {
        args.unshift({});
        return objectAssign.apply(null, args);
    }

    public listen(...args: any[]) {
        this.port = args[0];
        this.server.listen.apply(this.server, args);
        this.sbc.connect(this.port);

        log.info("Stage listening on port " + this.port + " for resource " +
            this.route);

        // TODO: Add John's hack for getting the current IP here.
    }

    private handleCode(code: string, params: Object) {
        if (!code) return;

        try {
            // Wrap function in something with parameters that have known names,
            // so that we can call it easily.
            let toEval = "(function (continuum, stage, params) { var f = " +
                code.replace(/^ *"use strict";/, "") + "; f(continuum, stage, params); })";

            var f = eval(toEval);

            f(this.continuum, this, params);
        } catch (err) {
            log.error("Could not eval '", code, "': ", err);
            throw 'Code evaluation error';
        }
    }

    private port: number;
    private server: restify.Server;
    public sbc: sb.ServiceBrokerClient;  // public for now.
}
