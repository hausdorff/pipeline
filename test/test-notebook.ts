import * as restify from 'restify';
import * as continua from '../Examples/SimpleDatabaseAndCachingApp/generated';

// ----------------------------------------------------------------------------
// Config.
// ----------------------------------------------------------------------------
const serviceBrokerUrl = process.env.serviceBrokerUrl || "http://localhost:8090";
const frontdoorPort = 8000;
const frontdoorUrl: string = "http://127.0.0.1" + ":" + frontdoorPort;


// ----------------------------------------------------------------------------
// Simple client calling the application.
// ----------------------------------------------------------------------------
const client = restify.createJsonClient({
    url: frontdoorUrl,
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
