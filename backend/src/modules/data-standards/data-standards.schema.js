const { z } = require("../../common/middleware/validate");

const statusSchema = z.enum(["active", "inactive"]).default("active");
const lifecycleStatusSchema = z.enum(["draft", "review", "published", "deprecated"]).default("draft");
const codeSchema = z.string().trim().min(2).max(128).regex(/^[A-Za-z0-9_.-]+$/, "编码仅支持字母、数字、下划线、点和短横线");
const elementCodeSchema = z.string().trim().regex(/^(GB|HB|QB)\d{5}$/i, "标准编码必须采用 GB/HB/QB+五位流水号，例如 GB00001");
const elementIdentifierSchema = z.string().trim().min(2).max(128).regex(/^(?!(STD|GB|HB|QB|BASE|DICT|PERSON|ORG|PLACE|EVENT|OBJECT|OPS)[._-])[A-Za-z][A-Za-z0-9_]*$/i, "标识符不要带前缀，仅支持字母、数字和下划线");
const elementStandardTypeSchema = z.enum(["national", "industry", "enterprise"]);
const optionalText = (max = 512) => z.string().trim().max(max).optional().nullable().or(z.literal(""));
const optionalPositiveId = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().int().positive().optional().nullable()
);
const tagsSchema = z.array(z.string().trim().min(1).max(64)).max(50).optional().default([]);

const catalogSchema = z.object({
  parentId: optionalPositiveId,
  catalogName: z.string().trim().min(2).max(128),
  catalogCode: codeSchema.max(64),
  catalogType: z.string().trim().min(1).max(32).optional().default("business_domain"),
  ownerName: optionalText(64),
  description: optionalText(4000),
  sortOrder: z.coerce.number().int().min(0).max(999999).optional().default(0),
  status: statusSchema,
});

const referenceStandardSchema = z.object({
  standardCode: codeSchema.max(64),
  standardName: z.string().trim().min(2).max(255),
  standardType: z.string().trim().min(1).max(32).optional().default("enterprise"),
  standardNo: optionalText(128),
  publisher: optionalText(128),
  effectiveDate: optionalText(32),
  standardUrl: optionalText(512),
  description: optionalText(4000),
  status: statusSchema,
});

const valueDomainItemSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  itemCode: z.string().trim().min(1).max(128),
  itemLabel: z.string().trim().min(1).max(255),
  itemValue: optionalText(255),
  itemMeaning: optionalText(512),
  sortOrder: z.coerce.number().int().min(0).max(999999).optional().default(0),
  status: statusSchema,
});

const valueDomainSchema = z.object({
  domainCode: codeSchema.max(64),
  domainName: z.string().trim().min(2).max(128),
  domainType: z.enum(["enumeration", "range", "regex", "reference", "free_text"]).optional().default("enumeration"),
  valueType: z.enum(["string", "number", "date", "datetime", "boolean"]).optional().default("string"),
  dataType: optionalText(64),
  minValue: z.coerce.number().nullable().optional(),
  maxValue: z.coerce.number().nullable().optional(),
  regexPattern: optionalText(1024),
  formatPattern: optionalText(255),
  unit: optionalText(64),
  referenceStandardId: optionalPositiveId,
  referenceClause: optionalText(255),
  description: optionalText(4000),
  status: statusSchema,
  items: z.array(valueDomainItemSchema).max(500).optional().default([]),
});

const dataElementSchema = z.object({
  elementIdentifier: elementIdentifierSchema,
  standardType: elementStandardTypeSchema.optional(),
  elementCode: elementCodeSchema,
  elementNameCn: z.string().trim().min(2).max(128),
  elementNameEn: optionalText(128),
  catalogId: optionalPositiveId,
  objectClass: optionalText(128),
  propertyName: optionalText(128),
  representationTerm: optionalText(64),
  qualifiers: tagsSchema,
  definition: optionalText(8000),
  dataType: z.string().trim().min(1).max(64).default("string"),
  maxLength: z.coerce.number().int().positive().nullable().optional(),
  numericPrecision: z.coerce.number().int().positive().nullable().optional(),
  numericScale: z.coerce.number().int().min(0).nullable().optional(),
  datetimePrecision: optionalText(32),
  formatPattern: optionalText(255),
  unit: optionalText(64),
  valueDomainId: optionalPositiveId,
  referenceStandardId: optionalPositiveId,
  referenceClause: optionalText(255),
  aliases: tagsSchema,
  tags: tagsSchema,
  ownerName: optionalText(64),
  stewardName: optionalText(64),
  lifecycleStatus: lifecycleStatusSchema,
  status: statusSchema,
});

const publishElementSchema = z.object({
  changeSummary: optionalText(512),
});

const aiConfigSchema = z.object({
  sceneName: z.string().trim().min(2).max(128),
  sceneCode: codeSchema.max(64),
  defaultModelProviderId: z.coerce.number().int().positive().optional().nullable(),
  defaultModelName: optionalText(128),
  defaultModelVersion: optionalText(128),
  temperature: z.coerce.number().min(0).max(2).nullable().optional(),
  maxTokens: z.coerce.number().int().min(1).max(32000).nullable().optional(),
  timeoutMs: z.coerce.number().int().min(1000).max(300000).nullable().optional(),
  systemPrompt: z.string().trim().max(30000).optional().or(z.literal("")),
  userPromptTemplate: z.string().trim().max(30000).optional().or(z.literal("")),
  outputSchema: z.record(z.any()).optional().default({}),
  description: optionalText(512),
  ownerName: z.string().trim().min(1).max(64).default("System Administrator"),
  status: statusSchema,
});

const aiSuggestElementSchema = z.object({
  sourceText: z.string().trim().min(2).max(20000),
  catalogId: optionalPositiveId,
  referenceStandardId: optionalPositiveId,
});

module.exports = {
  aiConfigSchema,
  aiSuggestElementSchema,
  catalogSchema,
  dataElementSchema,
  publishElementSchema,
  referenceStandardSchema,
  valueDomainSchema,
};
