const { z } = require("../../common/middleware/validate");

const serviceSchema = z.object({
  serviceKey: z.string().trim().min(2).max(64).regex(/^[a-z0-9_]+$/, "服务编码仅支持小写字母、数字和下划线"),
  serviceName: z.string().trim().min(2).max(128),
  serviceCategory: z.enum(["application", "database", "platform", "custom"]).default("custom"),
  serviceType: z.enum(["backend", "frontend", "mysql", "postgresql", "hive", "kafka", "custom"]).default("custom"),
  manageMode: z.enum(["process", "docker", "docker_compose", "command"]).default("command"),
  host: z.string().trim().max(128).optional().or(z.literal("")),
  port: z.number().int().min(1).max(65535).optional().nullable(),
  autoStart: z.boolean().optional().default(false),
  status: z.enum(["active", "inactive"]).default("active"),
  notes: z.string().trim().max(512).optional().or(z.literal("")),
  config: z.record(z.any()).optional().default({})
});

const roleSchema = z.object({
  roleName: z.string().trim().min(2).max(64),
  roleCode: z.string().trim().min(2).max(32).regex(/^[a-z0-9_]+$/, "角色编码仅支持小写字母、数字和下划线"),
  roleType: z.enum(["admin", "developer", "operator", "viewer", "custom"]).default("custom"),
  permissions: z.object({
    modules: z.array(z.string().trim().min(1)).default([]),
    mode: z.enum(["readonly"]).optional(),
    actions: z.array(z.string().trim().min(1)).optional()
  }).default({ modules: [] }),
  status: z.enum(["active", "inactive"]).default("active")
});

const createUserSchema = z.object({
  username: z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9_]+$/, "用户名仅支持字母、数字和下划线"),
  password: z.string().trim().min(6).max(64),
  displayName: z.string().trim().min(2).max(64),
  roleId: z.number().int().positive("请选择角色"),
  status: z.enum(["active", "inactive"]).default("active")
});

const updateUserSchema = createUserSchema.extend({
  password: z.string().trim().min(6).max(64).optional().or(z.literal(""))
});

module.exports = {
  createServiceSchema: serviceSchema,
  updateServiceSchema: serviceSchema,
  createRoleSchema: roleSchema,
  updateRoleSchema: roleSchema,
  createUserSchema,
  updateUserSchema
};
