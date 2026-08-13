const { isAdmin, projectError, resolveProject } = require("./project-policy");

function createProjectSpaceService({ projectRepository }) {
  if (!projectRepository) throw new TypeError("Project space service requires projectRepository");

  async function ensureDefaultMembershipForUser(actor) {
    const defaultProject = await projectRepository.ensureDefaultProject();
    if (!actor?.sub || isAdmin(actor)) return defaultProject;
    if (!defaultProject) return null;
    const existingMember = await projectRepository.getProjectMember(defaultProject.id, actor.sub);
    if (!existingMember) await projectRepository.ensureUserMembership(defaultProject.id, actor.sub, "developer");
    return defaultProject;
  }

  async function listMyProjects(actor) {
    if (!actor?.sub) return [];
    await ensureDefaultMembershipForUser(actor);
    return isAdmin(actor) ? projectRepository.listProjects() : projectRepository.listUserProjects(actor.sub);
  }

  async function getUserDefaultProjectId(actor) {
    if (!actor?.sub) return null;
    const projectId = await projectRepository.getUserDefaultProjectId(actor.sub);
    if (!projectId) return null;
    const project = await projectRepository.getProjectById(projectId);
    if (!project || project.status !== "active") return null;
    if (isAdmin(actor)) return project.id;
    const membership = await projectRepository.getProjectMember(project.id, actor.sub);
    return membership?.status === "active" ? project.id : null;
  }

  async function resolveRequestProject(actor, requestedProjectId) {
    const defaultProject = await ensureDefaultMembershipForUser(actor);
    const requestedId = Number(requestedProjectId || 0) || null;
    let project = requestedId ? await projectRepository.getProjectById(requestedId) : null;
    if (!project) {
      const candidates = isAdmin(actor) ? await projectRepository.listProjects() : await projectRepository.listUserProjects(actor?.sub);
      const savedDefaultId = await getUserDefaultProjectId(actor);
      project = candidates.find((candidate) => candidate.id === savedDefaultId) || candidates[0] || defaultProject;
    }
    if (!project || project.status !== "active") throw projectError("当前项目空间不存在或已停用", "PROJECT_UNAVAILABLE", 403);
    if (isAdmin(actor)) return { project, member: { projectId: project.id, userId: Number(actor.sub), projectRole: "owner", status: "active" } };
    const membership = await projectRepository.getProjectMember(project.id, actor?.sub);
    if (!membership || membership.status !== "active") throw projectError("当前账号无权访问该项目空间", "PROJECT_ACCESS_FORBIDDEN", 403);
    return { project, member: membership };
  }

  async function setDefaultProject(id, actor) {
    if (!actor?.sub) throw projectError("请先登录后再设置默认项目", "PROJECT_AUTH_REQUIRED", 401);
    const project = await projectRepository.getProjectById(id);
    if (!project || project.status !== "active") throw projectError("只能将启用状态的项目设置为默认项目", "PROJECT_DEFAULT_INVALID", 400);
    if (!isAdmin(actor)) {
      const membership = await projectRepository.getProjectMember(project.id, actor.sub);
      if (!membership || membership.status !== "active") throw projectError("当前账号无权将该项目设置为默认项目", "PROJECT_ACCESS_FORBIDDEN", 403);
    }
    await projectRepository.setUserDefaultProject(actor.sub, project.id);
    return { defaultProjectId: project.id, project };
  }

  return Object.freeze({ ensureDefaultMembershipForUser, listMyProjects, getUserDefaultProjectId, resolveRequestProject, resolveProject: (actor, id) => resolveProject(actor, id, { resolveRequestProject }), setDefaultProject });
}

module.exports = { createProjectSpaceService };
