// import restify = require('restify');
// import chai = require('chai');
// import server = require('../Examples/server');

// var log = require('winston');
// log.level = 'error';

// var expect = chai.expect;
// var should = chai.should();

// while (!server.ready) { setTimeout(() => { log.info('Waiting.'); }, 0); }
// log.info('server is ready');
// var client = restify.createJsonClient({
//     url: 'http://127.0.0.1:8000',

//     version: '*'
// });

// describe('Examples/server.ts REST API', () => {

//     describe('basic end-to-end tests', () => {

//         it('should return hello', (done) => {
//             client.get('/api/hello', (err, req, res, data) => {
//                 log.info('callback for /api/hello', err, res.statusCode, 'with data', data);
//                 expect(err).to.be.null;
//                 expect(res.statusCode).to.equal(201);
//                 expect(data).to.equal("Hello");
//                 done();
//             });
//         });

//         it('should lookup a count and return the count', (done) => {
//             client.get('/api/counter', (err, req, res, data) => {
//                 log.info('callback for /api/counter', err, res.statusCode, 'with data', data);
//                 expect(err).to.be.null;
//                 expect(res.statusCode).to.equal(201);
//                 expect(data).to.be.a('number');
//                 done();
//             });
//         });

//         it('should do a simple calculation and return the result', (done) => {
//             client.get('/api/simple', (err, req, res, data) => {
//                 log.info('callback for /api/simple', err, res.statusCode, 'with data', data);
//                 expect(err).to.be.null;
//                 expect(res.statusCode).to.equal(201);
//                 expect(data).to.be.a('string');
//                 expect(data.substring(0,11)).to.equal('The date is');
//                 done();
//             });
//         });

//         it('should lookup a counter, do a simple calculation, and return the result', (done) => {
//             client.get('/api/chained', (err, req, res, data) => {
//                 log.info('callback for /api/chained', err, res.statusCode, 'with data', data);
//                 expect(err).to.be.null;
//                 expect(res.statusCode).to.equal(201);
//                 expect(data).to.be.a('string');
//                 expect(data.substring(0,13)).to.equal('Current count');
//                 done();
//             });
//         });


//     });
// });