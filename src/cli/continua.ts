// ----------------------------------------------------------------------------
// Set up CLI options.
// ----------------------------------------------------------------------------
var program = require("commander");

program.version("0.0.1");

program
    .command("init", "Initialize a new Continua project")
    .command("broker", "Manage set of tracked service brokers");
    // .command("push", "Push stages to a Continua service broker")
    // .command("pull", "Pull stages from a Continua service broker")
    // .command("provision", "Provision a continuum")


// ----------------------------------------------------------------------------
// Parse command line.
// ----------------------------------------------------------------------------
if (process.argv.length == 2) {
    program.help();
}
else {
    program.parse(process.argv);
}
