const repository = require("../asset-search.repository");

async function search(criteria) {
  const [dataSources, apis, apps] = await Promise.all([
    repository.searchServiceDataSources(criteria),
    repository.searchServiceApis(criteria),
    repository.searchServiceApps(criteria),
  ]);
  return [...dataSources, ...apis, ...apps];
}

module.exports = {
  search,
};
