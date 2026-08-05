const repository = require("../asset-search.repository");

async function search(criteria) {
  const [tables, fields, dataSources] = await Promise.all([
    repository.searchDataMapTables(criteria),
    repository.searchDataMapFields(criteria),
    repository.searchDataMapDataSources(criteria),
  ]);
  return [...tables, ...fields, ...dataSources];
}

module.exports = {
  search,
};
