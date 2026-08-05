const { z } = require("../../common/middleware/validate");

const projectSchema = z.object({
  projectName: z.string().trim().min(2).max(128),
  projectCode: z.string().trim().min(2).max(64).regex(/^[a-z0-9_]+$/, "项目编码仅支持小写字母、数字和下划线"),
  projectType: z.enum(["standard", "demo", "production", "sandbox", "government_data_project"]).default("standard"),
  description: z.string().trim().max(1024).optional().or(z.literal("")),
  ownerUserId: z.number().int().positive().optional().nullable(),
  ownerName: z.string().trim().max(64).optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]).default("active"),
  resourceConfig: z.record(z.any()).optional().default({}),
  settings: z.record(z.any()).optional().default({}),
});

const projectStatusSchema = z.object({
  status: z.enum(["active", "inactive"]),
});

const projectMemberSchema = z.object({
  userId: z.number().int().positive(),
  projectRole: z.enum(["owner", "developer", "operator", "viewer"]).default("developer"),
  permissions: z.object({
    modules: z.array(z.string().trim().min(1)).default([]),
  }).optional().default({ modules: [] }),
  status: z.enum(["active", "inactive"]).default("active"),
});

module.exports = {
  projectSchema,
  projectStatusSchema,
  projectMemberSchema,
};
