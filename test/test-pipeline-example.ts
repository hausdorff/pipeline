import restify = require('restify');
import chai = require('chai');
import server = require('../Examples/server');

var expect = chai.expect;
var should = chai.should();

while (!server.ready) { setTimeout(() => { console.log('Waiting.'); }, 0); }
console.log('server is ready');
var client = restify.createJsonClient({
    url: 'http://127.0.0.1:8000',

    version: '*'
});

describe('Examples/server REST API', () => {

    describe('basic end-to-end', () => {

        it('should return hello', (done) => {
            client.get('/api/hello', (err, req, res, data) => {
                console.log('callback for /api/hello', err, res.statusCode, 'with data', data);
                expect(err).to.be.null;
                expect(res.statusCode).to.equal(201);
                expect(data).to.equal("Hello");
                done();
            });
        });

        it('should lookup a count and return the count', (done) => {
            client.get('/api/counter', (err, req, res, data) => {
                console.log('callback for /api/counter', err, res.statusCode, 'with data', data);
                expect(err).to.be.null;
                expect(res.statusCode).to.equal(201);
                expect(data).to.be.a('number');
                done();
            });
        });

        it('should do a simple calculation and return the result', (done) => {
            client.get('/api/simple', (err, req, res, data) => {
                console.log('callback for /api/simple', err, res.statusCode, 'with data', data);
                expect(err).to.be.null;
                expect(res.statusCode).to.equal(201);
                expect(data).to.be.a('string');
                done();
            });
        });

        it('should lookup a counter, do a simple calculation, and return the result', (done) => {
            client.get('/api/chained', (err, req, res, data) => {
                console.log('callback for /api/chained', err, res.statusCode, 'with data', data);
                expect(err).to.be.null;
                expect(res.statusCode).to.equal(201);
                expect(data).to.be.a('string');
                done();
            });
        });


    });
});