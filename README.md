
## Pipeline ##

This is a little experiment to brainstorm on an approach to building high-performance, distributed request processing systems in Node. An eventual goal is to leverage technologies like Mesos to scale.

To see the program in operation build and then run the server as described below.

With curl or the browser you can call the server with the following requests as see a result.

    http://localhost:8000/api/hello
    http://localhost:8000/api/counter
    http://localhost:8080/api/simple
    http://localhost:8080/api/chained
    

### How the Example pipeline work? ###

The **front end** servers receive REST requests.  It looks the path to identify the desired operation. It then  forwards the request - and some additional information - to one of a partitioned set of **plan** servers.  

The plan server examines the forwarded request and associated operation and creates a computation plan.  Next the server begins executing the computation plan.  Generally a computation plan will describe sending messages to a sequence of servers - the pipeline **stages** - that will process the request.

A pipeline stage may perform a variety of functions; in the current prototype some pipeline stages can perform a variety of different functions including data process on the request, state/DB lookup, or execute javascript.

Once a computation plan has been distributed across the pipeline and executes, there may be a result. The server that computed the result will send a message back to the original front end server which then relays the response to the client.

Requests made between pipeline stages are essentially one-way messages.  Here we simulate that with HTTP POST operations that immediately return a 201.  

### What is next? ###

There are two main missing enhancements that we plan to work on next:

1. Enabling HTTP2 between pipeline stages.  Since restify supports HTTP2 this should be fairly straightforward.
2. Distributing the load to a set of managed processors using something like Mesos

Other enhancements might include:
3. Parallel/join operations in the computational plan. This would is simply enabling a computation to send multiple outbound messages.

### How to build and run the server ###

First clone the repo locally.  Then run the following commands:

    npm install
    npm run typings
    npm run build

You can then start the program with 

    node dist\Examples\server.js

You can test with

    npm test
