import * as broker from "../core/ServiceBroker"


const ServiceBrokerPort: string = process.env.serviceBrokerPort || "8090";

export function startServiceBroker(port: number) {
    const configuration = new broker.ServiceConfigurator();
    const brokerServer = new broker.ServiceBrokerServer(configuration);
    brokerServer.listen(port);
}

if (require.main === module) {
    startServiceBroker(parseInt(ServiceBrokerPort));
}
