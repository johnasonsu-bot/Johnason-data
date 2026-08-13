const assert = require("node:assert/strict");
const test = require("node:test");
const { createProjectSpaceRepository } = require("../src");

test("default project creation retains the legacy first-admin owner lookup and assignment", async () => {
  const calls = [];
  let defaultProject = null;
  const pool = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes("WHERE project_code = ?")) return [[defaultProject].filter(Boolean)];
      if (sql.includes("WHERE role_code = 'admin'")) return [[{ id: 41, displayName: "First Admin" }]];
      if (sql.startsWith("INSERT INTO project_spaces")) {
        defaultProject = { id: 1, projectName: "默认项目", projectCode: "default", ownerUserId: params[1], ownerName: params[2], status: "active" };
        return [{ affectedRows: 1 }];
      }
      throw new Error("unexpected query");
    },
  };
  const repository = createProjectSpaceRepository({ getDatabaseRuntime: () => ({ pool }) });
  const created = await repository.ensureDefaultProject();
  assert.equal(created.ownerUserId, 41);
  assert.equal(created.ownerName, "First Admin");
  assert.equal(calls.some(({ sql }) => sql.includes("WHERE role_code = 'admin'")), true);
  const insert = calls.find(({ sql }) => sql.startsWith("INSERT INTO project_spaces"));
  assert.deepEqual(insert.params, ["default", 41, "First Admin"]);
});
