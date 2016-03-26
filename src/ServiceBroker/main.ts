import * as broker from "../core/ServiceBroker"


const ServiceBrokerPort: string = process.env.serviceBrokerPort || "8090";

// EDIT: Make this less manual!
const configuration = broker.ServiceConfigutor.fromFile(
    "./test/config/simpleOneboxConfig.json",
    "utf8");

const brokerServer = new broker.ServiceBrokerServer(configuration);
brokerServer.listen(ServiceBrokerPort);
