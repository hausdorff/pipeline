
## Pipeline ##

This is a little experiment to brainstorm on an approach to building high-performance, distributed request processing systems in Node. An eventual goal is to leverage technologies like Mesos to scale.

To see the program in operation build and then run the server as described below.

With curl or the browser you can call the server with the following requests as see a result.

    http://localhost:8080/api/hello
    http://localhost:8080/api/counter
    http://localhost:8080/api/simpleProgram

### How does it work? ###

In all cases, the **front end** servers that receive requests examines a REST API operation and then based on the operation, the front end servers forwards the request - and some additional information - to a partitioned set of **plan** servers.  

The plan servers then look at the forwarded request and create a computation plan.  They then begin executing it.  Generally the computation plan describe sending messages to a sequence of servers that will process the message.  Note: currently there is no support for parallel/join operations but that is planned as the next enhancement.

Once a computation plan as been executed and there is a result, the server that computed the result forwards a message back to the original front end server which then relays the response to the client.

### How to build and run the server ###

First clone the repo locally.  Then run the following commands:

    npm install
    npm run install-types
    npm run build

You can then start the program with 

	node dist\Examples\server.js

