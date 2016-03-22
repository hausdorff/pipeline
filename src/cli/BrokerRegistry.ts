import fs = require("fs");


// ----------------------------------------------------------------------------
// Helpers and configuration.
// ----------------------------------------------------------------------------
type BrokerRegistryJsonSchema = [{ brokerName: string, url: string}];

export const RegistryEncoding = "utf8";


// ----------------------------------------------------------------------------
// Simple broker server.
// ----------------------------------------------------------------------------
export class BrokerRegistry {
    public set(brokerName: string, url: string) {
        this.brokers[brokerName] = url;
    }

    public get(brokerName: string) {
        return this.brokers[brokerName];
    }

    public remove(brokerName: string) {
        delete this.brokers[brokerName];
    }

    public has(brokerName: string): boolean {
        return brokerName in this.brokers;
    }

    public list(): [string, string][] {
        const brokers: [string, string][] = [];

        for (const brokerName in this.brokers) {
            brokers.push([brokerName, this.brokers[brokerName]]);
        }

        return brokers;
    }

    public static fromJson(data: string): BrokerRegistry {
        const brokers: BrokerRegistryJsonSchema = JSON.parse(data);
        const brokerRegistry = new BrokerRegistry();

        for(const broker of brokers) {
            brokerRegistry.set(broker.brokerName, broker.url);
        }

        return brokerRegistry;
    }

    public static fromJsonFile(filePath: string): BrokerRegistry {
        const text = fs.readFileSync(filePath, RegistryEncoding);
        if (text.length == 0) {
            return new BrokerRegistry();
        } else {
            return BrokerRegistry.fromJson(text);
        }
    }

    public toJson(): string {
        const registryJson = [];

        for (const brokerName in this.brokers) {
            registryJson.push(
                {
                    brokerName: brokerName,
                    url: this.brokers[brokerName]
                });
        }

        return JSON.stringify(registryJson, null, 2);
    }

    private brokers: { [name: string]: string } = { };
}