export const systemTabs = [
  { key: "services", label: "服务管理", path: "/dashboard/system-services" },
  { key: "database-drivers", label: "驱动管理", path: "/dashboard/system-database-drivers" },
  { key: "users", label: "用户管理", path: "/dashboard/system-users" },
  { key: "roles", label: "角色管理", path: "/dashboard/system-roles" },
  { key: "models", label: "模型管理", path: "/dashboard/system-models" },
  { key: "projects", label: "项目管理", path: "/dashboard/system-projects" },
  { key: "knowledge-industry", label: "行业知识库", path: "/dashboard/system-knowledge-bases/industry" },
  { key: "knowledge-platform", label: "平台知识库", path: "/dashboard/system-knowledge-bases/platform" },
  { key: "knowledge-personal", label: "个人知识库", path: "/dashboard/system-knowledge-bases/personal" },
] as const;
