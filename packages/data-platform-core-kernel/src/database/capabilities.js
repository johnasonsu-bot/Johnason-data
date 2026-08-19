const { createDatabaseAdapter } = require("./contract");

function databaseAdapter(engine, drivers) {
  const driver = drivers instanceof Map ? drivers.get(engine) : drivers?.[engine];
  return createDatabaseAdapter(engine, driver);
}

module.exports = { databaseAdapter };
