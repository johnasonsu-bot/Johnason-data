import {
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
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
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  createFileImportTask,
  fetchFileImportTaskById,
  previewFileImports,
  suggestTechnicalNames,
  updateFileImportTask,
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
  FileImportTask,
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

function getTaskPreviewFiles(task: FileImportTask) {
  const previewSchema = task.previewSchema as { files?: FileImportPreviewFile[] } | undefined;
  return Array.isArray(previewSchema?.files) ? previewSchema.files : [];
}

function getTaskMergedSchema(task: FileImportTask) {
  const previewSchema = task.previewSchema as { mergedSchema?: FileImportFieldMapping[] } | undefined;
  return Array.isArray(previewSchema?.mergedSchema) ? previewSchema.mergedSchema : [];
}

function mergeMappingPreviewContext(task: FileImportTask) {
  const schemaMap = new Map(getTaskMergedSchema(task).map((item) => [item.sourceField, item]));
  return (task.fieldMappings || []).map((item) => {
    const schema = schemaMap.get(item.sourceField);
    return {
      ...item,
      sampleValues: item.sampleValues || schema?.sampleValues || [],
      sourceFiles: item.sourceFiles || schema?.sourceFiles || [],
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

export function FileImportCreatePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { token, user } = useAuth();
  const editTaskId = id ? Number(id) : null;
  const isEditMode = Boolean(editTaskId);
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
  const [loadingTask, setLoadingTask] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<FileImportPreviewFile[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FileImportFieldMapping[]>([]);
  const [fileOptions, setFileOptions] = useState<Record<string, { sheetName?: string }>>({});

  const actualFiles = useMemo(() => buildActualFiles(fileList), [fileList]);
  const selectedTargetSourceId = Form.useWatch("targetSourceId", form);
  const selectedTargetTableMode = Form.useWatch("targetTableMode", form);
  const selectedTargetTable = Form.useWatch("targetTable", form);

  const selectedMapping = useMemo(
    () => fieldMappings.find((item) => `${item.sourceField}__${item.targetField}` === selectedFieldKey) || fieldMappings[0] || null,
    [fieldMappings, selectedFieldKey]
  );

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
    if (!token || !isEditMode || !editTaskId || Number.isNaN(editTaskId)) return;
    setLoadingTask(true);
    void (async () => {
      try {
        const response = await fetchFileImportTaskById(token, editTaskId);
        const task = response.data;
        const parseOptions = (task.parseOptions || {}) as Partial<FormValues>;
        form.setFieldsValue({
          taskName: task.taskName,
          taskCode: task.taskCode,
          targetSourceId: task.targetSourceId,
          targetTable: task.targetTable,
          targetTableMode: task.targetTableMode,
          writeMode: task.writeMode,
          description: task.description,
          headerRowNumber: Number(parseOptions.headerRowNumber || 1),
          firstDataRowNumber: Number(parseOptions.firstDataRowNumber || 2),
          fieldNameMode: parseOptions.fieldNameMode || "header",
          delimiter: parseOptions.delimiter,
          encoding: parseOptions.encoding || "utf8",
          technicalNameMode: parseOptions.technicalNameMode || "snake_case",
          skipErrorRows: parseOptions.skipErrorRows !== false,
          rebuildTargetTable: Boolean(parseOptions.rebuildTargetTable),
        });
        const taskPreviewFiles = getTaskPreviewFiles(task);
        setPreviewFiles(taskPreviewFiles);
        setActivePreviewFileKey(taskPreviewFiles[0]?.fileName || "");
        const nextMappings = mergeMappingPreviewContext(task);
        setFieldMappings(nextMappings);
        setSelectedFieldKey(nextMappings[0] ? `${nextMappings[0].sourceField}__${nextMappings[0].targetField}` : "");
        setFileOptions(Object.fromEntries((task.files || []).map((file) => [
          file.fileName,
          {
            ...(file.settings || {}),
            ...(file.sheetName ? { sheetName: file.sheetName } : {}),
          },
        ])));
        setFileList((task.files || []).map((file) => ({
          uid: String(file.id),
          name: file.fileName,
          status: "done",
          size: file.fileSize,
          type: file.fileExt,
        } as UploadFile)));
        setActiveStep("target");
      } catch (error) {
        message.error(error instanceof Error ? error.message : "加载文件上传任务失败");
      } finally {
        setLoadingTask(false);
      }
    })();
  }, [token, isEditMode, editTaskId, form]);

  useEffect(() => {
    if (!selectedMapping) {
      setSelectedFieldKey("");
      return;
    }
    setSelectedFieldKey(`${selectedMapping.sourceField}__${selectedMapping.targetField}`);
  }, [selectedMapping?.sourceField, selectedMapping?.targetField]);

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
        previewLimit: 50,
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
          previewLimit: 50,
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
      if (response.data.mode === "model") {
        message.success("已按模型完成字段双向翻译和目标类型建议");
      } else if (response.data.fallbackReason === "model_error") {
        message.warning("文件上传模型调用失败，已使用规则回退");
      } else {
        message.success("当前未配置文件上传模型，已使用规则回退");
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "字段翻译失败");
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
    if (!isEditMode && actualFiles.length === 0) {
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
      const payload = {
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
      };
      if (isEditMode && editTaskId) {
        await updateFileImportTask(token, editTaskId, payload);
        message.success("文件上传任务已更新");
      } else {
        await createFileImportTask(token, actualFiles, payload);
        message.success("文件上传任务已创建");
      }
      navigate("/dashboard/data-file-imports");
    } catch (error) {
      message.error(error instanceof Error ? error.message : (isEditMode ? "更新任务失败" : "创建任务失败"));
    } finally {
      setSaving(false);
    }
  }

  const activePreviewFile = previewFiles.find((item) => item.fileName === activePreviewFileKey) || previewFiles[0] || null;
  const selectedMappingIndex = fieldMappings.findIndex((item) => `${item.sourceField}__${item.targetField}` === selectedFieldKey);
  const selectedTargetSource = sources.find((item) => item.id === Number(selectedTargetSourceId)) || null;
  const enabledFieldCount = fieldMappings.filter((item) => item.enabled !== false).length;
  const unmatchedFieldCount = fieldMappings.filter((item) => item.enabled !== false && item.mappingMode !== "custom" && item.matchStatus === "unmatched").length;
  const customFieldCount = fieldMappings.filter((item) => item.mappingMode === "custom").length;

  const sourceTab: TabsProps["items"] = [
    {
      key: "source",
      label: "1. 选择来源",
      children: (
        <Space direction="vertical" size={16} style={{ display: "flex" }}>
          <Upload
            multiple
            disabled={isEditMode}
            beforeUpload={() => false}
            fileList={fileList}
            onChange={({ fileList: nextFileList }) => {
              if (isEditMode) return;
              setFileList(nextFileList);
              resetPreview();
            }}
          >
            <Button icon={<UploadOutlined />} disabled={isEditMode}>选择本地文件</Button>
          </Upload>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
            {fileList.map((file) => {
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
                          if (!isEditMode && previewFiles.length > 0) {
                            void handlePreview(nextFileOptions);
                          }
                        }}
                      />
                    ) : null}
                  </Space>
                </div>
              );
            })}
            {fileList.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未选择文件" /> : null}
          </div>

          <Space size={12} style={{ width: "100%" }} align="start">
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
          </Space>

          <Space size={12} style={{ width: "100%" }} align="start">
            <Form.Item label="字段名行" name="headerRowNumber" style={{ flex: 1, marginBottom: 0 }}>
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item label="首个数据行" name="firstDataRowNumber" style={{ flex: 1, marginBottom: 0 }}>
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
          </Space>

          <Space size={12} style={{ width: "100%" }} align="start">
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
          </Space>

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
                字段双向翻译
              </Button>
              <Button icon={<PlusOutlined />} onClick={handleAddCustomField}>
                新增自定义字段
              </Button>
            </Space>
            <Typography.Text type="secondary">可关闭无用字段，也可新增固定值字段。</Typography.Text>
          </Space>

          <Descriptions size="small" bordered column={4}>
            <Descriptions.Item label="总字段数">{fieldMappings.length}</Descriptions.Item>
            <Descriptions.Item label="启用字段">{enabledFieldCount}</Descriptions.Item>
            <Descriptions.Item label="待匹配">{unmatchedFieldCount}</Descriptions.Item>
            <Descriptions.Item label="自定义字段">{customFieldCount}</Descriptions.Item>
          </Descriptions>

          <Table<FileImportFieldMapping>
            size="small"
            rowKey={(record) => `${record.sourceField}__${record.targetField}`}
            dataSource={fieldMappings}
            pagination={false}
            scroll={{ x: 1180, y: 540 }}
            onRow={(record) => ({
              onClick: () => setSelectedFieldKey(`${record.sourceField}__${record.targetField}`),
            })}
            rowClassName={(record) => (`${record.sourceField}__${record.targetField}` === selectedFieldKey ? "ant-table-row-selected" : "")}
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
                width: 100,
                render: (_value, record) => renderSourceMode(record),
              },
              {
                title: "来源字段 / 自定义值",
                width: 220,
                render: (_value, record) => (record.mappingMode === "custom" ? record.customValue || "-" : record.sourceField),
              },
              { title: "目标字段名称", dataIndex: "targetField", width: 180 },
              { title: "目标字段注释", dataIndex: "columnComment", width: 220, ellipsis: true },
              { title: "目标类型", dataIndex: "dataType", width: 160 },
              {
                title: "状态",
                width: 100,
                render: (_value, record) => renderMatchTag(record),
              },
            ]}
          />
        </Space>
      ),
    },
    {
      key: "target",
      label: "3. 选择目标",
      children: (
        <Space direction="vertical" size={16} style={{ display: "flex" }}>
          <Row gutter={[16, 12]}>
            <Col xs={24} md={12}>
              <Form.Item label="任务名称" name="taskName" rules={[{ required: true, message: "请输入任务名称" }]} style={{ marginBottom: 0 }}>
                <Input placeholder="例如：导入_门诊规则" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="任务编码" name="taskCode" style={{ marginBottom: 0 }}>
                <Input disabled={isEditMode} placeholder="可选，不填自动生成" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 12]} align="top" style={{ maxWidth: 920 }}>
            <Col xs={24} md={12} xl={14}>
              <Form.Item label="目标数据源" name="targetSourceId" rules={[{ required: true, message: "请选择目标数据源" }]} style={{ marginBottom: 0 }}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={sources.map((item) => ({
                    value: item.id,
                    label: `${item.sourceName} (${inferDatasourceDialect(item.sourceType, item.connectionConfig || {})})`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={5}>
              <Form.Item label="表模式" name="targetTableMode" style={{ marginBottom: 0 }}>
                <Select
                  options={[
                    { label: "自动建表", value: "create" },
                    { label: "已有表", value: "existing" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={12} md={6} xl={5}>
              <Form.Item label="写入方式" name="writeMode" style={{ marginBottom: 0 }}>
                <Select
                  options={[
                    { label: "追加", value: "append" },
                    { label: "覆盖", value: "overwrite" },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 12]} align="bottom">
            <Col flex="auto">
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
            </Col>
            <Col flex="140px">
              <Form.Item name="rebuildTargetTable" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Checkbox>重建目标表</Checkbox>
              </Form.Item>
            </Col>
          </Row>

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

          <div style={{ maxHeight: 360, overflow: "hidden" }}>
            <Table
              size="small"
              rowKey={(_, index) => `${item.fileName}-${index}`}
              dataSource={item.sampleRows}
              columns={buildPreviewColumns(item.sampleRows)}
              pagination={false}
              scroll={{ x: "max-content", y: 300 }}
              locale={{ emptyText: "暂无预览样例" }}
            />
          </div>
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
    if (!selectedMapping || selectedMappingIndex < 0) {
      return <Empty description="请选择一个字段查看明细" />;
    }

    return (
      <Space direction="vertical" size={16} style={{ display: "flex" }}>
        <Card size="small" title="字段明细">
          <Space direction="vertical" size={12} style={{ display: "flex" }}>
            <Space>
              <Checkbox
                checked={selectedMapping.enabled !== false}
                onChange={(event) => updateMappingAt(selectedMappingIndex, { enabled: event.target.checked })}
              >
                启用该字段
              </Checkbox>
              {renderMatchTag(selectedMapping)}
            </Space>

            <Form layout="vertical">
              <Form.Item label="映射方式" style={{ marginBottom: 12 }}>
                <Select
                  value={selectedMapping.mappingMode || "source"}
                  options={[
                    { label: "来源字段", value: "source" },
                    { label: "自定义值", value: "custom" },
                  ]}
                  onChange={(value) => {
                    updateMappingAt(selectedMappingIndex, {
                      mappingMode: value,
                      matchStatus: value === "custom" ? "custom" : selectedMapping.matchStatus,
                    });
                  }}
                />
              </Form.Item>

              {selectedMapping.mappingMode === "custom" ? (
                <Form.Item label="自定义值" style={{ marginBottom: 12 }}>
                  <Input
                    value={selectedMapping.customValue || ""}
                    onChange={(event) => updateMappingAt(selectedMappingIndex, { customValue: event.target.value })}
                    placeholder="例如：固定分类、默认状态"
                  />
                </Form.Item>
              ) : (
                <Form.Item label="来源字段" style={{ marginBottom: 12 }}>
                  <Input value={selectedMapping.sourceField} disabled />
                </Form.Item>
              )}

              <Form.Item label="目标字段名称" style={{ marginBottom: 12 }}>
                <Input
                  value={selectedMapping.targetField}
                  onChange={(event) => updateMappingAt(selectedMappingIndex, { targetField: event.target.value })}
                />
              </Form.Item>

              <Form.Item label="目标字段注释" style={{ marginBottom: 12 }}>
                <Input
                  value={selectedMapping.columnComment || ""}
                  onChange={(event) => updateMappingAt(selectedMappingIndex, { columnComment: event.target.value })}
                  placeholder="例如：园区编码、建筑类型、登记日期"
                />
              </Form.Item>

              <Form.Item label="目标类型" style={{ marginBottom: 12 }}>
                <Select
                  value={selectedMapping.dataType}
                  options={dataTypeOptions}
                  onChange={(value) => updateMappingAt(selectedMappingIndex, { dataType: value })}
                />
              </Form.Item>

              <Form.Item label="允许为空" style={{ marginBottom: 0 }}>
                <Select
                  value={selectedMapping.nullable ? "yes" : "no"}
                  options={[
                    { label: "是", value: "yes" },
                    { label: "否", value: "no" },
                  ]}
                  onChange={(value) => updateMappingAt(selectedMappingIndex, { nullable: value === "yes" })}
                />
              </Form.Item>
            </Form>
          </Space>
        </Card>

        <Card
          size="small"
          title="样例值"
          extra={selectedMapping.mappingMode === "custom" ? null : <Typography.Text type="secondary">{selectedMapping.sourceFiles?.join(" / ") || "-"}</Typography.Text>}
        >
          {selectedMapping.mappingMode === "custom" ? (
            <Typography.Text type="secondary">当前字段使用固定自定义值，不依赖来源样例。</Typography.Text>
          ) : (
            <Space wrap>
              {(selectedMapping.sampleValues || []).map((item, index) => (
                <Tag key={`${selectedMapping.sourceField}-${index}`}>{String(item ?? "-")}</Tag>
              ))}
              {(!selectedMapping.sampleValues || selectedMapping.sampleValues.length === 0) ? <Typography.Text type="secondary">暂无样例值</Typography.Text> : null}
            </Space>
          )}
        </Card>

        {selectedMapping.mappingMode === "custom" ? (
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              setFieldMappings((current) => current.filter((_item, index) => index !== selectedMappingIndex));
            }}
          >
            删除自定义字段
          </Button>
        ) : null}
      </Space>
    );
  }

  function renderTargetMappingPanel() {
    if (selectedTargetTableMode === "existing") {
      return (
        <Space direction="vertical" size={16} style={{ display: "flex" }}>
          <Card size="small" title="目标字段映射">
            <Table<FileImportFieldMapping>
              size="small"
              rowKey={(record) => `${record.sourceField}__${record.targetField}`}
              loading={targetColumnsLoading}
              dataSource={fieldMappings}
              pagination={false}
              scroll={{ y: 520 }}
              columns={[
                { title: "来源字段", dataIndex: "sourceField", width: 160, render: (_value, record) => (record.mappingMode === "custom" ? "自定义值" : record.sourceField) },
                {
                  title: "目标列",
                  width: 220,
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
                          columnComment: targetColumn?.columnComment || record.columnComment,
                          matchStatus: value ? "matched" : "unmatched",
                          autoMapped: false,
                        });
                      }}
                    />
                  ),
                },
                {
                  title: "状态",
                  width: 100,
                  render: (_value, record) => renderMatchTag(record),
                },
              ]}
            />
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
                { title: "注释", dataIndex: "columnComment", width: 220, ellipsis: true },
                { title: "主键", dataIndex: "isPrimaryKey", width: 80, render: (value) => (value ? "是" : "否") },
              ]}
            />
          </Card>
        </Space>
      );
    }

    return (
      <Card size="small" title="目标表结构预览">
        <Table<FileImportFieldMapping>
          size="small"
          rowKey={(record) => `${record.sourceField}__${record.targetField}`}
          dataSource={fieldMappings.filter((item) => item.enabled !== false)}
          pagination={false}
          scroll={{ y: 620 }}
          columns={[
            { title: "来源", dataIndex: "sourceField", width: 180, render: (_value, record) => (record.mappingMode === "custom" ? "自定义值" : record.sourceField) },
            { title: "目标字段名称", dataIndex: "targetField", width: 180 },
            { title: "目标字段注释", dataIndex: "columnComment", width: 220, ellipsis: true },
            { title: "目标类型", dataIndex: "dataType", width: 180 },
            { title: "允许为空", dataIndex: "nullable", width: 100, render: (value) => (value ? "是" : "否") },
          ]}
        />
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

  const leftTemplate = activeStep === "mapping"
    ? "minmax(920px, 1.55fr) minmax(420px, 0.85fr)"
    : "repeat(2, minmax(0, 1fr))";

  return (
    <Form form={form} layout="vertical">
      <div style={{ height: "calc(100vh - var(--app-header-height) - 22px)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Card bordered={false} style={{ marginBottom: 16 }}>
          <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>{isEditMode ? "编辑文件上传任务" : "新建文件上传任务"}</Typography.Title>
              <Typography.Text type="secondary">{"按“选来源 -> 定义字段 -> 选目标”的习惯流程完成配置，所有操作都在单页内完成。"}</Typography.Text>
            </div>
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/dashboard/data-file-imports")}>
                返回列表
              </Button>
              <Button icon={<EyeOutlined />} disabled={isEditMode} loading={previewLoading} onClick={() => void handlePreview()}>
                预解析
              </Button>
              <Button type="primary" icon={<SaveOutlined />} loading={saving || loadingTask} onClick={() => void handleSave()}>
                {isEditMode ? "保存修改" : "保存任务"}
              </Button>
            </Space>
          </Space>
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: leftTemplate, gap: 16, minHeight: 0, flex: 1 }}>
          <Card bordered={false} styles={{ body: { height: "100%", padding: 0, overflow: "hidden" } }}>
            <Tabs
              activeKey={activeStep}
              onChange={(key) => setActiveStep(key as StepKey)}
              tabPosition="left"
              items={sourceTab}
              style={{ height: "100%" }}
              tabBarStyle={{ width: 160, paddingTop: 8 }}
            />
          </Card>

          <Card
            bordered={false}
            title={activeStep === "source" ? "预览与结果" : activeStep === "mapping" ? "字段明细" : "目标映射"}
            styles={{ body: { height: "calc(100% - 56px)", overflow: "hidden" } }}
          >
            {renderRightPanel()}
          </Card>
        </div>
      </div>
    </Form>
  );
}
