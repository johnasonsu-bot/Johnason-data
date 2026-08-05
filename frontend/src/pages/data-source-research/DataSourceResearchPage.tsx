import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Tag,
  Transfer,
  Typography,
  message,
} from "antd";
import type { TransferItem } from "antd/es/transfer";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { DataTableCard } from "../../components/ui/DataTableCard";
import { PageToolbar } from "../../components/ui/PageToolbar";
import { StatCard } from "../../components/ui/StatCard";
import {
  createDataSourceResearchTask,
  createDataSourceResearchTaskRun,
  deleteDataSourceResearchTask,
  fetchDataSourceResearchTasks,
  fetchDataSourceTables,
  fetchDataSources,
  updateDataSourceResearchTask,
} from "../../services/platform";
import type {
  DataSourceRecord,
  DataSourceResearchTaskRecord,
  DataSourceTable,
} from "../../types/api";
import { inferDatasourceDialect, normalizeDatasourceType } from "../../utils/datasource";
import {
  RESEARCH_ITEM_OPTIONS,
  formatDateTime,
  getResearchObjectLabels,
  renderStatusTag,
  type ResearchItemKey,
} from "./researchCommon";

type ResearchTaskFormValues = {
  taskName: string;
  sourceId: number;
  tableScope: "all" | "manual";
  selectedTables: string[];
  sampleSize: number;
  maxTables: number;
  rowCountMode: "estimated" | "exact";
  metadataConcurrency: number;
  aiBatchSize: number;
  researchItems: ResearchItemKey[];
  notes?: string;
  description?: string;
  status: "active" | "disabled";
};

function defaultTaskFormValues(sourceId?: number): Partial<ResearchTaskFormValues> {
  return {
    sourceId,
    tableScope: "all",
    selectedTables: [],
    sampleSize: 50,
    maxTables: 50,
    rowCountMode: "estimated",
    metadataConcurrency: 3,
    aiBatchSize: 15,
    researchItems: ["table_classification", "table_relationship", "data_scale", "quality_inspection", "ingestion_advice", "governance_advice", "analysis_advice"],
    notes: "",
    description: "",
    status: "active",
  };
}

export function DataSourceResearchPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [taskForm] = Form.useForm<ResearchTaskFormValues>();
  const tableScope = Form.useWatch("tableScope", taskForm) || "all";
  const selectedTables = Form.useWatch("selectedTables", taskForm) || [];
  const selectedSourceId = Form.useWatch("sourceId", taskForm);

  const [tasks, setTasks] = useState<DataSourceResearchTaskRecord[]>([]);
  const [sources, setSources] = useState<DataSourceRecord[]>([]);
  const [sourceTables, setSourceTables] = useState<DataSourceTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [editingTask, setEditingTask] = useState<DataSourceResearchTaskRecord | null>(null);
  const [keyword, setKeyword] = useState("");
  const [sourceFilter, setSourceFilter] = useState<number | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [runningTaskId, setRunningTaskId] = useState<number | null>(null);
  const selectedSource = sources.find((item) => item.id === selectedSourceId);
  const selectedSourceType = normalizeDatasourceType(selectedSource?.sourceType);
  const objectLabel = selectedSourceType === "ftp" ? "文件" : selectedSourceType === "kafka" ? "Topic" : "表";

  const sourceOptions = useMemo(() => sources.map((item) => ({
    value: item.id,
    label: `${item.sourceName} / ${item.sourceType}`,
  })), [sources]);

  const tableTransferData = useMemo<TransferItem[]>(() => sourceTables.map((item) => ({
    key: item.tableName,
    title: item.tableName,
    description: item.tableComment || "",
  })), [sourceTables]);

  const supportedSources = useMemo(() => sources.filter((item) => (
    ["mysql", "postgresql", "hive", "ftp", "kafka"].includes(inferDatasourceDialect(item.sourceType, item.connectionConfig || {}))
  )), [sources]);

  const kpis = useMemo(() => {
    const runningCount = tasks.filter((item) => ["pending", "running"].includes(String(item.lastRunStatus || ""))).length;
    const succeededCount = tasks.filter((item) => item.lastRunStatus === "succeeded").length;
    return [
      { key: "tasks", title: "调研任务", value: tasks.length, icon: <EyeOutlined />, description: "独立管理的数据源调研任务" },
      { key: "running", title: "运行中", value: runningCount, icon: <PlayCircleOutlined />, description: "最近批次正在执行或排队" },
      { key: "succeeded", title: "已产出报告", value: succeededCount, icon: <DownloadOutlined />, description: "最近批次成功生成报告" },
    ];
  }, [tasks]);

  async function loadSources() {
    if (!token) return;
    try {
      const response = await fetchDataSources(token, { includeConnectivity: true });
      setSources(response.data || []);
    } catch (error: any) {
      message.error(`加载数据源失败: ${error.message || "未知错误"}`);
    }
  }

  async function loadTasks() {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetchDataSourceResearchTasks(token, { sourceId: sourceFilter, status: statusFilter, keyword });
      setTasks(response.data || []);
    } catch (error: any) {
      message.error(`加载数据调研清单失败: ${error.message || "未知错误"}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadTables(sourceId?: number) {
    if (!token || !sourceId) {
      setSourceTables([]);
      return;
    }
    setLoadingTables(true);
    try {
      const response = await fetchDataSourceTables(token, sourceId);
      setSourceTables(response.data || []);
    } catch (error: any) {
      setSourceTables([]);
      message.error(`加载表清单失败: ${error.message || "未知错误"}`);
    } finally {
      setLoadingTables(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    void loadSources();
    void loadTasks();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void loadTasks();
  }, [sourceFilter, statusFilter]);

  useEffect(() => {
    if (!taskModalOpen) return;
    void loadTables(selectedSourceId);
  }, [selectedSourceId, taskModalOpen, token]);

  function openCreateTask() {
    setEditingTask(null);
    setSourceTables([]);
    taskForm.setFieldsValue(defaultTaskFormValues(supportedSources[0]?.id) as ResearchTaskFormValues);
    setTaskModalOpen(true);
  }

  function openEditTask(task: DataSourceResearchTaskRecord) {
    setEditingTask(task);
    taskForm.setFieldsValue({
      taskName: task.taskName,
      sourceId: task.sourceId,
      tableScope: task.tableScope,
      selectedTables: task.selectedTables || [],
      sampleSize: task.config.sampleSize || 50,
      maxTables: task.config.maxTables || 50,
      rowCountMode: task.config.rowCountMode || "estimated",
      metadataConcurrency: task.config.metadataConcurrency || 3,
      aiBatchSize: task.config.aiBatchSize || 15,
      researchItems: ((task.config.researchItems || []).map((item) => item === "metadata_inspection" ? "quality_inspection" : item).filter((item) => RESEARCH_ITEM_OPTIONS.some((option) => option.value === item)) as ResearchItemKey[]) || ["table_classification", "data_scale", "quality_inspection", "ingestion_advice"],
      notes: task.config.notes || "",
      description: task.description || "",
      status: task.status || "active",
    });
    setTaskModalOpen(true);
  }

  async function handleSubmitTask() {
    if (!token) return;
    try {
      const values = await taskForm.validateFields();
      setTaskSubmitting(true);
      if (editingTask) {
        await updateDataSourceResearchTask(token, editingTask.id, values);
        message.success("数据调研任务已更新");
      } else {
        await createDataSourceResearchTask(token, values);
        message.success("数据调研任务已创建");
      }
      setTaskModalOpen(false);
      await loadTasks();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(`保存数据调研任务失败: ${error.message || "未知错误"}`);
      }
    } finally {
      setTaskSubmitting(false);
    }
  }

  async function handleDeleteTask(task: DataSourceResearchTaskRecord) {
    if (!token) return;
    try {
      await deleteDataSourceResearchTask(token, task.id);
      message.success("数据调研任务已删除");
      await loadTasks();
    } catch (error: any) {
      message.error(`删除任务失败: ${error.message || "未知错误"}`);
    }
  }

  async function handleRunTask(task: DataSourceResearchTaskRecord) {
    if (!token) return;
    setRunningTaskId(task.id);
    try {
      const response = await createDataSourceResearchTaskRun(token, task.id);
      message.success("调研批次已启动");
      navigate(`/dashboard/data-source-research/${task.id}?runId=${response.data.id}`);
    } catch (error: any) {
      message.error(`启动调研失败: ${error.message || "未知错误"}`);
    } finally {
      setRunningTaskId(null);
    }
  }

  function openTaskDetail(task: DataSourceResearchTaskRecord) {
    navigate(`/dashboard/data-source-research/${task.id}`);
  }

  const columns: ColumnsType<DataSourceResearchTaskRecord> = [
    {
      title: "任务名称",
      dataIndex: "taskName",
      key: "taskName",
      render: (value, record) => (
        <Space direction="vertical" size={2}>
          <Button type="link" style={{ padding: 0, height: "auto" }} onClick={() => openTaskDetail(record)}>
            {value}
          </Button>
          <Typography.Text type="secondary">{record.description || "未补充任务说明"}</Typography.Text>
        </Space>
      ),
    },
    { title: "数据源", dataIndex: "sourceName", key: "sourceName", width: 210 },
    {
      title: "调研范围",
      key: "tableScope",
      width: 150,
      render: (_value, record) => {
        const labels = getResearchObjectLabels(record.sourceType);
        return record.tableScope === "manual"
          ? `手工 ${record.selectedTables.length} ${labels.objectUnit}${labels.objectName}`
          : `前 ${record.config.maxTables || 50} ${labels.objectUnit}${labels.objectName}`;
      },
    },
    {
      title: "调研方向",
      key: "researchItems",
      width: 260,
      render: (_value, record) => (
        <Space size={[4, 4]} wrap>
          {(record.config.researchItems || []).map((item) => <Tag key={item}>{RESEARCH_ITEM_OPTIONS.find((option) => option.value === item)?.label || item}</Tag>)}
        </Space>
      ),
    },
    { title: "任务状态", dataIndex: "status", key: "status", width: 100, render: renderStatusTag },
    { title: "最近批次", dataIndex: "lastRunStatus", key: "lastRunStatus", width: 110, render: renderStatusTag },
    { title: "最近运行", dataIndex: "lastRunAt", key: "lastRunAt", width: 180, render: formatDateTime },
    {
      title: "操作",
      key: "actions",
      width: 320,
      render: (_value, record) => (
        <Space size="small">
          <Button type="link" icon={<PlayCircleOutlined />} loading={runningTaskId === record.id} disabled={record.status === "disabled"} onClick={() => void handleRunTask(record)}>
            执行
          </Button>
          <Button type="link" icon={<EyeOutlined />} onClick={() => openTaskDetail(record)}>
            结果
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEditTask(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除该调研任务？" description="删除后会同时移除该任务下的批次和对比记录。" onConfirm={() => void handleDeleteTask(record)} okButtonProps={{ danger: true }}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="app-page">
      <PageToolbar
        left={(
          <>
            <Input.Search allowClear className="toolbar-search" placeholder="搜索任务、数据源、说明" value={keyword} onChange={(event) => setKeyword(event.target.value)} onSearch={() => void loadTasks()} />
            <Select allowClear placeholder="数据源" style={{ width: 220 }} value={sourceFilter} options={sourceOptions} onChange={setSourceFilter} />
            <Select allowClear placeholder="任务状态" style={{ width: 140 }} value={statusFilter} options={[{ value: "active", label: "启用" }, { value: "disabled", label: "停用" }]} onChange={setStatusFilter} />
          </>
        )}
        right={(
          <>
            <Button icon={<ReloadOutlined />} onClick={() => void loadTasks()} loading={loading}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateTask}>新建调研任务</Button>
          </>
        )}
      />
      <div className="app-page-body">
        <div className="kpi-grid">
          {kpis.map((item) => <StatCard key={item.key} title={item.title} value={item.value} icon={item.icon} description={item.description} />)}
        </div>
        <DataTableCard<DataSourceResearchTaskRecord>
          title="数据调研清单"
          extra={<Typography.Text type="secondary">共 {tasks.length} 个任务</Typography.Text>}
          tableProps={{
            rowKey: "id",
            loading,
            columns,
            dataSource: tasks,
            pagination: { pageSize: 8, showSizeChanger: false },
            scroll: { x: 1500 },
          }}
        />
      </div>

      <Modal
        open={taskModalOpen}
        title={editingTask ? "编辑调研任务" : "新建调研任务"}
        onCancel={() => setTaskModalOpen(false)}
        onOk={() => void handleSubmitTask()}
        confirmLoading={taskSubmitting}
        width={1100}
        destroyOnHidden
      >
        <Form form={taskForm} layout="vertical">
          <Row gutter={16} style={{ marginLeft: 0, marginRight: 0 }}>
            <Col xs={24} md={8}>
              <Form.Item name="taskName" label="任务名称" rules={[{ required: true, message: "请输入任务名称" }]}>
                <Input placeholder="例如：核心业务库数据调研" />
              </Form.Item>
            </Col>
            <Col xs={24} md={10}>
              <Form.Item name="sourceId" label="数据源" rules={[{ required: true, message: "请选择数据源" }]}>
                <Select showSearch optionFilterProp="label" options={supportedSources.map((item) => ({ value: item.id, label: `${item.sourceName} / ${item.sourceType}` }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="status" label="任务状态">
                <Select options={[{ value: "active", label: "启用" }, { value: "disabled", label: "停用" }]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16} style={{ marginLeft: 0, marginRight: 0 }}>
            <Col xs={24} sm={12} md={8} xl={4}>
              <Form.Item name="tableScope" label={`${objectLabel}范围`}>
                <Select options={[{ label: `前 N 个${objectLabel}`, value: "all" }, { label: `手工勾选${objectLabel}`, value: "manual" }]} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} xl={4}>
              <Form.Item name="sampleSize" label={selectedSourceType === "ftp" ? "文件抽样行数" : selectedSourceType === "kafka" ? "消息抽样条数" : "数据抽样条数"}>
                <Select options={[20, 50, 100, 200].map((value) => ({ label: `${value} 条`, value }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} xl={4}>
              <Form.Item name="maxTables" label={`最大探查${objectLabel}数`}>
                <InputNumber min={1} max={500} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} xl={4}>
              <Form.Item name="rowCountMode" label="行数统计策略">
                <Select options={[{ label: "估算优先", value: "estimated" }, { label: "精确统计", value: "exact" }]} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} xl={4}>
              <Form.Item name="metadataConcurrency" label="元数据并发度">
                <InputNumber min={1} max={8} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} xl={4}>
              <Form.Item name="aiBatchSize" label={`AI批次${objectLabel}数`}>
                <InputNumber min={5} max={30} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="researchItems" label="调研方向" rules={[{ required: true, message: "请选择调研方向" }]}>
            <Checkbox.Group options={RESEARCH_ITEM_OPTIONS} />
          </Form.Item>
          <Form.Item name="description" label="任务说明">
            <Input.TextArea rows={2} placeholder="描述本任务关注的数据域、业务背景或长期观察目标" />
          </Form.Item>
          <Form.Item name="notes" label="模型补充说明">
            <Input.TextArea rows={2} placeholder="可选，补充业务背景、优先关注主题域或特殊约束" />
          </Form.Item>
          {tableScope === "manual" ? (
            <Form.Item name="selectedTables" label={`指定${objectLabel}范围${selectedTables.length ? `（已选 ${selectedTables.length} 个）` : ""}`} rules={[{ required: true, message: `请至少选择一个${objectLabel}` }]}>
              <Transfer
                dataSource={tableTransferData}
                titles={[`可选${objectLabel}`, `已选${objectLabel}`]}
                targetKeys={selectedTables}
                onChange={(nextTargetKeys) => taskForm.setFieldValue("selectedTables", nextTargetKeys)}
                render={(item) => (
                  <Space direction="vertical" size={0}>
                    <Typography.Text>{item.title}</Typography.Text>
                    {item.description ? <Typography.Text type="secondary">{item.description}</Typography.Text> : null}
                  </Space>
                )}
                listStyle={{ width: "calc((100% - 56px) / 2)", height: 360 }}
                showSearch
                oneWay
                filterOption={(inputValue, item) => `${item.title || ""} ${item.description || ""}`.toLowerCase().includes(inputValue.toLowerCase())}
                disabled={loadingTables}
              />
            </Form.Item>
          ) : (
            <Alert type="success" showIcon message={`自动模式会按当前${objectLabel}清单顺序截取前 N 个对象进行调研`} description={`当前可用${objectLabel}数 ${sourceTables.length} 个，实际执行时按“最大探查${objectLabel}数”限制。`} />
          )}
        </Form>
      </Modal>
    </div>
  );
}
