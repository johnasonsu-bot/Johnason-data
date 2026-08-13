const assert = require("node:assert/strict");
const test = require("node:test");

// These checks catch policy bypasses, an unauthorized project fallback, or a
// shared async project context.  Expected DTOs are hand-written from the Web
// contract rather than derived from the implementation.
function project(id, overrides = {}) {
  return { id, projectName: `Project ${id}`, projectCode: `project_${id}`, status: "active", ...overrides };
}

function member(projectId, userId, overrides = {}) {
  return { projectId, userId, projectRole: "developer", status: "active", permissions: { modules: [] }, ...overrides };
}

function createFixture() {
  const projects = new Map([
    [1, project(1, { projectCode: "default" })],
    [2, project(2)],
    [3, project(3, { status: "disabled" })],
  ]);
  const memberships = new Map([
    ["9:1", member(1, 9)],
    ["9:2", member(2, 9)],
    ["8:1", member(1, 8, { projectRole: "viewer" })],
  ]);
  const defaults = new Map([[9, 2]]);
  const repository = {
    async ensureDefaultProject() { return projects.get(1); },
    async ensureUserMembership(projectId, userId, projectRole = "developer") {
      if (!memberships.has(`${userId}:${projectId}`)) memberships.set(`${userId}:${projectId}`, member(projectId, userId, { projectRole }));
    },
    async listProjects({ includeInactive = false } = {}) { return [...projects.values()].filter((entry) => includeInactive || entry.status === "active"); },
    async listUserProjects(userId) { return [...projects.values()].filter((entry) => memberships.get(`${userId}:${entry.id}`)?.status === "active" && entry.status === "active"); },
    async getProjectById(id) { return projects.get(Number(id)) || null; },
    async getProjectMember(projectId, userId) { return memberships.get(`${userId}:${projectId}`) || null; },
    async getUserDefaultProjectId(userId) { return defaults.get(Number(userId)) || null; },
    async setUserDefaultProject(userId, projectId) { defaults.set(Number(userId), Number(projectId)); return true; },
  };
  return { repository, projects, memberships, defaults };
}

function actor(id, overrides = {}) {
  return { sub: id, roleCode: "developer", permissions: { modules: ["data_map"] }, ...overrides };
}

function loadCandidate() {
  return require("../src");
}

test("project admin resolves a requested active project with the legacy owner-member DTO", async () => {
  const { createProjectCapabilities } = loadCandidate();
  const capabilities = createProjectCapabilities({ projectRepository: createFixture().repository });
  assert.deepEqual(await capabilities.project.resolve(actor(1, { roleCode: "admin" }), 2), {
    project: project(2),
    member: { projectId: 2, userId: 1, projectRole: "owner", status: "active" },
  });
});

test("project viewer write is denied with a stable policy error", () => {
  const { authorizeCapability } = loadCandidate();
  assert.throws(
    () => authorizeCapability(actor(8, { roleCode: "viewer", permissions: { modules: ["data_map"] } }), { modules: ["data_map"], action: "write", readOnlyAllowed: false }),
    (error) => error.code === "READ_ONLY_FORBIDDEN" && error.statusCode === 403 && error.retryable === false && error.details?.modules?.[0] === "data_map",
  );
});

test("project module access rejection carries the required modules without actor permissions", () => {
  const { authorizeCapability } = loadCandidate();
  assert.throws(
    () => authorizeCapability(actor(9, { permissions: { modules: ["quality"] } }), { modules: ["data_map"], action: "read", readOnlyAllowed: true }),
    (error) => error.code === "MODULE_PERMISSION_FORBIDDEN" && error.statusCode === 403 && error.retryable === false && error.details?.modules?.join(",") === "data_map",
  );
});

test("project resolution rejects a missing membership instead of falling back", async () => {
  const { createProjectCapabilities } = loadCandidate();
  const capabilities = createProjectCapabilities({ projectRepository: createFixture().repository });
  await assert.rejects(
    capabilities.project.resolve(actor(10), 2),
    (error) => error.code === "PROJECT_ACCESS_FORBIDDEN" && error.statusCode === 403 && error.retryable === false,
  );
});

test("project resolution rejects disabled requested projects", async () => {
  const { createProjectCapabilities } = loadCandidate();
  const capabilities = createProjectCapabilities({ projectRepository: createFixture().repository });
  await assert.rejects(
    capabilities.project.resolve(actor(9), 3),
    (error) => error.code === "PROJECT_UNAVAILABLE" && error.statusCode === 403 && error.retryable === false,
  );
});

test("project contexts remain isolated across concurrent operations", async () => {
  const { runWithProjectContext, getProjectContext } = loadCandidate();
  const seen = await Promise.all([
    runWithProjectContext({ projectId: 1 }, async () => { await new Promise((resolve) => setImmediate(resolve)); return getProjectContext().projectId; }),
    runWithProjectContext({ projectId: 2 }, async () => { await new Promise((resolve) => setImmediate(resolve)); return getProjectContext().projectId; }),
  ]);
  assert.deepEqual(seen.sort(), [1, 2]);
});

test("project default selection uses a valid saved default and rejects inaccessible replacement", async () => {
  const { createProjectCapabilities } = loadCandidate();
  const fixture = createFixture();
  const capabilities = createProjectCapabilities({ projectRepository: fixture.repository });
  assert.equal(await capabilities.project.current(actor(9)), 2);
  await assert.rejects(capabilities.project.setDefault(3, actor(9)), (error) => error.code === "PROJECT_DEFAULT_INVALID" && error.statusCode === 400);
  assert.equal(fixture.defaults.get(9), 2);
});

test("project resolve selects the single eligible project and reports deterministic zero/multiple eligibility outcomes", async () => {
  const { createProjectCapabilities } = loadCandidate();
  const fixture = createFixture();
  const capabilities = createProjectCapabilities({ projectRepository: fixture.repository });
  assert.equal((await capabilities.project.resolve(actor(8), null)).project.id, 1);
  const emptyCapabilities = createProjectCapabilities({ projectRepository: {
    ...fixture.repository,
    async ensureDefaultProject() { return null; },
    async listUserProjects() { return []; },
  } });
  await assert.rejects(emptyCapabilities.project.resolve(actor(8), null), (error) => error.code === "PROJECT_UNAVAILABLE");
  assert.equal((await capabilities.project.resolve(actor(9), null)).project.id, 2);
});

test("module manifest covers project list/current/resolve/use/access-check and their source API keys", () => {
  const { moduleManifest } = loadCandidate();
  assert.deepEqual(moduleManifest.capabilities.map((entry) => entry.capabilityId), [
    "project.list", "project.current", "project.resolve", "project.use", "project.access-check",
  ]);
  assert.equal(moduleManifest.capabilities.flatMap((entry) => entry.sourceApiKeys).includes("GET /api/v1/projects/my"), true);
  assert.equal(moduleManifest.capabilities.flatMap((entry) => entry.sourceApiKeys).includes("POST /api/v1/projects/:id/default"), true);
});
