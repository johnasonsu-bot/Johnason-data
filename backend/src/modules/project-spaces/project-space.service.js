const AppError = require("../../common/errors/app-error");
const repository = require("./project-space.repository");

function isAdmin(user) {
  return String(user?.roleCode || "").toLowerCase() === "admin";
}

async function ensureDefaultMembershipForUser(user) {
  const defaultProject = await repository.ensureDefaultProject();
  if (!user?.sub || isAdmin(user)) {
    return defaultProject;
  }

  const existingMember = await repository.getProjectMember(defaultProject.id, user.sub);
  if (!existingMember) {
    await repository.ensureUserMembership(defaultProject.id, user.sub, "developer");
  }
  return defaultProject;
}

async function listMyProjects(user) {
  if (!user?.sub) return [];
  await ensureDefaultMembershipForUser(user);
  if (isAdmin(user)) {
    return repository.listProjects();
  }
  return repository.listUserProjects(user.sub);
}

async function getUserDefaultProjectId(user) {
  if (!user?.sub) return null;
  const projectId = await repository.getUserDefaultProjectId(user.sub);
  if (!projectId) return null;
  const project = await repository.getProjectById(projectId);
  if (!project || project.status !== "active") {
    return null;
  }
  if (isAdmin(user)) {
    return project.id;
  }
  const member = await repository.getProjectMember(project.id, user.sub);
  return member?.status === "active" ? project.id : null;
}

async function resolveRequestProject(user, requestedProjectId) {
  const defaultProject = await ensureDefaultMembershipForUser(user);
  const normalizedRequestedId = Number(requestedProjectId || 0) || null;

  let project = normalizedRequestedId
    ? await repository.getProjectById(normalizedRequestedId)
    : null;

  if (!project) {
    const projects = isAdmin(user)
      ? await repository.listProjects()
      : await repository.listUserProjects(user.sub);
    project = projects[0] || defaultProject;
  }

  if (!project || project.status !== "active") {
    throw new AppError("当前项目空间不存在或已停用", 403);
  }

  if (isAdmin(user)) {
    return {
      project,
      member: { projectId: project.id, userId: Number(user.sub), projectRole: "owner", status: "active" },
    };
  }

  const member = await repository.getProjectMember(project.id, user.sub);
  if (!member || member.status !== "active") {
    throw new AppError("当前账号无权访问该项目空间", 403);
  }

  return { project, member };
}

async function listProjects() {
  await repository.ensureDefaultProject();
  return repository.listProjects({ includeInactive: true });
}

async function setDefaultProject(id, user) {
  if (!user?.sub) {
    throw new AppError("请先登录后再设置默认项目", 401);
  }
  const project = await repository.getProjectById(id);
  if (!project || project.status !== "active") {
    throw new AppError("只能将启用状态的项目设置为默认项目", 400);
  }
  if (!isAdmin(user)) {
    const member = await repository.getProjectMember(project.id, user.sub);
    if (!member || member.status !== "active") {
      throw new AppError("当前账号无权将该项目设置为默认项目", 403);
    }
  }
  await repository.setUserDefaultProject(user.sub, project.id);
  return { defaultProjectId: project.id, project };
}

async function getProjectDetail(id) {
  const project = await repository.getProjectById(id);
  if (!project) {
    throw new AppError("项目空间不存在", 404);
  }
  const members = await repository.listProjectMembers(id);
  return { ...project, members };
}

async function createProject(payload, user) {
  const existing = await repository.getProjectByCode(payload.projectCode);
  if (existing) {
    throw new AppError("项目编码已存在", 409);
  }
  return repository.createProject(payload, user);
}

async function updateProject(id, payload) {
  const existing = await repository.getProjectById(id);
  if (!existing) {
    throw new AppError("项目空间不存在", 404);
  }
  const conflict = await repository.getProjectByCode(payload.projectCode);
  if (conflict && conflict.id !== Number(id)) {
    throw new AppError("项目编码已存在", 409);
  }
  const row = await repository.updateProject(id, payload);
  if (!row) {
    throw new AppError("项目空间不存在", 404);
  }
  return row;
}

async function updateProjectStatus(id, status) {
  const project = await repository.getProjectById(id);
  if (!project) {
    throw new AppError("项目空间不存在", 404);
  }
  if (project.projectCode === repository.DEFAULT_PROJECT_CODE && status !== "active") {
    throw new AppError("默认项目空间不能停用", 400);
  }
  await repository.updateProjectStatus(id, status);
  return repository.getProjectById(id);
}

async function upsertProjectMember(projectId, payload) {
  const project = await repository.getProjectById(projectId);
  if (!project) {
    throw new AppError("项目空间不存在", 404);
  }
  return repository.upsertProjectMember(projectId, payload);
}

async function removeProjectMember(projectId, userId) {
  const project = await repository.getProjectById(projectId);
  if (!project) {
    throw new AppError("项目空间不存在", 404);
  }
  if (project.projectCode === repository.DEFAULT_PROJECT_CODE) {
    throw new AppError("默认项目成员不能移除", 400);
  }
  const deleted = await repository.removeProjectMember(projectId, userId);
  if (!deleted) {
    throw new AppError("项目成员不存在", 404);
  }
  return { projectId, userId };
}

async function deleteProject(id) {
  const project = await repository.getProjectById(id);
  if (!project) {
    throw new AppError("项目空间不存在", 404);
  }
  if (project.projectCode === repository.DEFAULT_PROJECT_CODE) {
    throw new AppError("默认项目空间不能删除", 400);
  }
  await repository.deleteProject(id);
  return { projectId: id, deleted: true };
}

module.exports = {
  listMyProjects,
  getUserDefaultProjectId,
  resolveRequestProject,
  listProjects,
  setDefaultProject,
  getProjectDetail,
  createProject,
  updateProject,
  updateProjectStatus,
  upsertProjectMember,
  removeProjectMember,
  deleteProject,
};
