
import restify = require("restify");
import url = require('url');

export var server = restify.createServer();

server.use(restify.bodyParser({mapParams: true}));

server.get('/config', (req, res, next) => {
    res.send(config);
    next();
});

server.put('/config', (req, res, next) => {
    config = req.params;
    console.log('Configuration set');
    console.log(config);
    res.send(201);
    next();
});

server.post('/stages/:stage/nodeReady', (req, res, next) => {
    var stage = req.params.stage;
    var address = url.parse('http://host');
    address.hostname = req.connection.remoteAddress;
    address.port = req.params.port;
    delete address.host;
    delete address.href;    
    console.log(stage + ' node ready at ' + url.format(address));
    var stageConfig = config[stage] ? config[stage] : config[stage] = { nodes: [], map: null };
    // stageConfig.nodes.push(address);
    res.send(201, { address: url.format(address) });
    next();
});

export function listen(port : any) {
    server.listen(port);
    console.log('Configuration server listening on ' + port);    
}


var config: { [key: string]: StageConfig } = {};

// These following should be set by calling the configServer

export interface StageConfig {
    nodes: string[];
    map: (stages: string[], any) => string;
}

