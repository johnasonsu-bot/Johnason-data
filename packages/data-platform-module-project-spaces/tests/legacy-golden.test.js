const assert = require("node:assert/strict");
const test = require("node:test");
const { createLegacyProjectAdapter } = require("../../../tests/module-acceptance/fixtures/project-spaces-legacy-v0.1.0/src");
const { createProjectCapabilities } = require("../src");

function fixture() {
  const projects = new Map([[1, { id: 1, projectName: "Default", projectCode: "default", status: "active" }], [2, { id: 2, projectName: "Program", projectCode: "program", status: "active" }]]);
  const members = new Map([["5:1", { projectId: 1, userId: 5, projectRole: "developer", status: "active" }], ["5:2", { projectId: 2, userId: 5, projectRole: "developer", status: "active" }]]);
  const defaults = new Map([[5, 2]]);
  const repository = {
    async ensureDefaultProject() { return projects.get(1); }, async ensureUserMembership() {},
    async listProjects() { return [...projects.values()]; }, async listUserProjects(id) { return [...projects.values()].filter((project) => members.has(`${id}:${project.id}`)); },
    async getProjectById(id) { return projects.get(Number(id)) || null; }, async getProjectMember(projectId, userId) { return members.get(`${userId}:${projectId}`) || null; },
    async getUserDefaultProjectId(id) { return defaults.get(Number(id)) || null; }, async setUserDefaultProject(id, projectId) { defaults.set(Number(id), Number(projectId)); return true; },
  };
  return { repository, defaults };
}

test("candidate retains baseline 8414786 Web golden project DTOs for list/current/resolve/default", async () => {
  const legacyFixture = fixture();
  const candidateFixture = fixture();
  const actor = { sub: 5, roleCode: "developer" };
  const legacy = createLegacyProjectAdapter(legacyFixture.repository);
  const candidate = createProjectCapabilities({ projectRepository: candidateFixture.repository }).project;
  assert.deepEqual(await candidate.list(actor), await legacy.listMyProjects(actor));
  assert.equal(await candidate.current(actor), await legacy.getUserDefaultProjectId(actor));
  assert.deepEqual(await candidate.resolve(actor, 2), await legacy.resolveRequestProject(actor, 2));
  assert.deepEqual(await candidate.setDefault(1, actor), await legacy.setDefaultProject(1, actor));
  assert.equal(candidateFixture.defaults.get(5), legacyFixture.defaults.get(5));
});
