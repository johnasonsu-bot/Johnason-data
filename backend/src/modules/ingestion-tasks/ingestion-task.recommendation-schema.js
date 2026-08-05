const { z } = require("../../common/middleware/validate");

const recommendTaskConfigSchema = z.object({
  sourceId: z.number().int().positive(),
  sourceTable: z.string().trim().min(1),
  targetSourceId: z.number().int().positive(),
  targetTable: z.string().trim().optional().or(z.literal("")),
  targetTableMode: z.enum(["existing", "create"]).optional(),
  taskName: z.string().trim().optional().or(z.literal("")),
  taskCode: z.string().trim().optional().or(z.literal("")),
  ownerName: z.string().trim().optional().or(z.literal("")),
  description: z.string().trim().optional().or(z.literal(""))
});

module.exports = {
  recommendTaskConfigSchema
};

