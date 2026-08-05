import {
  Button,
  Card,
  Checkbox,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import { ArrowLeftOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, RobotOutlined, SaveOutlined, UploadOutlined } from "@ant-design/icons";
import type { TabsProps } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  createFileImportTask,
  previewFileImports,
  suggestTechnicalNames,
} from "../../services/fileImport";
import {
  fetchDataSourceColumns,
  fetchDataSourceTables,
  fetchDataSources,
} from "../../services/platform";
import type {
  DataSourceColumn,
  DataSourceRecord,
  DataSourceTable,
  FileImportFieldMapping,
  FileImportPreviewFile,
} from "../../types/api";
import { inferDatasourceDialect } from "../../utils/datasource";

type StepKey = "source" | "mapping" | "target";

type FormValues = {
  taskName: string;
  taskCode?: string;
  targetSourceId?: number;
  targetTable?: string;
  targetTableMode: "create" | "existing";
  writeMode: "append" | "overwrite";
  description?: string;
  headerRowNumber: number;
  firstDataRowNumber: number;
  fieldNameMode: "header" | "generated";
  delimiter?: string;
  encoding: string;
  technicalNameMode: "snake_case" | "camelCase" | "upper_snake";
  skipErrorRows: boolean;
  rebuildTargetTable: boolean;
};

const dataTypeOptions = [
  "varchar(64)",
  "varchar(128)",
  "varchar(255)",
  "text",
  "bigint",
  "int",
  "decimal(18,6)",
  "date",
  "datetime",
  "boolean",
  "json",
  "jsonb",
  "string",
].map((value) => ({ label: value, value }));

function buildActualFiles(fileList: UploadFile[]) {
  return fileList.map((item) => item.originFileObj).filter(Boolean) as File[];
}

function suggestTaskName(fileName: string) {
  return `导入_${fileName.replace(/\.[^.]+$/, "")}`;
}

function suggestTableName(fileName: string) {
  const normalized = fileName
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return normalized || `upload_${Date.now()}`;
}

function buildPreviewColumns(rows: Array<Record<string, unknown>>) {
  const firstRow = rows[0] || {};
  return Object.keys(firstRow).map((key) => ({
    title: key,
    dataIndex: key,
    width: 180,
    ellipsis: true,
    render: (value: unknown) => String(value ?? "-"),
  }));
}

function normalizeCompareName(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function autoMatchMappings(mappings: FileImportFieldMapping[], targetColumns: DataSourceColumn[]) {
  const usedTargets = new Set<string>();
  return mappings.map((mapping) => {
    if (mapping.mappingMode === "custom") {
      return {
        ...mapping,
        autoMapped: false,
        matchStatus: "custom" as const,
      };
    }

    const sourceCandidates = [
      normalizeCompareName(mapping.targetField),
      normalizeCompareName(mapping.sourceField),
      normalizeCompareName(mapping.columnComment),
    ].filter(Boolean);

    const matched = targetColumns.find((column) => {
      const columnName = String(column.columnName || "").trim();
      const normalizedColumnName = normalizeCompareName(columnName);
      if (!columnName || usedTargets.has(columnName)) {
        return false;
      }
      return sourceCandidates.includes(normalizedColumnName);
    });

    if (!matched) {
      return {
        ...mapping,
        autoMapped: false,
        matchStatus: "unmatched" as const,
      };
    }

    usedTargets.add(String(matched.columnName || "").trim());
    return {
      ...mapping,
      targetField: String(matched.columnName || mapping.targetField),
      dataType: String(matched.columnType || matched.dataType || mapping.dataType),
      nullable: matched.isNullable,
      autoMapped: true,
      matchStatus: "matched" as const,
    };
  });
}

function renderMatchTag(mapping: FileImportFieldMapping) {
  if (mapping.mappingMode === "custom") {
    return <Tag color="purple">自定义值</Tag>;
  }
  if (mapping.matchStatus === "matched") {
    return <Tag color="green">已匹配</Tag>;
  }
  if (mapping.matchStatus === "unmatched") {
    return <Tag color="orange">待匹配</Tag>;
  }
  return <Tag>未处理</Tag>;
}

function renderSourceMode(mapping: FileImportFieldMapping) {
  return mapping.mappingMode === "custom" ? "自定义值" : "来源字段";
}

function DraggableTableRegion({ children }: { children: React.ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return undefined;

    const target = wrapper.querySelector(".ant-table-content, .ant-table-body") as HTMLElement | null;
    if (!target) return undefined;

    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;

    const handleMouseDown = (event: MouseEvent) => {
      isDragging = true;
      startX = event.pageX;
      startScrollLeft = target.scrollLeft;
      target.style.cursor = "grabbing";
      target.style.userSelect = "none";
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging) return;
      const delta = event.pageX - startX;
      target.scrollLeft = startScrollLeft - delta;
    };

    const handleMouseUp = () => {
      isDragging = false;
      target.style.cursor = "grab";
      target.style.removeProperty("user-select");
    };

    target.style.cursor = "grab";
    target.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      target.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [children]);

  return <div ref={wrapperRef}>{children}</div>;
}

export function FileImportWorkspacePage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [form] = Form.useForm<FormValues>();
  const [activeStep, setActiveStep] = useState<StepKey>("source");
  const [activePreviewFileKey, setActivePreviewFileKey] = useState<string>("");
  const [selectedFieldKey, setSelectedFieldKey] = useState<string>("");
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [sources, setSources] = useState<DataSourceRecord[]>([]);
  const [targetTables, setTargetTables] = useState<DataSourceTable[]>([]);
  const [targetColumns, setTargetColumns] = useState<DataSourceColumn[]>([]);
  const [targetTablesLoading, setTargetTablesLoading] = useState(false);
  const [targetColumnsLoading, setTargetColumnsLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<FileImportPreviewFile[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FileImportFieldMapping[]>([]);
  const [fileOptions, setFileOptions] = useState<Record<string, { sheetName?: string }>>({});

  const actualFiles = useMemo(() => buildActualFiles(fileList), [fileList]);
  const selectedTargetSourceId = Form.useWatch("targetSourceId", form);
  const selectedTargetTableMode = Form.useWatch("targetTableMode", form);
  const selectedTargetTable = Form.useWatch("targetTable", form);

  useEffect(() => {
    form.setFieldsValue({
      targetTableMode: "create",
      writeMode: "append",
      headerRowNumber: 1,
      firstDataRowNumber: 2,
      fieldNameMode: "header",
      encoding: "utf8",
      technicalNameMode: "snake_case",
      skipErrorRows: true,
      rebuildTargetTable: false,
    });
  }, [form]);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const response = await fetchDataSources(token, { includeConnectivity: true });
        const supported = (response.data || []).filter((item) => ["mysql", "postgresql", "hive"].includes(inferDatasourceDialect(item.sourceType, item.connectionConfig || {})));
        setSources(supported);
      } catch (error) {
        message.error(error instanceof Error ? error.message : "加载数据源失败");
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!token || !selectedTargetSourceId || selectedTargetTableMode !== "existing") {
      setTargetTables([]);
      return;
    }
    setTargetTablesLoading(true);
    void (async () => {
      try {
        const response = await fetchDataSourceTables(token, Number(selectedTargetSourceId));
        setTargetTables(response.data || []);
      } catch (error) {
        message.error(error instanceof Error ? error.message : "读取目标表清单失败");
        setTargetTables([]);
      } finally {
        setTargetTablesLoading(false);
      }
    })();
  }, [token, selectedTargetSourceId, selectedTargetTableMode]);

  useEffect(() => {
    if (!token || !selectedTargetSourceId || selectedTargetTableMode !== "existing" || !selectedTargetTable) {
      setTargetColumns([]);
      return;
    }
    setTargetColumnsLoading(true);
    void (async () => {
      try {
        const response = await fetchDataSourceColumns(token, Number(selectedTargetSourceId), String(selectedTargetTable));
        const columns = response.data || [];
        setTargetColumns(columns);
        setFieldMappings((current) => autoMatchMappings(current, columns));
      } catch (error) {
        message.error(error instanceof Error ? error.message : "读取目标表字段失败");
        setTargetColumns([]);
      } finally {
        setTargetColumnsLoading(false);
      }
    })();
  }, [token, selectedTargetSourceId, selectedTargetTableMode, selectedTargetTable]);

  function resetPreview() {
    setPreviewFiles([]);
    setActivePreviewFileKey("");
    setFieldMappings([]);
    setSelectedFieldKey("");
  }

  function updateMappingAt(index: number, patch: Partial<FileImportFieldMapping>) {
    setFieldMappings((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function buildPreviewPayload(nextFileOptions?: Record<string, { sheetName?: string }>) {
    const values = form.getFieldsValue();
    const currentFileOptions = nextFileOptions || fileOptions;
    return {
      parseOptions: {
        headerRowNumber: values.headerRowNumber,
        firstDataRowNumber: values.firstDataRowNumber,
        fieldNameMode: values.fieldNameMode,
        delimiter: values.delimiter,
        encoding: values.encoding,
        technicalNameMode: values.technicalNameMode,
        skipErrorRows: values.skipErrorRows,
        rebuildTargetTable: Boolean(values.rebuildTargetTable),
      },
      fileOptions: Object.entries(currentFileOptions).map(([fileName, option]) => ({
        fileName,
        ...option,
      })),
    };
  }

  async function handlePreview(nextFileOptions?: Record<string, { sheetName?: string }>) {
    if (!token) return;
    const values = await form.validateFields([
      "headerRowNumber",
      "firstDataRowNumber",
      "fieldNameMode",
      "delimiter",
      "encoding",
      "technicalNameMode",
      "skipErrorRows",
    ]);
    if (actualFiles.length === 0) {
      message.warning("请先选择文件");
      return;
    }
    setPreviewLoading(true);
    try {
      const payload = {
        parseOptions: {
          headerRowNumber: values.headerRowNumber,
          firstDataRowNumber: values.firstDataRowNumber,
          fieldNameMode: values.fieldNameMode,
          delimiter: values.delimiter,
          encoding: values.encoding,
          technicalNameMode: values.technicalNameMode,
          skipErrorRows: values.skipErrorRows,
          rebuildTargetTable: Boolean(values.rebuildTargetTable),
        },
        fileOptions: Object.entries(nextFileOptions || fileOptions).map(([fileName, option]) => ({
          fileName,
          ...option,
        })),
      };
      const response = await previewFileImports(token, actualFiles, payload);
      const nextFiles = response.data.files || [];
      setPreviewFiles(nextFiles);
      setFieldMappings(response.data.suggestedMappings || []);
      setActivePreviewFileKey((current) => (current && nextFiles.some((item) => item.fileName === current) ? current : nextFiles[0]?.fileName || ""));
      if (!form.getFieldValue("taskName") && actualFiles[0]) {
        form.setFieldValue("taskName", suggestTaskName(actualFiles[0].name));
      }
      if (!form.getFieldValue("targetTable") && actualFiles[0]) {
        form.setFieldValue("targetTable", suggestTableName(actualFiles[0].name));
      }
      message.success("预解析完成");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "预解析失败");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSuggestNames() {
    if (!token || fieldMappings.length === 0) return;
    try {
      const values = form.getFieldsValue();
      const response = await suggestTechnicalNames(token, {
        fields: fieldMappings
          .filter((item) => item.mappingMode !== "custom")
          .map((item) => ({
            sourceField: item.sourceField,
            targetField: item.targetField,
            columnComment: item.columnComment,
            dataType: item.dataType,
            inferredType: item.inferredType,
            maxLength: item.maxLength,
            nullable: item.nullable,
            sampleValues: (item.sampleValues || []).slice(0, 50),
          })),
        technicalNameMode: values.technicalNameMode,
      });
      const suggestions = new Map((response.data.suggestions || []).map((item) => [item.sourceField, item]));
      setFieldMappings((current) =>
        current.map((item) => (item.mappingMode === "custom"
          ? item
          : {
              ...item,
              targetField: suggestions.get(item.sourceField)?.targetField || suggestions.get(item.sourceField)?.englishName || item.targetField,
              dataType: suggestions.get(item.sourceField)?.dataType || item.dataType,
              columnComment: suggestions.get(item.sourceField)?.columnComment || suggestions.get(item.sourceField)?.chineseComment || item.columnComment,
            }))
      );
      message.success(response.data.mode === "model" ? "已按模型完成字段与目标类型建议" : "当前未配置文件上传模型，已使用规则回退");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "生成英文名失败");
    }
  }

  function handleAddCustomField() {
    const next: FileImportFieldMapping = {
      sourceField: `custom_field_${fieldMappings.length + 1}`,
      targetField: `custom_field_${fieldMappings.length + 1}`,
      dataType: "varchar(255)",
      enabled: true,
      mappingMode: "custom",
      customValue: "",
      nullable: true,
      columnComment: "自定义值字段",
      matchStatus: "custom",
    };
    setFieldMappings((current) => [...current, next]);
    setSelectedFieldKey(`${next.sourceField}__${next.targetField}`);
  }

  async function handleSave() {
    if (!token) return;
    const values = await form.validateFields();
    if (actualFiles.length === 0) {
      setActiveStep("source");
      message.warning("请先选择文件");
      return;
    }
    if (fieldMappings.length === 0) {
      setActiveStep("mapping");
      message.warning("请先完成预解析和字段定义");
      return;
    }
    if (!values.targetSourceId || !values.targetTable) {
      setActiveStep("target");
      message.warning("请先完成目标配置");
      return;
    }
    if (values.targetTableMode === "existing" && !values.rebuildTargetTable) {
      const unmatched = fieldMappings.filter((item) => item.enabled !== false && item.mappingMode !== "custom" && item.matchStatus === "unmatched");
      if (unmatched.length > 0) {
        setActiveStep("target");
        message.warning(`已有表模式下仍有 ${unmatched.length} 个字段未匹配目标列`);
        return;
      }
    }

    setSaving(true);
    try {
      await createFileImportTask(token, actualFiles, {
        taskName: values.taskName,
        taskCode: values.taskCode,
        targetSourceId: values.targetSourceId,
        targetTable: values.targetTable,
        targetTableMode: values.targetTableMode,
        writeMode: values.writeMode,
        description: values.description,
        ownerName: user?.displayName || user?.username,
        ...buildPreviewPayload(),
        fieldMappings,
      });
      message.success("文件上传任务已创建");
      navigate("/dashboard/data-file-imports");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "创建任务失败");
    } finally {
      setSaving(false);
    }
  }

  const activePreviewFile = previewFiles.find((item) => item.fileName === activePreviewFileKey) || previewFiles[0] || null;
  const selectedMappingIndex = fieldMappings.findIndex((item) => `${item.sourceField}__${item.targetField}` === selectedFieldKey);
  const selectedTargetSource = sources.find((item) => item.id === Number(selectedTargetSourceId)) || null;

  const sourceTab: TabsProps["items"] = [
    {
      key: "source",
      label: "1. 选择来源",
      children: (
        <Space direction="vertical" size={16} style={{ display: "flex" }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(360px, 0.9fr) minmax(520px, 1.1fr)", gap: 12 }}>
            <div style={{ border: "1px solid #edf2f7", borderRadius: 16, padding: 16, background: "#fff" }}>
              <Space direction="vertical" size={14} style={{ display: "flex" }}>
                <Upload
                  multiple
                  beforeUpload={() => false}
                  fileList={fileList}
                  onChange={({ fileList: nextFileList }) => {
                    setFileList(nextFileList);
                    resetPreview();
                  }}
                >
                  <Button icon={<UploadOutlined />}>选择本地文件</Button>
                </Upload>

                <Button
                  type="primary"
                  icon={<EyeOutlined />}
                  loading={previewLoading}
                  disabled={actualFiles.length === 0}
                  onClick={() => void handlePreview()}
                  style={{ width: "fit-content" }}
                >
                  预解析
                </Button>

                <Descriptions size="small" bordered column={2}>
                  <Descriptions.Item label="文件数">{actualFiles.length}</Descriptions.Item>
                  <Descriptions.Item label="预解析">{previewFiles.length > 0 ? <Tag color="green">已完成</Tag> : <Tag>未执行</Tag>}</Descriptions.Item>
                </Descriptions>
              </Space>
            </div>

            <div style={{ border: "1px solid #edf2f7", borderRadius: 16, padding: 16, background: "#fff" }}>
              <Space direction="vertical" size={12} style={{ display: "flex" }}>
                <Descriptions size="small" bordered column={2}>
                  <Descriptions.Item label="当前文件">{actualFiles[0]?.name || "-"}</Descriptions.Item>
                  <Descriptions.Item label="文件数">{actualFiles.length}</Descriptions.Item>
                  <Descriptions.Item label="当前 sheet">
                    {activePreviewFile ? (fileOptions[activePreviewFile.fileName]?.sheetName || activePreviewFile.selectedSheetName || activePreviewFile.availableSheets?.[0] || "-") : "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="记录数">{activePreviewFile?.totalRows || 0}</Descriptions.Item>
                </Descriptions>

                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                {actualFiles.map((file) => {
                  const preview = previewFiles.find((item) => item.fileName === file.name);
                  const canChooseSheet = preview && preview.availableSheets.length > 0;
                  return (
                    <div key={file.name} style={{ border: "1px solid #edf2f7", borderRadius: 14, padding: "12px 14px", background: "#fff" }}>
                      <Space style={{ width: "100%", justifyContent: "space-between" }} align="center">
                        <Space>
                          <Tag>{file.name.split(".").pop()?.toLowerCase() || "file"}</Tag>
                          <Typography.Text>{file.name}</Typography.Text>
                        </Space>
                        {canChooseSheet ? (
                          <Select
                            size="small"
                            style={{ width: 180 }}
                            value={fileOptions[file.name]?.sheetName || preview?.selectedSheetName || preview?.availableSheets[0]}
                            options={(preview?.availableSheets || []).map((sheet) => ({ label: sheet, value: sheet }))}
                            onChange={(value) => {
                              const nextFileOptions = {
                                ...fileOptions,
                                [file.name]: {
                                  ...(fileOptions[file.name] || {}),
                                  sheetName: value,
                                },
                              };
                              setFileOptions(nextFileOptions);
                              if (previewFiles.length > 0) {
                                void handlePreview(nextFileOptions);
                              }
                            }}
                          />
                        ) : null}
                      </Space>
                    </div>
                  );
                })}
                {actualFiles.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未选择文件" /> : null}
                </div>
              </Space>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <Form.Item label="字段名模式" name="fieldNameMode" style={{ flex: 1, marginBottom: 0 }}>
              <Select
                options={[
                  { label: "读取表头", value: "header" },
                  { label: "自动生成", value: "generated" },
                ]}
              />
            </Form.Item>
            <Form.Item label="技术名格式" name="technicalNameMode" style={{ flex: 1, marginBottom: 0 }}>
              <Select
                options={[
                  { label: "snake_case", value: "snake_case" },
                  { label: "camelCase", value: "camelCase" },
                  { label: "UPPER_SNAKE", value: "upper_snake" },
                ]}
              />
            </Form.Item>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <Form.Item label="字段名行" name="headerRowNumber" style={{ flex: 1, marginBottom: 0 }}>
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item label="首个数据行" name="firstDataRowNumber" style={{ flex: 1, marginBottom: 0 }}>
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <Form.Item label="字段分隔符" name="delimiter" style={{ flex: 1, marginBottom: 0 }}>
              <Select
                allowClear
                options={[
                  { label: "自动识别", value: "" },
                  { label: "逗号 ,", value: "," },
                  { label: "Tab", value: "\t" },
                  { label: "竖线 |", value: "|" },
                  { label: "分号 ;", value: ";" },
                ]}
              />
            </Form.Item>
            <Form.Item label="编码" name="encoding" style={{ flex: 1, marginBottom: 0 }}>
              <Select
                options={[
                  { label: "UTF-8", value: "utf8" },
                  { label: "GBK", value: "gbk" },
                  { label: "GB18030", value: "gb18030" },
                ]}
              />
            </Form.Item>
          </div>

          <Form.Item label="错误处理" name="skipErrorRows" style={{ marginBottom: 0 }}>
            <Select
              options={[
                { label: "跳过错误行继续导入", value: true },
                { label: "遇错即终止", value: false },
              ]}
            />
          </Form.Item>
        </Space>
      ),
    },
    {
      key: "mapping",
      label: "2. 定义字段",
      children: (
        <Space direction="vertical" size={12} style={{ display: "flex" }}>
          <Space style={{ justifyContent: "space-between", width: "100%" }}>
            <Space>
              <Button icon={<RobotOutlined />} disabled={fieldMappings.length === 0} onClick={() => void handleSuggestNames()}>
                中文名转英文技术名
              </Button>
              <Button icon={<PlusOutlined />} onClick={handleAddCustomField}>
                新增自定义字段
              </Button>
            </Space>
            <Typography.Text type="secondary">可关闭无用字段，也可新增固定值字段。</Typography.Text>
          </Space>

          <Descriptions size="small" bordered column={3}>
            <Descriptions.Item label="总字段数">{fieldMappings.length}</Descriptions.Item>
            <Descriptions.Item label="启用字段">{fieldMappings.filter((item) => item.enabled !== false).length}</Descriptions.Item>
            <Descriptions.Item label="自定义字段">{fieldMappings.filter((item) => item.mappingMode === "custom").length}</Descriptions.Item>
          </Descriptions>
        </Space>
      ),
    },
    {
      key: "target",
      label: "3. 选择目标",
      children: (
        <Space direction="vertical" size={16} style={{ display: "flex" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <Form.Item label="任务名称" name="taskName" rules={[{ required: true, message: "请输入任务名称" }]} style={{ flex: 1, marginBottom: 0 }}>
              <Input placeholder="例如：导入_门诊规则" />
            </Form.Item>
            <Form.Item label="任务编码" name="taskCode" style={{ flex: 1, marginBottom: 0 }}>
              <Input placeholder="可选，不填自动生成" />
            </Form.Item>
          </div>

          <Form.Item label="目标数据源" name="targetSourceId" rules={[{ required: true, message: "请选择目标数据源" }]} style={{ marginBottom: 0 }}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="请选择目标数据源"
              options={sources.map((item) => ({
                value: item.id,
                label: `${item.sourceName} (${inferDatasourceDialect(item.sourceType, item.connectionConfig || {})})`,
              }))}
            />
          </Form.Item>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 260px) minmax(220px, 260px)", gap: 12 }}>
            <Form.Item label="表模式" name="targetTableMode" style={{ marginBottom: 0 }}>
              <Select
                options={[
                  { label: "自动建表", value: "create" },
                  { label: "已有表", value: "existing" },
                ]}
              />
            </Form.Item>
            <Form.Item label="写入方式" name="writeMode" style={{ marginBottom: 0 }}>
              <Select
                options={[
                  { label: "追加", value: "append" },
                  { label: "覆盖", value: "overwrite" },
                ]}
              />
            </Form.Item>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 140px", gap: 12, alignItems: "end" }}>
            <Form.Item label="目标表" name="targetTable" rules={[{ required: true, message: "请选择或输入目标表" }]} style={{ marginBottom: 0 }}>
              {selectedTargetTableMode === "existing" ? (
                <Select
                  showSearch
                  loading={targetTablesLoading}
                  optionFilterProp="label"
                  placeholder={selectedTargetSourceId ? "请选择已有表" : "请先选择目标数据源"}
                  options={targetTables.map((item) => ({
                    value: item.tableName,
                    label: item.tableComment ? `${item.tableName} (${item.tableComment})` : item.tableName,
                  }))}
                />
              ) : (
                <Input placeholder="例如：ods_upload_rules" />
              )}
            </Form.Item>
            <Form.Item name="rebuildTargetTable" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Checkbox>重建目标表</Checkbox>
            </Form.Item>
          </div>

          <Form.Item label="任务说明" name="description" style={{ marginBottom: 0 }}>
            <Input.TextArea rows={5} placeholder="说明数据来源、目标和解析约定" />
          </Form.Item>

          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="目标库">{selectedTargetSource ? <Space>{selectedTargetSource.sourceName}<Tag color="blue">{inferDatasourceDialect(selectedTargetSource.sourceType, selectedTargetSource.connectionConfig || {})}</Tag></Space> : "-"}</Descriptions.Item>
            <Descriptions.Item label="映射字段数">{fieldMappings.filter((item) => item.enabled !== false).length}</Descriptions.Item>
          </Descriptions>
        </Space>
      ),
    },
  ];

  function renderSourcePreviewPanel() {
    if (!previewFiles.length) {
      return <Empty description="选择文件后点击“预解析”，在这里查看当前文件的 sheet、样例和错误情况" />;
    }

    const tabItems: TabsProps["items"] = previewFiles.map((item) => ({
      key: item.fileName,
      label: item.fileName,
      children: (
        <Space direction="vertical" size={12} style={{ display: "flex" }}>
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="文件类型">{item.fileType}</Descriptions.Item>
            <Descriptions.Item label="记录数">{item.totalRows}</Descriptions.Item>
            <Descriptions.Item label="错误行">{item.rowErrors.length}</Descriptions.Item>
            <Descriptions.Item label="Sheet">
              {item.availableSheets.length > 0 ? (
                <Select
                  size="small"
                  style={{ minWidth: 180 }}
                  value={fileOptions[item.fileName]?.sheetName || item.selectedSheetName || item.availableSheets[0]}
                  options={item.availableSheets.map((sheet) => ({ label: sheet, value: sheet }))}
                  onChange={(value) => {
                    const nextFileOptions = {
                      ...fileOptions,
                      [item.fileName]: {
                        ...(fileOptions[item.fileName] || {}),
                        sheetName: value,
                      },
                    };
                    setFileOptions(nextFileOptions);
                    void handlePreview(nextFileOptions);
                  }}
                />
              ) : (
                "-"
              )}
            </Descriptions.Item>
          </Descriptions>

          <DraggableTableRegion>
            <Table
              size="small"
              rowKey={(_, index) => `${item.fileName}-${index}`}
              dataSource={item.sampleRows}
              columns={buildPreviewColumns(item.sampleRows)}
              pagination={false}
              scroll={{ x: "max-content", y: 540 }}
              locale={{ emptyText: "暂无预览样例" }}
            />
          </DraggableTableRegion>
        </Space>
      ),
    }));

    return (
      <Tabs
        activeKey={activePreviewFileKey || previewFiles[0]?.fileName}
        onChange={setActivePreviewFileKey}
        items={tabItems}
        style={{ height: "100%" }}
      />
    );
  }

  function renderMappingDetailPanel() {
    return (
      <DraggableTableRegion>
        <Table<FileImportFieldMapping>
          size="small"
          rowKey={(record) => `${record.sourceField}__${record.targetField}`}
          dataSource={fieldMappings}
          pagination={false}
          scroll={{ x: 1320, y: 420 }}
          locale={{ emptyText: "请先执行预解析" }}
          columns={[
            {
              title: "启用",
              dataIndex: "enabled",
              width: 70,
              render: (_value, record, index) => (
                <Checkbox
                  checked={record.enabled !== false}
                  onChange={(event) => updateMappingAt(index, { enabled: event.target.checked })}
                />
              ),
            },
            {
              title: "映射方式",
              width: 140,
              render: (_value, record, index) => (
                <Select
                  value={record.mappingMode || "source"}
                  style={{ width: "100%" }}
                  options={[
                    { label: "来源字段", value: "source" },
                    { label: "自定义值", value: "custom" },
                  ]}
                  onChange={(value) => {
                    updateMappingAt(index, {
                      mappingMode: value,
                      matchStatus: value === "custom" ? "custom" : record.matchStatus,
                    });
                  }}
                />
              ),
            },
            {
              title: "来源字段 / 自定义值",
              width: 260,
              render: (_value, record, index) => (
                record.mappingMode === "custom" ? (
                  <Input
                    value={record.customValue || ""}
                    onChange={(event) => updateMappingAt(index, { customValue: event.target.value })}
                    placeholder="请输入固定值"
                  />
                ) : (
                  <Input value={record.sourceField} disabled />
                )
              ),
            },
            {
              title: "目标字段",
              dataIndex: "targetField",
              width: 220,
              render: (_value, record, index) => (
                <Input
                  value={record.targetField}
                  onChange={(event) => updateMappingAt(index, { targetField: event.target.value })}
                />
              ),
            },
            {
              title: "目标类型",
              dataIndex: "dataType",
              width: 180,
              render: (_value, record, index) => (
                <Select
                  value={record.dataType}
                  style={{ width: "100%" }}
                  options={dataTypeOptions}
                  onChange={(value) => updateMappingAt(index, { dataType: value })}
                />
              ),
            },
            {
              title: "允许为空",
              width: 120,
              render: (_value, record, index) => (
                <Select
                  value={record.nullable ? "yes" : "no"}
                  style={{ width: "100%" }}
                  options={[
                    { label: "是", value: "yes" },
                    { label: "否", value: "no" },
                  ]}
                  onChange={(value) => updateMappingAt(index, { nullable: value === "yes" })}
                />
              ),
            },
            {
              title: "状态",
              width: 110,
              render: (_value, record) => renderMatchTag(record),
            },
            {
              title: "操作",
              width: 90,
              render: (_value, record, index) => (
                record.mappingMode === "custom" ? (
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      setFieldMappings((current) => current.filter((_item, itemIndex) => itemIndex !== index));
                    }}
                  >
                    删除
                  </Button>
                ) : "-"
              ),
            },
          ]}
        />
      </DraggableTableRegion>
    );
  }

  function renderTargetMappingPanel() {
    if (selectedTargetTableMode === "existing") {
      return (
        <Space direction="vertical" size={16} style={{ display: "flex" }}>
          <Card size="small" title="目标字段映射">
            <DraggableTableRegion>
              <Table<FileImportFieldMapping>
                size="small"
                rowKey={(record) => `${record.sourceField}__${record.targetField}`}
                loading={targetColumnsLoading}
                dataSource={fieldMappings}
                pagination={false}
                scroll={{ x: 960, y: 520 }}
                columns={[
                  { title: "来源字段", dataIndex: "sourceField", width: 160, render: (_value, record) => (record.mappingMode === "custom" ? "自定义值" : record.sourceField) },
                  {
                    title: "目标列",
                    width: 240,
                    render: (_value, record, index) => (
                      <Select
                        allowClear
                        disabled={record.enabled === false}
                        style={{ width: "100%" }}
                        value={record.targetField}
                        options={targetColumns.map((item) => ({
                          value: item.columnName,
                          label: item.columnComment ? `${item.columnName} (${item.columnComment})` : item.columnName,
                        }))}
                        onChange={(value) => {
                          const targetColumn = targetColumns.find((item) => item.columnName === value);
                          updateMappingAt(index, {
                            targetField: value || "",
                            dataType: String(targetColumn?.columnType || targetColumn?.dataType || record.dataType),
                            nullable: targetColumn?.isNullable ?? record.nullable,
                            matchStatus: value ? "matched" : "unmatched",
                            autoMapped: false,
                          });
                        }}
                      />
                    )
                  },
                  {
                    title: "目标类型",
                    width: 180,
                    render: (_value, record) => record.dataType,
                  },
                  {
                    title: "状态",
                    width: 100,
                    render: (_value, record) => renderMatchTag(record),
                  },
                ]}
              />
            </DraggableTableRegion>
          </Card>

          <Card size="small" title="目标表字段清单">
            <Table<DataSourceColumn>
              size="small"
              rowKey="columnName"
              loading={targetColumnsLoading}
              dataSource={targetColumns}
              pagination={false}
              scroll={{ y: 200 }}
              columns={[
                { title: "列名", dataIndex: "columnName", width: 180 },
                { title: "类型", dataIndex: "columnType", width: 180 },
                { title: "主键", dataIndex: "isPrimaryKey", width: 80, render: (value) => (value ? "是" : "否") },
              ]}
            />
          </Card>
        </Space>
      );
    }

    return (
      <Card size="small" title="目标表结构预览">
        <DraggableTableRegion>
          <Table<FileImportFieldMapping>
            size="small"
            rowKey={(record) => `${record.sourceField}__${record.targetField}`}
            dataSource={fieldMappings.filter((item) => item.enabled !== false)}
            pagination={false}
            scroll={{ x: 880, y: 620 }}
            columns={[
              { title: "来源", dataIndex: "sourceField", width: 180, render: (_value, record) => (record.mappingMode === "custom" ? "自定义值" : record.sourceField) },
              { title: "目标字段", dataIndex: "targetField", width: 180 },
              { title: "目标类型", dataIndex: "dataType", width: 180 },
              { title: "允许为空", dataIndex: "nullable", width: 100, render: (value) => (value ? "是" : "否") },
            ]}
          />
        </DraggableTableRegion>
      </Card>
    );
  }

  function renderRightPanel() {
    if (activeStep === "mapping") {
      return renderMappingDetailPanel();
    }
    if (activeStep === "target") {
      return renderTargetMappingPanel();
    }
    return renderSourcePreviewPanel();
  }

  const activeStepContent = sourceTab.find((item) => item.key === activeStep)?.children || null;
  const detailTitle = activeStep === "source" ? "预览与结果" : activeStep === "mapping" ? "字段清单" : "目标映射";
  const rowsTemplate = activeStep === "source"
    ? "auto minmax(320px, 1fr)"
    : activeStep === "mapping"
      ? "auto minmax(420px, 1fr)"
      : "auto minmax(360px, 1fr)";

  return (
    <Form form={form} layout="vertical">
      <div style={{ height: "calc(100vh - 176px)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Card bordered={false} style={{ marginBottom: 16 }}>
          <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>新建文件上传任务</Typography.Title>
            </div>
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/dashboard/data-file-imports")}>
                返回列表
              </Button>
              <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void handleSave()}>
                保存任务
              </Button>
            </Space>
          </Space>
        </Card>

        <div style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", gap: 16, minHeight: 0, flex: 1 }}>
          <Card bordered={false} styles={{ body: { padding: 8 } }}>
            <Tabs
              activeKey={activeStep}
              onChange={(key) => setActiveStep(key as StepKey)}
              items={sourceTab.map((item) => ({ key: item.key, label: item.label }))}
              style={{ marginBottom: -8 }}
            />
          </Card>

          <div style={{ display: "grid", gridTemplateRows: rowsTemplate, gap: 16, minHeight: 0 }}>
            <Card bordered={false} styles={{ body: { height: "100%", overflow: "auto" } }}>
              {activeStepContent}
            </Card>

            <Card bordered={false} title={detailTitle} styles={{ body: { height: "calc(100% - 56px)", overflow: "auto" } }}>
              {renderRightPanel()}
            </Card>
          </div>
        </div>
      </div>
    </Form>
  );
}
