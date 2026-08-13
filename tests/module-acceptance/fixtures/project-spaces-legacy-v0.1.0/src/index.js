// Test-only transport-neutral adapter transcribed from backend project-space
// service behavior at base commit 8414786. It is never imported by runtime.
function legacyError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isAdmin(user) {
  return String(user?.roleCode || "").toLowerCase() === "admin";
}

function createLegacyProjectAdapter(repository) {
  async function ensureDefaultMembershipForUser(user) {
    const defaultProject = await repository.ensureDefaultProject();
    if (!user?.sub || isAdmin(user)) return defaultProject;
    const existingMember = await repository.getProjectMember(defaultProject.id, user.sub);
    if (!existingMember) await repository.ensureUserMembership(defaultProject.id, user.sub, "developer");
    return defaultProject;
  }
  async function listMyProjects(user) {
    if (!user?.sub) return [];
    await ensureDefaultMembershipForUser(user);
    return isAdmin(user) ? repository.listProjects() : repository.listUserProjects(user.sub);
  }
  async function getUserDefaultProjectId(user) {
    if (!user?.sub) return null;
    const projectId = await repository.getUserDefaultProjectId(user.sub);
    if (!projectId) return null;
    const project = await repository.getProjectById(projectId);
    if (!project || project.status !== "active") return null;
    if (isAdmin(user)) return project.id;
    const member = await repository.getProjectMember(project.id, user.sub);
    return member?.status === "active" ? project.id : null;
  }
  async function resolveRequestProject(user, requestedProjectId) {
    const defaultProject = await ensureDefaultMembershipForUser(user);
    const normalizedRequestedId = Number(requestedProjectId || 0) || null;
    let project = normalizedRequestedId ? await repository.getProjectById(normalizedRequestedId) : null;
    if (!project) {
      const projects = isAdmin(user) ? await repository.listProjects() : await repository.listUserProjects(user.sub);
      project = projects[0] || defaultProject;
    }
    if (!project || project.status !== "active") throw legacyError("当前项目空间不存在或已停用", 403);
    if (isAdmin(user)) return { project, member: { projectId: project.id, userId: Number(user.sub), projectRole: "owner", status: "active" } };
    const member = await repository.getProjectMember(project.id, user.sub);
    if (!member || member.status !== "active") throw legacyError("当前账号无权访问该项目空间", 403);
    return { project, member };
  }
  async function setDefaultProject(id, user) {
    if (!user?.sub) throw legacyError("请先登录后再设置默认项目", 401);
    const project = await repository.getProjectById(id);
    if (!project || project.status !== "active") throw legacyError("只能将启用状态的项目设置为默认项目", 400);
    if (!isAdmin(user)) {
      const member = await repository.getProjectMember(project.id, user.sub);
      if (!member || member.status !== "active") throw legacyError("当前账号无权将该项目设置为默认项目", 403);
    }
    await repository.setUserDefaultProject(user.sub, project.id);
    return { defaultProjectId: project.id, project };
  }
  return Object.freeze({ listMyProjects, getUserDefaultProjectId, resolveRequestProject, setDefaultProject });
}

module.exports = { createLegacyProjectAdapter };
