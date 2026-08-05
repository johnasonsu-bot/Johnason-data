const { z } = require("../../common/middleware/validate");

const dataSourceSchema = z.object({
  sourceName: z.string().min(2, "数据源名称至少 2 个字符"),
  sourceCode: z.string().min(2, "数据源编码至少 2 个字符").regex(/^[a-zA-Z0-9_]+$/, "编码仅支持字母数字下划线"),
  sourceType: z.enum(["mysql", "postgresql", "gaussdb", "jdbc", "oracle", "dm", "api", "ftp", "sftp", "kafka", "hive", "other"]),
  ownerName: z.string().min(2, "负责人至少 2 个字符"),
  status: z.enum(["active", "inactive"]).default("active"),
  connectionConfig: z.record(z.any()).optional().default({})
});

module.exports = {
  createDataSourceSchema: dataSourceSchema,
  updateDataSourceSchema: dataSourceSchema
};
