const { z } = require("../../common/middleware/validate");

const updateConfigSchema = z.object({
  defaultModelProviderId: z.number().int().positive().nullable().optional(),
  defaultModelName: z.string().trim().max(128).optional().or(z.literal("")),
  defaultModelVersion: z.string().trim().max(128).optional().or(z.literal("")),
  temperature: z.number().min(0).max(2).nullable().optional(),
  maxTokens: z.number().int().min(1).max(32000).nullable().optional(),
  timeoutMs: z.number().int().min(1000).max(7200000).nullable().optional(),
  systemPrompt: z.string().trim().max(8000).optional().or(z.literal("")),
});

module.exports = {
  updateIngestionAiConfigSchema: updateConfigSchema,
};
