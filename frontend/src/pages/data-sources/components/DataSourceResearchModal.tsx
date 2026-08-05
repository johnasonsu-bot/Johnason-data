import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Transfer,
  Typography,
  message,
} from "antd";
import type { TransferItem } from "antd/es/transfer";
import { useEffect, useMemo, useState } from "react";
import {
  createDataSourceResearchRun,
  deleteDataSourceResearchRun,
  downloadDataSourceResearchReportWord,
  fetchDataSourceResearchLogs,
  fetchDataSourceResearchReport,
  fetchDataSourceResearchRun,
  fetchDataSourceResearchRuns,
  fetchDataSourceTables,
  terminateDataSourceResearchRun,
} from "../../../services/platform";
import type {
  DataSourceRecord,
  DataSourceResearchLogRecord,
  DataSourceResearchReport,
  DataSourceResearchRunRecord,
  DataSourceTable,
} from "../../../types/api";
import { inferDatasourceDialect } from "../../../utils/datasource";
import { ResearchRelationshipErGraph } from "../../data-source-research/components/ResearchRelationshipErGraph";

type ResearchFormValues = {
  tableScope: "all" | "manual";
  selectedTables: string[];
  sampleSize: number;
  maxTables: number;
  rowCountMode: "estimated" | "exact";
  metadataConcurrency: number;
  aiBatchSize: number;
  researchItems: Array<"data_scale" | "table_classification" | "quality_inspection" | "metadata_inspection" | "ingestion_advice" | "table_relationship">;
  notes?: string;
};

type Props = {
  open: boolean;
  token?: string;
  dataSource: DataSourceRecord | null;
  onCancel: () => void;
};

const RESEARCH_ITEM_OPTIONS = [
  { label: "数据规模探查", value: "data_scale" },
  { label: "表分类探查", value: "table_classification" },
  { label: "质量探查", value: "quality_inspection" },
  { label: "元数据缺失分析", value: "metadata_inspection" },
  { label: "接入建议", value: "ingestion_advice" },
  { label: "表关系调研", value: "table_relationship" },
] as const;

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function renderStatusTag(status?: string) {
  const colorMap: Record<string, string> = {
    pending: "default",
    running: "processing",
    succeeded: "success",
    failed: "error",
    cancelled: "orange",
  };
  return <Tag color={colorMap[String(status || "")] || "default"}>{status || "-"}</Tag>;
}

const CATEGORY_LABELS: Record<string, string> = {
  business: "业务表",
  dictionary: "字典表",
  relation: "关联表",
  log: "日志表",
  temporary: "临时表",
  low_value: "低价值表",
};

const PRIORITY_LABELS: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

const CATEGORY_SORT_WEIGHT: Record<string, number> = {
  business: 1,
  dictionary: 2,
  relation: 3,
  log: 4,
  temporary: 5,
  low_value: 6,
};

const PRIORITY_SORT_WEIGHT: Record<string, number> = {
  high: 1,
  medium: 2,
  low: 3,
};

function formatPercentage(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `${(Number(value) * 100).toFixed(2)}%`;
}

function formatLogLine(item: DataSourceResearchLogRecord) {
  const prefix = `[${formatDateTime(item.createdAt)}] [${item.logLevel.toUpperCase()}] ${item.message}`;
  const detail = item.detail || {};
  const tableName = String((detail as Record<string, unknown>).tableName || "").trim();
  const tableComment = String((detail as Record<string, unknown>).tableComment || "").trim();
  if (tableName && tableComment) {
    return `${prefix} | ${tableName}（${tableComment}）`;
  }
  if (tableName) {
    return `${prefix} | ${tableName}`;
  }
  const tables = Array.isArray((detail as Record<string, unknown>).tables)
    ? ((detail as Record<string, unknown>).tables as Array<Record<string, unknown>>)
      .slice(0, 5)
      .map((entry) => {
        const name = String(entry.tableName || "").trim();
        const comment = String(entry.tableComment || "").trim();
        return comment ? `${name}（${comment}）` : name;
      })
      .filter(Boolean)
    : [];
  return tables.length ? `${prefix} | ${tables.join("、")}` : prefix;
}

function categoryLabel(value?: string) {
  return CATEGORY_LABELS[String(value || "").trim().toLowerCase()] || value || "-";
}

function priorityLabel(value?: string) {
  return PRIORITY_LABELS[String(value || "").trim().toLowerCase()] || value || "-";
}

function sortResearchTables<T extends { category?: string; priority?: string; tableName?: string }>(tables: T[] = []) {
  return [...tables].sort((left, right) => {
    const leftPriority = PRIORITY_SORT_WEIGHT[String(left.priority || "").toLowerCase()] || 99;
    const rightPriority = PRIORITY_SORT_WEIGHT[String(right.priority || "").toLowerCase()] || 99;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const leftCategory = CATEGORY_SORT_WEIGHT[String(left.category || "").toLowerCase()] || 99;
    const rightCategory = CATEGORY_SORT_WEIGHT[String(right.category || "").toLowerCase()] || 99;
    if (leftCategory !== rightCategory) {
      return leftCategory - rightCategory;
    }

    return String(left.tableName || "").localeCompare(String(right.tableName || ""), "zh-CN");
  });
}

const AI_STAGE_LABELS: Record<string, string> = {
  table_classification: "表分类批次",
  report_aggregation: "全局汇总",
  table_relationship: "表关系调研",
};

const RELATION_SOURCE_LABELS: Record<string, string> = {
  constraint: "显式约束",
  name_rule: "命名规则",
  ai: "模型判断",
};

function stageLabel(value?: string) {
  return AI_STAGE_LABELS[String(value || "")] || value || "-";
}

function relationSourceLabel(value?: string) {
  return RELATION_SOURCE_LABELS[String(value || "")] || value || "-";
}

function formatRelationConfidence(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `${Math.round(Number(value) * 100)}%`;
}

function buildReportMarkdown(report: DataSourceResearchReport) {
  const lines: string[] = [];
  lines.push(`# ${report.run.runName}`);
  lines.push("");
  lines.push("## 概览");
  lines.push(`- 数据源：${report.source.sourceName}`);
  lines.push(`- 类型：${report.source.sourceType}`);
  lines.push(`- 数据库：${report.source.databaseName || "-"}`);
  lines.push(`- 调研表数：${report.overview.totalTables}`);
  lines.push(`- 累计行数：${report.overview.totalRowCount || "-"}`);
  lines.push(`- 总结：${report.overview.summary}`);
  lines.push("");
  lines.push("## 推荐结果");
  lines.push(`- 优先接入：${report.recommendations.recommendedTables.join("、") || "-"}`);
  lines.push(`- 建议暂缓：${report.recommendations.deferredTables.join("、") || "-"}`);
  lines.push("");
  lines.push("## 治理建议");
  for (const item of report.recommendations.governanceSuggestions || []) {
    lines.push(`- ${item}`);
  }
  if (!report.recommendations.governanceSuggestions?.length) {
    lines.push("- 无");
  }
  lines.push("");
  lines.push("## 接入建议");
  for (const item of report.recommendations.ingestionSuggestions || []) {
    lines.push(`- ${item}`);
  }
  if (!report.recommendations.ingestionSuggestions?.length) {
    lines.push("- 无");
  }
  lines.push("");
  if (report.tableRelationships) {
    lines.push("## 表关系调研");
    lines.push(`- 总结：${report.tableRelationships.summary || "-"}`);
    if (report.tableRelationships.relations?.length) {
      for (const relation of report.tableRelationships.relations) {
        lines.push(`- ${relation.fromTable}.${relation.fromField} -> ${relation.toTable}.${relation.toField}（${relation.relationType}，${relationSourceLabel(relation.source)}，${formatRelationConfidence(relation.confidence)}）`);
      }
    } else {
      lines.push("- 未识别到稳定表关系");
    }
    lines.push("");
  }
  lines.push("## 表明细");
  for (const table of report.tables || []) {
    lines.push(`### ${table.tableName}${table.tableComment ? `（${table.tableComment}）` : ""}`);
    lines.push(`- 分类：${table.category}`);
    lines.push(`- 优先级：${table.priority}`);
    lines.push(`- 行数：${table.rowCount ?? "-"}`);
    lines.push(`- 增量字段：${table.incrementalColumn || "-"}`);
    lines.push(`- 元数据问题：${table.metadataIssues.join("、") || "-"}`);
    lines.push(`- 判断依据：${table.evidence.join("、") || "-"}`);
    lines.push(`- 风险提示：${table.risks.join("、") || "-"}`);
    lines.push("- 字段说明：");
    for (const field of table.fieldProfiles || table.columns || []) {
      const fieldName = String(field.columnName || "").trim();
      const comment = String(field.columnComment || "").trim() || "-";
      const type = String(field.dataType || field.columnType || "").trim() || "-";
      lines.push(`  - ${fieldName} [${type}] ${comment}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

export function DataSourceResearchModal({ open, token, dataSource, onCancel }: Props) {
  const [form] = Form.useForm<ResearchFormValues>();
  const [activeTabKey, setActiveTabKey] = useState("config");
  const [tables, setTables] = useState<DataSourceTable[]>([]);
  const [runs, setRuns] = useState<DataSourceResearchRunRecord[]>([]);
  const [activeRun, setActiveRun] = useState<DataSourceResearchRunRecord | null>(null);
  const [logs, setLogs] = useState<DataSourceResearchLogRecord[]>([]);
  const [report, setReport] = useState<DataSourceResearchReport | null>(null);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [terminatingRunId, setTerminatingRunId] = useState<number | null>(null);
  const [downloadingWordRunId, setDownloadingWordRunId] = useState<number | null>(null);

  const tableScope = Form.useWatch("tableScope", form) || "all";
  const selectedTables = Form.useWatch("selectedTables", form) || [];
  const sourceDialect = useMemo(
    () => inferDatasourceDialect(dataSource?.sourceType, dataSource?.connectionConfig || {}),
    [dataSource?.connectionConfig, dataSource?.sourceType]
  );
  const objectLabel = sourceDialect === "ftp" ? "文件" : sourceDialect === "kafka" ? "Topic" : "表";
  const objectUnit = sourceDialect === "ftp" ? "个文件" : sourceDialect === "kafka" ? "个 Topic" : "张表";
  const rowCountLabel = sourceDialect === "ftp" ? "文件样例行数" : sourceDialect === "kafka" ? "消息样例数" : "累计行数";
  const researchItemOptions = useMemo(
    () => RESEARCH_ITEM_OPTIONS.map((item) => {
      if (item.value === "table_classification") return { ...item, label: `${objectLabel}分类探查` };
      if (item.value === "table_relationship") return { ...item, label: sourceDialect === "ftp" || sourceDialect === "kafka" ? "对象关系调研" : item.label };
      return item;
    }),
    [objectLabel, sourceDialect]
  );
  const researchSupported = useMemo(
    () => ["mysql", "postgresql", "hive", "ftp", "kafka"].includes(sourceDialect),
    [sourceDialect]
  );

  const transferDataSource = useMemo<TransferItem[]>(
    () =>
      tables.map((item) => ({
        key: item.tableName,
        title: item.tableName,
        description: item.tableComment || "",
      })),
    [tables]
  );

  async function loadRuns(keepSelection = true) {
    if (!token || !dataSource) return;
    setLoadingRuns(true);
    try {
      const response = await fetchDataSourceResearchRuns(token, dataSource.id);
      const nextRuns = response.data || [];
      setRuns(nextRuns);
      if (!keepSelection) {
        const nextId = nextRuns[0]?.id || null;
        setSelectedRunId(nextId);
        if (nextId) {
          await loadRunDetail(nextId);
        } else {
          setActiveRun(null);
          setLogs([]);
          setReport(null);
        }
      }
    } catch (error: any) {
      message.error(`加载调研记录失败: ${error.message || "未知错误"}`);
    } finally {
      setLoadingRuns(false);
    }
  }

  async function loadRunDetail(runId: number, options?: { switchTab?: boolean }) {
    if (!token) return;
    setLoadingDetail(true);
    try {
      const [runResponse, logResponse, reportResponse] = await Promise.all([
        fetchDataSourceResearchRun(token, runId),
        fetchDataSourceResearchLogs(token, runId),
        fetchDataSourceResearchReport(token, runId),
      ]);
      setActiveRun(runResponse.data || null);
      setLogs(logResponse.data || []);
      setReport(reportResponse.data || null);
      setSelectedRunId(runId);
      if (options?.switchTab) {
        setActiveTabKey("execution");
      }
    } catch (error: any) {
      message.error(`加载调研详情失败: ${error.message || "未知错误"}`);
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    if (!open || !token || !dataSource) return;
    form.setFieldsValue({
      tableScope: "all",
      selectedTables: [],
      sampleSize: 50,
      maxTables: 50,
      rowCountMode: "estimated",
      metadataConcurrency: 3,
      aiBatchSize: 15,
      researchItems: ["data_scale", "table_classification", "metadata_inspection", "ingestion_advice"],
      notes: "",
    });
    setTables([]);
    setRuns([]);
    setActiveRun(null);
    setLogs([]);
    setReport(null);
    setSelectedRunId(null);
    setActiveTabKey("config");

    void (async () => {
      setLoadingTables(true);
      try {
        if (researchSupported) {
          const tableResponse = await fetchDataSourceTables(token, dataSource.id);
          setTables(tableResponse.data || []);
        }
      } catch (error: any) {
        message.error(`加载调研表范围失败: ${error.message || "未知错误"}`);
      } finally {
        setLoadingTables(false);
      }
      await loadRuns(false);
    })();
  }, [dataSource, form, open, researchSupported, token]);

  useEffect(() => {
    if (!open || !token || !selectedRunId || !activeRun) return;
    if (!["pending", "running"].includes(activeRun.status)) return;
    const timer = window.setInterval(() => {
      void loadRunDetail(selectedRunId);
      void loadRuns(true);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [activeRun, open, selectedRunId, token]);

  async function handleStart() {
    if (!token || !dataSource) return;
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const response = await createDataSourceResearchRun(token, dataSource.id, values);
      const run = response.data;
      setSelectedRunId(run.id);
      await Promise.all([loadRuns(false), loadRunDetail(run.id, { switchTab: true })]);
      message.success("数据调研任务已启动");
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      message.error(`启动调研失败: ${error.message || "未知错误"}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteRun(runId: number) {
    if (!token) return;
    try {
      await deleteDataSourceResearchRun(token, runId);
      if (selectedRunId === runId) {
        setSelectedRunId(null);
        setActiveRun(null);
        setLogs([]);
        setReport(null);
        setActiveTabKey("history");
      }
      await loadRuns(false);
      message.success("调研记录已删除");
    } catch (error: any) {
      message.error(`删除调研记录失败: ${error.message || "未知错误"}`);
    }
  }

  async function handleTerminateRun(runId: number) {
    if (!token) return;
    try {
      setTerminatingRunId(runId);
      await terminateDataSourceResearchRun(token, runId);
      await Promise.all([
        loadRuns(true),
        loadRunDetail(runId),
      ]);
      message.success("调研任务已终止");
    } catch (error: any) {
      message.error(`终止调研任务失败: ${error.message || "未知错误"}`);
    } finally {
      setTerminatingRunId(null);
    }
  }

  function handleDownloadReport(targetRun?: DataSourceResearchRunRecord | null, format: "json" | "md" = "md") {
    const effectiveRun = targetRun || activeRun;
    if (!effectiveRun?.report) {
      message.warning("当前调研记录暂无可下载报告");
      return;
    }

    const safeCode = String(dataSource?.sourceCode || "research").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filenameBase = `${safeCode}_research_${effectiveRun.id}`;
    if (format === "json") {
      downloadTextFile(`${filenameBase}.json`, JSON.stringify(effectiveRun.report, null, 2), "application/json");
      return;
    }

    downloadTextFile(`${filenameBase}.md`, buildReportMarkdown(effectiveRun.report), "text/markdown");
  }

  async function handleDownloadWordReport(targetRun?: DataSourceResearchRunRecord | null) {
    const effectiveRun = targetRun || activeRun;
    if (!token || !effectiveRun?.report) {
      message.warning("当前调研记录暂无可下载报告");
      return;
    }

    const safeCode = String(dataSource?.sourceCode || "research").replace(/[^a-zA-Z0-9_-]/g, "_");
    const fallbackFileName = `${safeCode}_research_${effectiveRun.id}.docx`;
    try {
      setDownloadingWordRunId(effectiveRun.id);
      await downloadDataSourceResearchReportWord(token, effectiveRun.id, fallbackFileName);
    } catch (error: any) {
      message.error(`下载 Word 报告失败: ${error.message || "未知错误"}`);
    } finally {
      setDownloadingWordRunId(null);
    }
  }

  const tabs = [
    {
      key: "config",
      label: "调研配置",
      children: (
        <Space direction="vertical" size={16} style={{ display: "flex" }}>
          <Alert
            type="info"
            showIcon
            message="本次调研直接复用当前数据源的连接配置"
            description={`数据源: ${dataSource?.sourceName || "-"}；类型: ${dataSource?.sourceType || "-"}${sourceDialect === "ftp" ? `；根目录: ${String(dataSource?.connectionConfig?.rootPath || dataSource?.connectionConfig?.path || "-")}` : sourceDialect === "kafka" ? `；Broker: ${String(dataSource?.connectionConfig?.bootstrapServers || "-")}` : `；数据库: ${String(dataSource?.connectionConfig?.database || "-")}`}`}
          />
          {!researchSupported ? (
            <Alert
              type="warning"
              showIcon
              message="当前数据源类型暂不支持一期元数据调研"
              description="当前已支持 MySQL / PostgreSQL / Hive / FTP / Kafka；GaussDB 与兼容 JDBC 连接会按对应方言参与调研。"
            />
          ) : null}
          <Form form={form} layout="vertical" disabled={!researchSupported}>
            <Space style={{ width: "100%" }} size={16} align="start">
              <Form.Item name="tableScope" label={`${objectLabel}范围`} style={{ minWidth: 180 }}>
                <Select
                  options={[
                    { label: sourceDialect === "ftp" ? "目录前 N 个文件" : sourceDialect === "kafka" ? "前 N 个 Topic" : "全库前 N 张表", value: "all" },
                    { label: `手工勾选${objectLabel}`, value: "manual" },
                  ]}
                />
              </Form.Item>
              <Form.Item name="sampleSize" label={sourceDialect === "ftp" ? "文件抽样行数" : sourceDialect === "kafka" ? "消息抽样条数" : "数据抽样条数"} style={{ minWidth: 180 }}>
                <Select options={[20, 50, 100, 200].map((value) => ({ label: `${value} 条`, value }))} />
              </Form.Item>
              <Form.Item name="maxTables" label={`最大探查${objectLabel}数`} style={{ minWidth: 180 }}>
                <InputNumber min={1} max={500} style={{ width: "100%" }} />
              </Form.Item>
            </Space>

            <Space style={{ width: "100%" }} size={16} align="start">
              <Form.Item name="rowCountMode" label="行数统计策略" style={{ minWidth: 180 }}>
                <Select
                  options={[
                    { label: "估算优先", value: "estimated" },
                    { label: "精确统计", value: "exact" },
                  ]}
                />
              </Form.Item>
              <Form.Item name="metadataConcurrency" label="元数据并发度" style={{ minWidth: 180 }}>
                <InputNumber min={1} max={8} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="aiBatchSize" label="AI批次表数" style={{ minWidth: 180 }}>
                <InputNumber min={5} max={30} style={{ width: "100%" }} />
              </Form.Item>
            </Space>

            <Form.Item name="researchItems" label="调研方向" rules={[{ required: true, message: "请选择调研方向" }]}>
              <Checkbox.Group options={researchItemOptions as any} />
            </Form.Item>

            <Form.Item name="notes" label="补充说明">
              <Input.TextArea rows={3} placeholder="可选，补充业务背景、优先关注主题域或特殊约束" />
            </Form.Item>

            {tableScope === "manual" ? (
              <Form.Item
                name="selectedTables"
                label={`指定${objectLabel}范围${selectedTables.length ? `（已选 ${selectedTables.length} ${objectUnit}）` : ""}`}
                rules={[{ required: true, message: `请至少选择一个${objectLabel}` }]}
              >
                <Transfer
                  dataSource={transferDataSource}
                  titles={[`可选${objectLabel}`, `已选${objectLabel}`]}
                  targetKeys={selectedTables}
                  onChange={(nextTargetKeys) => form.setFieldValue("selectedTables", nextTargetKeys)}
                  render={(item) => (
                    <Space direction="vertical" size={0}>
                      <Typography.Text>{item.title}</Typography.Text>
                      {item.description ? <Typography.Text type="secondary">{item.description}</Typography.Text> : null}
                    </Space>
                  )}
                  listStyle={{ width: 360, height: 360 }}
                  showSearch
                  oneWay
                  filterOption={(inputValue, item) =>
                    `${item.title || ""} ${item.description || ""}`.toLowerCase().includes(inputValue.toLowerCase())
                  }
                  disabled={loadingTables}
                />
              </Form.Item>
            ) : (
              <Alert
                type="success"
                showIcon
                message={`${sourceDialect === "ftp" ? "目录模式" : sourceDialect === "kafka" ? "Topic 模式" : "全库模式"}会按当前${objectLabel}清单顺序截取前 N ${objectUnit}进行调研`}
                description={`当前可用${objectLabel}数 ${tables.length} ${objectUnit}，实际执行时按“最大探查${objectLabel}数”限制。`}
              />
            )}
          </Form>
          <Space style={{ justifyContent: "space-between", width: "100%" }}>
            <Typography.Text type="secondary">
              {`运行时会记录关键环节日志，包括连通性校验、${objectLabel}清单加载、${objectLabel}级探查、模型调用和报告生成。`}
            </Typography.Text>
            <Button type="primary" loading={submitting} onClick={() => void handleStart()} disabled={!researchSupported}>
              开始调研
            </Button>
          </Space>
        </Space>
      ),
    },
    {
      key: "execution",
      label: "执行与报告",
      children: activeRun ? (
        <Space direction="vertical" size={16} style={{ display: "flex" }}>
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="任务名称">{activeRun.runName}</Descriptions.Item>
            <Descriptions.Item label="当前状态">{renderStatusTag(activeRun.status)}</Descriptions.Item>
            <Descriptions.Item label="当前阶段">{activeRun.currentStage || "-"}</Descriptions.Item>
            <Descriptions.Item label="创建人">{activeRun.createdBy}</Descriptions.Item>
            <Descriptions.Item label="开始时间">{formatDateTime(activeRun.startedAt)}</Descriptions.Item>
            <Descriptions.Item label="完成时间">{formatDateTime(activeRun.finishedAt)}</Descriptions.Item>
          </Descriptions>
          <Progress percent={activeRun.progressPercent} status={activeRun.status === "failed" ? "exception" : undefined} />
          {activeRun.summaryText ? <Alert type="info" showIcon message={activeRun.summaryText} /> : null}
          {activeRun.errorMessage ? <Alert type="error" showIcon message={activeRun.errorMessage} /> : null}

          <Typography.Title level={5} style={{ margin: 0 }}>关键日志</Typography.Title>
          {["pending", "running"].includes(String(activeRun.status || "")) ? (
            <Space style={{ justifyContent: "flex-end", width: "100%" }}>
              <Popconfirm
                title="确认终止当前调研任务？"
                description="终止后当前运行不会继续生成报告。"
                onConfirm={() => void handleTerminateRun(activeRun.id)}
              >
                <Button danger loading={terminatingRunId === activeRun.id}>终止任务</Button>
              </Popconfirm>
            </Space>
          ) : null}
          <div style={{ maxHeight: 240, overflow: "auto", border: "1px solid #f0f0f0", borderRadius: 8, padding: 12, background: "#fafafa" }}>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "Consolas, monospace", fontSize: 12 }}>
              {logs.length
                ? logs.map((item) => formatLogLine(item)).join("\n")
                : "暂无执行日志"}
            </pre>
          </div>

          {report ? (
            <Space direction="vertical" size={16} style={{ display: "flex" }}>
              <Space style={{ justifyContent: "flex-end", width: "100%" }}>
                <Button onClick={() => handleDownloadReport(activeRun, "md")}>下载 Markdown</Button>
                <Button onClick={() => handleDownloadReport(activeRun, "json")}>下载 JSON</Button>
                <Button loading={downloadingWordRunId === activeRun.id} onClick={() => void handleDownloadWordReport(activeRun)}>下载 Word</Button>
                <Popconfirm
                  title="确认删除当前调研记录？"
                  description="删除后将同时移除执行日志和调研报告。"
                  onConfirm={() => void handleDeleteRun(activeRun.id)}
                  okButtonProps={{ danger: true }}
                >
                  <Button danger disabled={["pending", "running"].includes(String(activeRun.status || ""))}>删除记录</Button>
                </Popconfirm>
              </Space>
              <Typography.Title level={5} style={{ margin: 0 }}>调研概览</Typography.Title>
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label={`调研${objectLabel}数`}>{report.overview.totalTables}</Descriptions.Item>
                <Descriptions.Item label={rowCountLabel}>{report.overview.totalRowCount || "-"}</Descriptions.Item>
                <Descriptions.Item label="计数策略">{sourceDialect === "ftp" || sourceDialect === "kafka" ? "按预览样例统计" : report.config.rowCountMode === "exact" ? "精确统计" : "估算优先"}</Descriptions.Item>
                <Descriptions.Item label="元数据并发度">{report.config.metadataConcurrency || "-"}</Descriptions.Item>
                <Descriptions.Item label={`优先接入${objectLabel}`}>{report.recommendations.recommendedTables.join("、") || "-"}</Descriptions.Item>
                <Descriptions.Item label={`建议暂缓${objectLabel}`}>{report.recommendations.deferredTables.join("、") || "-"}</Descriptions.Item>
              </Descriptions>
              <Alert type="success" showIcon message={report.overview.summary} />

              {report.analysisBatches?.length ? (
                <>
                  <Typography.Title level={5} style={{ margin: 0 }}>AI分析批次</Typography.Title>
                  <Table
                    rowKey={(item) => `${item.stageKey}-${item.batchNo}`}
                    size="small"
                    pagination={false}
                    dataSource={report.analysisBatches}
                    columns={[
                      { title: "阶段", dataIndex: "stageKey", key: "stageKey", width: 180, render: (value: string) => stageLabel(value) },
                      { title: "批次", dataIndex: "batchNo", key: "batchNo", width: 80 },
                      { title: "表数", dataIndex: "batchSize", key: "batchSize", width: 80 },
                      { title: "状态", dataIndex: "status", key: "status", width: 100 },
                      { title: "耗时(ms)", dataIndex: "durationMs", key: "durationMs", width: 120, render: (value: unknown) => value ?? "-" },
                      { title: "错误信息", dataIndex: "errorMessage", key: "errorMessage", render: (value: unknown) => value || "-" },
                    ]}
                  />
                </>
              ) : null}

              {report.tableRelationships ? (
                <>
                  <Typography.Title level={5} style={{ margin: 0 }}>{sourceDialect === "ftp" || sourceDialect === "kafka" ? "对象关系图" : "表关系ER图"}</Typography.Title>
                  <ResearchRelationshipErGraph value={report.tableRelationships} />
                </>
              ) : null}

              <Typography.Title level={5} style={{ margin: 0 }}>{objectLabel}分类结果</Typography.Title>
                <Table
                  rowKey="tableName"
                  size="small"
                  pagination={{ pageSize: 6, showSizeChanger: false }}
                  dataSource={sortResearchTables(report.tables)}
                  expandable={{
                  expandedRowRender: (record) => {
                    const fields = (record.fieldProfiles || record.columns || []).slice().sort((a, b) => Number(a.ordinalPosition || 0) - Number(b.ordinalPosition || 0));
                    return (
                      <Table
                        rowKey={(item) => `${record.tableName}-${item.columnName}`}
                        size="small"
                        pagination={false}
                        dataSource={fields}
                  columns={[
                          { title: "序号", dataIndex: "ordinalPosition", key: "ordinalPosition", width: 70, render: (value: unknown) => value ?? "-" },
                          { title: "字段名", dataIndex: "columnName", key: "columnName", width: 180 },
                          { title: "字段注释", dataIndex: "columnComment", key: "columnComment", width: 220, render: (value: unknown) => value || "-" },
                          { title: "类型", dataIndex: "dataType", key: "dataType", width: 140, render: (value: unknown, row: any) => value || row.columnType || "-" },
                          { title: "主键", dataIndex: "isPrimaryKey", key: "isPrimaryKey", width: 80, render: (value: boolean) => (value ? "是" : "否") },
                          { title: "可空", dataIndex: "isNullable", key: "isNullable", width: 80, render: (value: boolean | undefined) => (value === undefined ? "-" : value ? "是" : "否") },
                          { title: "空值率", dataIndex: "nullRate", key: "nullRate", width: 100, render: (value: number | null | undefined) => formatPercentage(value) },
                          { title: "样例值", dataIndex: "sampleValues", key: "sampleValues", render: (value: string[] | undefined) => Array.isArray(value) && value.length ? value.join("、") : "-" },
                        ]}
                      />
                    );
                  },
                }}
                columns={[
                  {
                    title: `${objectLabel}名称`,
                    key: "tableName",
                    width: 260,
                    render: (_value: unknown, record) => (
                      <Space direction="vertical" size={0}>
                        <Typography.Text strong>{record.tableName}</Typography.Text>
                        <Typography.Text type="secondary">{record.tableComment || "-"}</Typography.Text>
                      </Space>
                    ),
                  },
                    { title: "分类", dataIndex: "category", key: "category", width: 120, render: (value: string) => categoryLabel(value) },
                    { title: "优先级", dataIndex: "priority", key: "priority", width: 100, render: (value: string) => priorityLabel(value) },
                  { title: sourceDialect === "ftp" || sourceDialect === "kafka" ? "样例数" : "行数", dataIndex: "rowCount", key: "rowCount", width: 120, render: (value: unknown) => value ?? "-" },
                  { title: "增量字段", dataIndex: "incrementalColumn", key: "incrementalColumn", width: 140, render: (value: unknown) => value || "-" },
                  {
                    title: "元数据问题",
                    key: "metadataIssues",
                    render: (_value: unknown, record) => record.metadataIssues?.join("、") || "-",
                  },
                ]}
              />

              <Typography.Title level={5} style={{ margin: 0 }}>接入建议</Typography.Title>
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="治理建议">
                  {report.recommendations.governanceSuggestions.length
                    ? report.recommendations.governanceSuggestions.map((item) => <div key={item}>{item}</div>)
                    : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="接入建议">
                  {report.recommendations.ingestionSuggestions.length
                    ? report.recommendations.ingestionSuggestions.map((item) => <div key={item}>{item}</div>)
                    : "-"}
                </Descriptions.Item>
              </Descriptions>
            </Space>
          ) : (
            <Empty description={loadingDetail ? "正在加载报告" : "当前任务尚未生成报告"} />
          )}
        </Space>
      ) : (
        <Empty description="请选择或先启动一个调研任务" />
      ),
    },
    {
      key: "history",
      label: "历史记录",
      children: (
        <Table
          rowKey="id"
          size="small"
          loading={loadingRuns}
          dataSource={runs}
          pagination={{ pageSize: 6, showSizeChanger: false }}
          columns={[
            { title: "任务名称", dataIndex: "runName", key: "runName" },
            { title: "状态", dataIndex: "status", key: "status", width: 110, render: (value: string) => renderStatusTag(value) },
            { title: "阶段", dataIndex: "currentStage", key: "currentStage", width: 140, render: (value: string) => value || "-" },
            { title: "创建时间", dataIndex: "createdAt", key: "createdAt", width: 180, render: (value: string) => formatDateTime(value) },
            {
              title: "操作",
              key: "actions",
              width: 340,
              render: (_value: unknown, record) => (
                <Space size="small">
                  <Button type="link" onClick={() => void loadRunDetail(record.id, { switchTab: true })}>
                    查看详情
                  </Button>
                  {["pending", "running"].includes(String(record.status || "")) ? (
                    <Popconfirm
                      title="确认终止该调研任务？"
                      description="终止后当前运行不会继续生成报告。"
                      onConfirm={() => void handleTerminateRun(record.id)}
                    >
                      <Button type="link" danger loading={terminatingRunId === record.id}>
                        终止
                      </Button>
                    </Popconfirm>
                  ) : null}
                  <Button type="link" onClick={() => handleDownloadReport(record, "md")} disabled={!record.report}>
                    Markdown
                  </Button>
                  <Button type="link" loading={downloadingWordRunId === record.id} onClick={() => void handleDownloadWordReport(record)} disabled={!record.report}>
                    Word
                  </Button>
                  <Popconfirm
                    title="确认删除该调研记录？"
                    description="删除后将同时移除执行日志和调研报告。"
                    onConfirm={() => void handleDeleteRun(record.id)}
                    okButtonProps={{ danger: true }}
                    disabled={["pending", "running"].includes(String(record.status || ""))}
                  >
                    <Button type="link" danger disabled={["pending", "running"].includes(String(record.status || ""))}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
          locale={{ emptyText: "当前数据源暂无调研记录" }}
        />
      ),
    },
  ];

  return (
    <Modal
      open={open}
      title={`数据调研${dataSource ? ` - ${dataSource.sourceName}` : ""}`}
      onCancel={onCancel}
      footer={null}
      width={1280}
      destroyOnHidden
    >
      <Tabs activeKey={activeTabKey} onChange={setActiveTabKey} items={tabs} />
    </Modal>
  );
}
