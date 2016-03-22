import fs = require("fs");
import path = require("path");

import common = require("./common");


// ----------------------------------------------------------------------------
// Data.
// ----------------------------------------------------------------------------
const continuaDirectoryPath = path.join(
    process.cwd(),
    common.continuaMetadataDirectory);
const brokersFilePath =  path.join(
    continuaDirectoryPath,
    common.brokersFileName);


// ----------------------------------------------------------------------------
// Error strings.
// ----------------------------------------------------------------------------
const couldNotInit_metadataDirExists = `Continua could not initialize: file or directory '${continuaDirectoryPath}' exists`;
const couldNotInit_createDirFailed = (e) => `Continua could not initialize: could not create directory '${common.continuaMetadataDirectory}'. Error: ${e.toString()}`;
const couldNotInit_brokersFileCreateFailed = (e) => `Continua could not initialize: could not create file '${brokersFilePath}'. Error: ${e.toString()}`;


// ----------------------------------------------------------------------------
// Helper functions.
// ----------------------------------------------------------------------------
function tryCreateMetadataDirectory() {
    // Error out if '.continua' is a directory.
    try {
        const stats: fs.Stats = fs.lstatSync(common.continuaMetadataDirectory);
        common.fatalError(couldNotInit_metadataDirExists);
    } catch (e) {
        // Ignore. We only proceed if '.continua' does not exist.
    }

    // Attempt to make '.continua' directory.
    try {
        fs.mkdirSync(common.continuaMetadataDirectory);
    } catch (e) {
        common.fatalError(couldNotInit_createDirFailed(e));
    }
}

function tryCreateBrokersRegistry() {
    const brokersFile = path.join(
        common.continuaMetadataDirectory,
        common.brokersFileName);

    // Attempt to make file to track service brokers.
    let fd: number;
    try {
        // Technically, we can use the 'w' flag here, since it doesn't matter
        // if the file is truncated. We pick 'a' because we will never hurt
        // anyone by not deleting the current local service broker registry.
        fd = fs.openSync(brokersFile, 'a');
    } catch (e) {
        common.fatalError(couldNotInit_brokersFileCreateFailed(e));
    } finally {
        fs.closeSync(fd);
    }
}


// ----------------------------------------------------------------------------
// CLI application logic.
// ----------------------------------------------------------------------------
function initialize(): void {
    tryCreateMetadataDirectory();
    tryCreateBrokersRegistry();

    console.log("Successfully initialized Continua project");
}


// ----------------------------------------------------------------------------
// Parse command line.
// ----------------------------------------------------------------------------
var program = require("commander");

if (process.argv.length != 2) {
    program.help();
}
else {
    initialize();
}
