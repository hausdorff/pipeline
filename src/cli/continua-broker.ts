import fs = require("fs");
import path = require("path");

import br = require("./BrokerRegistry");
import common = require("./common");


// ----------------------------------------------------------------------------
// Error strings.
// ----------------------------------------------------------------------------
const brokerError_couldNotFindContinuaDirectory = `Continua could not find a directory with the name '${common.continuaMetadataDirectory}' in current directory '${process.cwd()}' or any of its parent directories; if this is not a valid Continua project, try running 'continua init'`;
const brokerError_couldNotAddDuplicateBroker = (brokerName) => `Continua could not add broker '${brokerName}' because it already exists in registry`;
const brokerError_couldNotRemoveNonexistantBroker = (brokerName) => `Continua could not remove broker '${brokerName}' because it does not exist in registry`;

// ----------------------------------------------------------------------------
// CLI application logic.
// ----------------------------------------------------------------------------
function add(brokerName: string, url: string) {
    const continuaPath = common.findContinuaDirectory(process.cwd());
    if (continuaPath) {
        const registryFile = path.join(continuaPath, common.brokersFileName);

        // Add broker to registry.
        const registry = br.BrokerRegistry.fromJsonFile(registryFile);
        if (registry.has(brokerName)) {
            common.fatalError(
                brokerError_couldNotAddDuplicateBroker(brokerName));
        }
        registry.set(brokerName, url);

        // Serialize and write out to broker registry. NOTE: We completely
        // overwrite the previous version of the broker registry file here.
        const serializedRegistry = registry.toJson();
        fs.writeFileSync(registryFile, serializedRegistry,
                         { encoding: br.RegistryEncoding});
    } else {
        common.fatalError(brokerError_couldNotFindContinuaDirectory);
    }
}

function rm(brokerName) {
    const continuaPath = common.findContinuaDirectory(process.cwd());

    if (continuaPath) {
        const registryFile = path.join(continuaPath, common.brokersFileName);

        // Remove broker from registry.
        const registry = br.BrokerRegistry.fromJsonFile(registryFile);
        if (!registry.has(brokerName)) {
            common.fatalError(
                brokerError_couldNotRemoveNonexistantBroker(brokerName));
        }
        registry.remove(brokerName);

        // Serialize and write out to broker registry. NOTE: We completely
        // overwrite the previous version of the broker registry file here.
        const serializedRegistry = registry.toJson();
        fs.writeFileSync(registryFile, serializedRegistry,
                         { encoding: br.RegistryEncoding});
    } else {
        common.fatalError(brokerError_couldNotFindContinuaDirectory);
    }
}

function list() {
    const continuaPath = common.findContinuaDirectory(process.cwd());

    if (continuaPath) {
        const registryFile = path.join(continuaPath, common.brokersFileName);

        // List service brokers in registry.
        const registry = br.BrokerRegistry.fromJsonFile(registryFile);
        for (const [brokerName, url] of registry.list()) {
            console.log(brokerName, "\t", url);
        }
    } else {
        common.fatalError(brokerError_couldNotFindContinuaDirectory);
    }
}


// ----------------------------------------------------------------------------
// Set up CLI options.
// ----------------------------------------------------------------------------
var program = require("commander");

program
    .command("add <name> <url>")
    .description("Tell Continua to use <name> to track the broker at <url>")
    .action(add);

program
    .command("rm <name>")
    .description("Remove service broker <name> from local registry of known service brokers")
    .action(rm);

program
    .command("list")
    .description("List service brokers that are tracked in local registry")
    .action(list);


// ----------------------------------------------------------------------------
// Parse command line.
// ----------------------------------------------------------------------------
if (process.argv.length == 2) {
    list();
}
else {
    program.parse(process.argv);
}
