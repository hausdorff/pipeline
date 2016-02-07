
## Pipeline ##

This is a little experiment to brainstorm on an approach to building high-performance, distributed request processing systems in Node. An eventual goal is to leverage technologies like Mesos to scale.

To see the program in operation build and then run the server as described below.

With curl or the browser you can call the server with the following requests as see a result.

    http://localhost:8080/api/hello
    http://localhost:8080/api/counter
    http://localhost:8080/api/simpleProgram

### How does it work? ###

The **front end** servers receive REST requests.  The servers then examine the path to identified the desired operation. Based on the operation, the front end server forwards the request - and some additional information - to one of a partitioned set of **plan** servers.  

The plan server then look at the forwarded request and creates a computation plan.  Next it begins executing it.  Generally the computation plan describe sending messages to a sequence of servers that will process the message.  

Once a computation plan as been executed and there is a result, the server that computed the result forwards a message back to the original front end server which then relays the response to the client.

Requests made between servers (that are stages in the computation plan) are essentially one-way messages.  Here we simulate that with HTTP POST operations that immediately return a 201.  In the 

### What is next? ###

There are two main missing enhancements that we plan to work on next:

1. Parallel/join operations in the computational plan. This would is simply enabling a computation to send multiple outbound messages.
2. Enabling HTTP2.  Since restify supports HTTP2 this should be fairly straightforward.

### How to build and run the server ###

First clone the repo locally.  Then run the following commands:

    npm install
    npm run install-types
    npm run build

You can then start the program with 

	node dist\Examples\server.js

