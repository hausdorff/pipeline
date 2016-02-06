
## Pipeline ##

This is a little experiment to play around with some ideas on how to build a high-performance, distributed request processing system in Node with an eventual goal of leverage technologies like Mesos to scale.

To see the program in operation build and then run the server as described below.

With curl or the browser you can call the server with the following requests as see a result.

    http://localhost:8080/api/hello
    http://localhost:8080/api/counter
    http://localhost:8080/api/simpleProgram

### How does it work? ###
In all cases, the **front end** servers that receives the request looks at the operation and then forwards the request - and some additional information - to a partitioned set of **plan** servers.  

The plan servers then look at the forwarded request and create a computation plan and begins executing it.  Generally the computation plan describe sending messages to a sequence of servers that will process the message.  

Ultimately, once a result is computed, the server that computed the result forwards a message back to the original front end server which then relays the response to the client.

### How to build and run the server ###

First clone the repo locally.  Then run the following commands:

    npm install
    npm run install-types
    npm run build

You can then start the program with 

	node dist\Examples\server.js

