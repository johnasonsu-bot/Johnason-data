const repository = require("../asset-search.repository");

async function search(criteria) {
  const [dataSources, tables, rules, strategies, results] = await Promise.all([
    repository.searchQualityDataSources(criteria),
    repository.searchQualityMonitorTables(criteria),
    repository.searchQualityRules(criteria),
    repository.searchQualityStrategies(criteria),
    repository.searchQualityResults(criteria),
  ]);
  return [...dataSources, ...tables, ...rules, ...strategies, ...results];
}

module.exports = {
  search,
};
