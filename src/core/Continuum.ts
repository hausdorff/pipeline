import * as restify from "restify";

import sb = require("./ServiceBroker");
import stage = require("./Stage");

var log = require('winston');
log.level = 'info';


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
// Continuum base class.
// ----------------------------------------------------------------------------
export abstract class FabricBase {
    log: any;
}


// ----------------------------------------------------------------------------
// Continuum base class.
// ----------------------------------------------------------------------------
export abstract class ContinuumBase extends stage.Forwarder {
    constructor(serviceBrokerUrl: string,
                route: string, stageId: string) {
        super(serviceBrokerUrl, route, stageId);
    }

    public use(handler, ...handlers): restify.Server {
        return this.server.use(handler, handlers);
    }

    public post(route, routeCallBack, ...routeCallBacks): restify.Route {
        return this.server.post(route, routeCallBack, routeCallBacks);
    }

    public patch(route, routeCallBack, ...routeCallBacks): restify.Route {
        return this.server.patch(route, routeCallBack, routeCallBacks);
    }

    public put(route, routeCallBack, ...routeCallBacks): restify.Route {
        return this.server.put(route, routeCallBack, routeCallBacks);
    }

    public del(route, routeCallBack, ...routeCallBacks): restify.Route {
        return this.server.del(route, routeCallBack, routeCallBacks);
    }

    public get(route, routeCallBack, ...routeCallBacks): restify.Route {
        return this.server.get(route, routeCallBack, routeCallBacks);
    }

    public head(route, routeCallBack, ...routeCallBacks): restify.Route {
        return this.server.head(route, routeCallBack, routeCallBacks);
    }

    public opts(route, routeCallBack, ...routeCallBacks): restify.Route {
        return this.server.opts(route, routeCallBack, routeCallBacks);
    }

    public listen(...args: any[]) {
        this.port = args[0];
        this.server.listen.apply(this.server, args);
        this.sbc.connect(this.port);

        console.log("Stage listening on port " + this.port + " for resource " +
            this.route);

        // TODO: Add John's hack for getting the current IP here.
    }

    private port: number;
    private server = restify.createServer();
}