const repository = require("../asset-search.repository");

async function search(criteria) {
  const [dataSources, tasks, researchTables, researchFields] = await Promise.all([
    repository.searchIngestionDataSources(criteria),
    repository.searchIngestionTasks(criteria),
    repository.searchIngestionResearchTables(criteria),
    repository.searchIngestionResearchFields(criteria),
  ]);
  return [...dataSources, ...tasks, ...researchTables, ...researchFields];
}

module.exports = {
  search,
};
