const { z } = require("../../common/middleware/validate");

const analyzeFailureSchema = z.object({
  modelProviderId: z.number().int().positive().optional(),
  note: z.string().trim().max(1000).optional().or(z.literal(""))
});

module.exports = {
  analyzeFailureSchema
};
