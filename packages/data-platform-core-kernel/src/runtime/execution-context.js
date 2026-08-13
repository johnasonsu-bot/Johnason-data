const { AsyncLocalStorage } = require("node:async_hooks");

const executionContextStorage = new AsyncLocalStorage();

function runWithExecutionContext(context, callback) {
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    throw new TypeError("Execution context must be an object");
  }
  if (typeof callback !== "function") throw new TypeError("Execution callback must be a function");
  return executionContextStorage.run(Object.freeze({ ...context }), callback);
}

function getExecutionContext() {
  return executionContextStorage.getStore() || null;
}

module.exports = { runWithExecutionContext, getExecutionContext };
