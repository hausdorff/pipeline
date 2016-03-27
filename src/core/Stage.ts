import restify = require("restify");

import sb = require("./ServiceBroker");
import cntm = require("./Continuum");

var log = require('winston');
log.level = 'error';



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
