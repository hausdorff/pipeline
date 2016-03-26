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
export abstract class ContinuumBase {
    constructor(public serviceBrokerUrl) {
        this.sbc = new sb.ServiceBrokerClient(serviceBrokerUrl);
    }

    protected forwardImplementation<T extends stage.Stage, U extends ContinuumBase>(toStage: T, params: any,
        c: (continuum: U, stage: T, params: any) => void) { // Hack for now.  The continuum should be typed for the stage
        return this.forwardWithSelectorImplementation<T, U>(toStage, params, ss => ss[0], c);
    }

    protected forwardWithSelectorImplementation<T extends stage.Stage, U extends ContinuumBase>(toStage: T, parameters: any, s: sb.Selector, 
                           c: (continuum: U, stage: T, params: any) => void) {
        let [machines, resource] = toStage.sbc.resolve(toStage.stageId);
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

    protected sbc: sb.ServiceBrokerClient;
}