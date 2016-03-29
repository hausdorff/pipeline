import * as babylon from "babylon";
import traverse from "babel-traverse";
import * as t from "babel-types";
import generate from "babel-generator";
import template from "babel-template";

//
// EXAMPLE 1.
//
const code = `var i = 42;

function forward(f) {
}

function square(n) {
    forward(function() { return i; })
    return n * n;
}`;

// Parse the function.
const ast = babylon.parse(code);

// Change the symbol `n` -> `x`, using the `babel-traverse` API.
traverse(ast, {
    enter(path) {
        if (
          path.node.type === "Identifier" &&
          path.node.name === "forward"
        ) {
            //   console.log(path.node);
            path.node.name = "x";
        }
    }
});

// Change the symbol `n` -> `x`, using the `babel-types` API.
traverse(ast, {
    enter(path) {
        if (t.isIdentifier(path.node, { name: "n" })) {
            path.node.name = "x";
        }
    }
});

// Generate the code after the traversal.
const generatedCode = generate(ast, null, code);

console.log("Rewritten code:");
console.log(generatedCode.code);
console.log()


//
// EXAMPLE 2.
//

// Declare AST template.
const buildRequire = template(`
    var IMPORT_NAME = require(SOURCE);
`);

// Construct AST from template.
const ast2 = buildRequire({
    IMPORT_NAME: t.identifier("myModule"),
    SOURCE: t.stringLiteral("my-module")
});

// Generate code.
console.log("Templated AST:");
console.log(generate(ast2).code);

//
// EXAMPLE 3.
//

const forwardTemplate = template(`forward(TO_FORWARD)`);

const ast3 = forwardTemplate({
    // TODO: `t.identifer` is obviously the wrong thing to put here.
    TO_FORWARD: t.identifier(`function() { return "cow"; }`)
});

console.log("Templated AST 2:");
console.log(generate(ast3).code);
