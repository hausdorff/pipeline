let fs = require('fs'),
    http2 = require('http2'),
    urlParse = require('url').parse,
    log = require('winston');

log.level = 'error';


// Configuration.
let port: Number = 8011;
let host: string = "localhost";
let hostUrl: string = "https://" + host + ":" + port;

let key = fs.readFileSync('./test/http2-certs/localhost.key');
let cert = fs.readFileSync('./test/http2-certs/localhost.crt');

// ----------------------------------------------------------------------------
// Create HTTP/2 server, start listening.
// ----------------------------------------------------------------------------
let server = http2.createServer(
    {
        key: key,
        cert: cert
    },
    (req, res) => {
        log.info("request received.");
        res.end();
    });

server.listen(process.env.HTTP2_PORT || port);


// ----------------------------------------------------------------------------
// Create HTTP/2 client.
// ----------------------------------------------------------------------------
http2.globalAgent = new http2.Agent({
  rejectUnauthorized: false
});

// Point client at certificates.
let options = urlParse(hostUrl);
options.key = key;
options.ca = cert;

let request = http2.get(options);

// What to do with the response.
request.on('response', function(response) {
    log.info("Response recieved: ", response.statusCode);
    response.pipe(process.stdout);
});
