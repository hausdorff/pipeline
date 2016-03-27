import * as broker from "../core/ServiceBroker"


const ServiceBrokerPort: string = process.env.serviceBrokerPort || "8090";

// EDIT: Make this less manual!
const configuration = new broker.ServiceConfigurator();
const brokerServer = new broker.ServiceBrokerServer(configuration);
brokerServer.listen(ServiceBrokerPort);
