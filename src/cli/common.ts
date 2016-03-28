import fs = require("fs");
import path = require("path");


// ----------------------------------------------------------------------------
// Helper functions.
// ----------------------------------------------------------------------------
export function fatalError(toPrint: string) {
    console.log(toPrint);
    process.exit(1);
}

export function findContinuaDirectory(currPath: string): string {
    // NOTE: Does not currently deal with "corner case" paths that have things
    // like quotes in them.
    const components = path.resolve(currPath).split(path.sep);

    // Loop checks whether `currPath` has a '.continua' directory, and if not,
    // it find the earliest parent of `currPath` that has a '.continua'
    // directory (if any).
    let continuaDirectory: string;
    while (components.length > 0) {
        // Add '.continua' to the current path encoded in `components`, so we
        // can check whether that directory has a '.continua' directory.
        components.push(continuaMetadataDirectory);
        const candidateDirectory: string = components.join(path.sep);

        // Check if the path has a '.continua' directory.
        try {
            const stats: fs.Stats = fs.lstatSync(candidateDirectory);
            if (stats.isDirectory()) {
                continuaDirectory = candidateDirectory
                break;
            }
        } catch (e) {
            // Ignore.
        }

        // If it does not, `pop` the last component (and `pop` once more to get
        // rid of the '.continua' component we added above) so we can check if
        // the parent has a '.continua' directory.
        components.pop();
        components.pop();
    }

    return continuaDirectory;
}


// ----------------------------------------------------------------------------
// Data used for CLI.
// ----------------------------------------------------------------------------
export const continuaMetadataDirectory = ".continua";
export const brokersFileName = "brokers";

export const serviceBrokerContainerPath = "./dist/src/ServiceBroker/main.js";
