const jwt = require("jsonwebtoken");
const env = require("../../config/env");
const authRepository = require("../../modules/auth/auth.repository");
const sessionRepository = require("../../modules/auth/auth-session.repository");
const projectSpaceService = require("../../modules/project-spaces/project-space.service");
const { runWithProjectContext } = require("../utils/project-context");
const {
  getRequiredModulesForApiPath,
  hasAnyModulePermission,
  isReadOnlyAllowedRequest,
  isReadOnlyUser,
} = require("../utils/user-permissions");

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(401).json({ success: false, message: "未登录或登录已过期" });
  }

  try {
    req.user = jwt.verify(token, env.jwtSecret);
  } catch (error) {
    return res.status(401).json({ success: false, message: "Token 无效" });
  }

  const session = await sessionRepository.findActiveSession(req.user.sessionId);
  if (!session || Number(session.userId) !== Number(req.user.sub)) {
    return res.status(401).json({ success: false, message: "登录会话已失效，请重新登录" });
  }
  await sessionRepository.touchSession(req.user.sessionId);

  const profile = await authRepository.findProfileById(req.user.sub);
  if (!profile || profile.status !== "active") {
    return res.status(401).json({ success: false, message: "用户不存在或已停用" });
  }
  req.user = {
    ...req.user,
    id: profile.id,
    sub: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    roleId: profile.roleId,
    roleCode: profile.roleCode,
    roleType: profile.roleType,
    roleName: profile.roleName || profile.roleCode,
    defaultProjectId: profile.defaultProjectId,
    permissions: profile.permissions || { modules: [] },
  };

  const requiredModules = getRequiredModulesForApiPath(req.originalUrl || req.path);
  if (!hasAnyModulePermission(req.user, requiredModules)) {
    return res.status(403).json({
      success: false,
      message: "当前角色无权访问该功能模块",
      code: "MODULE_PERMISSION_FORBIDDEN",
      details: { requiredModules },
    });
  }

  if (isReadOnlyUser(req.user) && !isReadOnlyAllowedRequest(req.method, req.originalUrl || req.path)) {
    return res.status(403).json({
      success: false,
      message: "只读用户仅允许查看，不能执行新建、修改、删除、运行或发布操作",
      code: "READ_ONLY_FORBIDDEN",
    });
  }

  try {
    const shouldIgnoreRequestedProject = String(req.originalUrl || "").startsWith("/api/v1/projects/my");
    const requestedProjectId = shouldIgnoreRequestedProject ? null : (req.headers["x-project-id"] || req.query?.projectId);
    const { project, member } = await projectSpaceService.resolveRequestProject(req.user, requestedProjectId);
    req.project = project;
    req.projectId = project.id;
    req.projectMember = member;
    return runWithProjectContext({ projectId: project.id, project, member }, () => next());
  } catch (error) {
    return res.status(error.statusCode || 403).json({
      success: false,
      message: error.message || "项目空间校验失败",
      details: error.details,
    });
  }
}

module.exports = authMiddleware;
