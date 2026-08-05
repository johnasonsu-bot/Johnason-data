const multer = require("multer");
const { z } = require("../../common/middleware/validate");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 20,
  },
});

const suggestTechnicalNameFieldSchema = z.union([
  z.string().min(1),
  z.object({
    sourceField: z.string().min(1),
    targetField: z.string().optional().default(""),
    columnComment: z.string().optional().default(""),
    dataType: z.string().optional().default(""),
    inferredType: z.string().optional().default(""),
    maxLength: z.coerce.number().optional().default(0),
    nullable: z.boolean().optional(),
    sampleValues: z.array(z.unknown()).optional().default([]),
  }),
]);

const suggestTechnicalNamesSchema = z.object({
  fields: z.array(suggestTechnicalNameFieldSchema).min(1).max(200),
  technicalNameMode: z.enum(["snake_case", "camelCase", "upper_snake"]).optional().default("snake_case"),
  modelProviderId: z.coerce.number().int().positive().optional().nullable(),
});

module.exports = {
  suggestTechnicalNamesSchema,
  upload,
};
