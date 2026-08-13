const { CliError, executeWithProfile, revalidateSession } = require("../runtime/cli-execution");

function matchProjects(projects, input) {
  return projects.filter((project) => {
    if (input.projectId !== undefined && Number(project.id) !== Number(input.projectId)) return false;
    if (input.code !== undefined && String(project.code ?? project.projectCode) !== String(input.code)) return false;
    if (input.name !== undefined && String(project.name ?? project.projectName) !== String(input.name)) return false;
    return true;
  });
}

function requireOne(projects) {
  if (projects.length !== 1) {
    throw new CliError("Project lookup must resolve exactly one project", {
      code: "PROJECT_NOT_UNIQUE",
      statusCode: 409,
      details: { count: projects.length },
    });
  }
  return projects[0];
}

function createProjectCommands(dependencies) {
  async function execute(capabilityId, input = {}) {
    return executeWithProfile(dependencies, async ({ core, profile, runtimePorts }) => {
      const session = await revalidateSession(dependencies, core, profile, runtimePorts);
      return core.execute(capabilityId, input.payload || {}, { actor: session.user, token: session.token });
    }, input);
  }

  async function list(input = {}) {
    return execute("project.list-my", input);
  }

  async function resolve(input = {}) {
    const matches = matchProjects(await list(input), input);
    return requireOne(matches);
  }

  return Object.freeze({
    list,
    async current(input = {}) {
      return executeWithProfile(dependencies, async ({ core, profile, runtimePorts }) => {
        const session = await revalidateSession(dependencies, core, profile, runtimePorts);
        if (profile.currentProjectId !== undefined) return { projectId: profile.currentProjectId };
        const projectId = await core.execute("project.current", {}, { actor: session.user, token: session.token });
        return { projectId };
      }, input);
    },
    resolve,
    async use(input = {}) {
      return executeWithProfile(dependencies, async ({ profile }) => {
        const project = input.projectId === undefined ? await resolve(input) : requireOne(matchProjects(await list(input), input));
        dependencies.profileStore.setCurrentProject(profile.name, Number(project.id));
        return Object.freeze({ projectId: Number(project.id) });
      }, input);
    },
    async accessCheck(input = {}) {
      const result = await execute("project.access-check", { ...input, payload: { projectId: input.projectId, action: input.action } });
      return Object.freeze({
        allowed: result.allowed === undefined ? true : result.allowed === true,
        projectId: Number(result.project?.id ?? result.projectId),
        projectRole: result.member?.projectRole ?? result.member?.role ?? result.projectRole,
        modules: Object.freeze([...(result.modules || result.member?.permissions?.modules || [])]),
      });
    },
  });
}

module.exports = { createProjectCommands };
