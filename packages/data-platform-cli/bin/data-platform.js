#!/usr/bin/env node

const { main } = require("../src/main");

main(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch(() => {
    process.stderr.write("Unexpected internal error\n");
    process.exitCode = 1;
  });
