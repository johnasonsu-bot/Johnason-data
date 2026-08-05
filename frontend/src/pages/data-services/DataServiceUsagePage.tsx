import {
  ClockCircleOutlined,
  EditOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageToolbar } from "../../components/ui/PageToolbar";
import { invokeRuntimeDataService } from "../../services/dataServices";
import {
  createServiceUsageTask,
  loadRunningServiceUsageTaskKeys,
  loadServiceUsageHistory,
  loadServiceUsageTasks,
  saveRunningServiceUsageTaskKeys,
  saveServiceUsageHistory,
  saveServiceUsageTasks,
  type ServiceUsageHistoryItem,
  type ServiceUsageTask,
} from "./serviceUsageTasks";

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}

function buildParamsObject(paramsList?: Array<{ key?: string; value?: string }>) {
  return (paramsList || []).reduce<Record<string, unknown>>((acc, item) => {
    const key = String(item.key || "").trim();
    if (!key) return acc;
    acc[key] = item.value ?? "";
    return acc;
  }, {});
}

function formatCallsPerMinuteRange(task: Pick<ServiceUsageTask, "callsPerMinuteMin" | "callsPerMinuteMax">) {
  const min = Math.max(1, Number(task.callsPerMinuteMin || 1));
  const max = Math.max(min, Number(task.callsPerMinuteMax || min));
  return min === max ? `${min} 次/分钟` : `${min}-${max} 次/分钟`;
}

function resolveCallsPerMinute(task: Pick<ServiceUsageTask, "callsPerMinuteMin" | "callsPerMinuteMax">) {
  const min = Math.max(1, Number(task.callsPerMinuteMin || 1));
  const max = Math.max(min, Number(task.callsPerMinuteMax || min));
  if (min === max) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function DataServiceUsagePage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<ServiceUsageTask[]>([]);
  const [history, setHistory] = useState<ServiceUsageHistoryItem[]>([]);
  const [submittingTaskKey, setSubmittingTaskKey] = useState<string | null>(null);
  const [activeHistory, setActiveHistory] = useState<ServiceUsageHistoryItem | null>(null);
  const [runningTaskKeys, setRunningTaskKeys] = useState<string[]>([]);

  function persistRunningTaskKeys(nextKeys: string[]) {
    setRunningTaskKeys(nextKeys);
    saveRunningServiceUsageTaskKeys(nextKeys);
  }

  useEffect(() => {
    const storedTasks = loadServiceUsageTasks();
    const storedRunningKeys = loadRunningServiceUsageTaskKeys();
    setTasks(storedTasks);
    setHistory(loadServiceUsageHistory());
    persistRunningTaskKeys(storedRunningKeys.filter((taskKey) => storedTasks.some((task) => task.key === taskKey)));
  }, []);

  useEffect(() => {
    const syncTimer = window.setInterval(() => {
      setTasks(loadServiceUsageTasks());
      setHistory(loadServiceUsageHistory());
      setRunningTaskKeys(loadRunningServiceUsageTaskKeys());
    }, 1000);
    return () => window.clearInterval(syncTimer);
  }, []);

  function persistTasks(nextTasks: ServiceUsageTask[]) {
    setTasks(nextTasks);
    saveServiceUsageTasks(nextTasks);
  }

  function persistHistory(nextHistory: ServiceUsageHistoryItem[]) {
    setHistory(nextHistory);
    saveServiceUsageHistory(nextHistory);
  }

  function appendHistory(item: Omit<ServiceUsageHistoryItem, "key">) {
    const nextHistory = [
      { ...item, key: `${Date.now()}-${Math.random()}` },
      ...history,
    ].slice(0, 30);
    persistHistory(nextHistory);
  }

  async function executeTask(task: ServiceUsageTask) {
    const startedAt = Date.now();
    const requestParams = buildParamsObject(task.paramsList);
    try {
      setSubmittingTaskKey(task.key);
      const response = await invokeRuntimeDataService({
        path: task.path,
        method: task.method,
        appToken: task.appToken,
        params: requestParams,
      });
      appendHistory({
        calledAt: new Date().toISOString(),
        taskKey: task.key,
        taskName: task.taskName,
        method: task.method,
        path: task.path,
        status: "成功",
        latencyMs: Date.now() - startedAt,
        message: response?.message || "调用成功",
        requestParams,
        responseData: response,
      });
      message.success(`任务「${task.taskName}」调用成功`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "调用失败";
      appendHistory({
        calledAt: new Date().toISOString(),
        taskKey: task.key,
        taskName: task.taskName,
        method: task.method,
        path: task.path,
        status: "失败",
        latencyMs: Date.now() - startedAt,
        message: errorMessage,
        requestParams,
        errorDetail: errorMessage,
      });
      message.error(errorMessage);
    } finally {
      setSubmittingTaskKey(null);
    }
  }

  async function startLoop(task: ServiceUsageTask) {
    if (runningTaskKeys.includes(task.key)) return;
    persistRunningTaskKeys([...runningTaskKeys, task.key]);
  }

  function stopLoop(taskKey: string) {
    persistRunningTaskKeys(runningTaskKeys.filter((item) => item !== taskKey));
  }

  function removeTask(taskKey: string) {
    stopLoop(taskKey);
    const nextTasks = tasks.filter((item) => item.key !== taskKey);
    if (!nextTasks.length) {
      nextTasks.push(createServiceUsageTask());
    }
    persistTasks(nextTasks);
    message.success("任务已删除");
  }

  const taskColumns: ColumnsType<ServiceUsageTask> = [
    { title: "任务名称", dataIndex: "taskName", key: "taskName", width: 180 },
    { title: "接口", key: "path", width: 240, render: (_, record) => `${record.method} ${record.path || "-"}` },
    { title: "频率", key: "callsPerMinuteRange", width: 140, render: (_, record) => formatCallsPerMinuteRange(record) },
    { title: "更新时间", dataIndex: "updatedAt", key: "updatedAt", width: 170, render: (value: string) => formatDateTime(value) },
    {
      title: "操作",
      key: "actions",
      width: 320,
      render: (_, record) => {
        const isRunning = runningTaskKeys.includes(record.key);
        return (
        <Space wrap>
          <Button icon={<EditOutlined />} onClick={() => navigate(`/dashboard/service-usage/${record.key}/edit`)}>编辑</Button>
          <Button icon={<PlayCircleOutlined />} type="primary" loading={submittingTaskKey === record.key} onClick={() => void executeTask(record)}>单次调用</Button>
          <Button icon={<ClockCircleOutlined />} onClick={() => void startLoop(record)} disabled={isRunning}>
            循环调用
          </Button>
          <Button icon={<StopOutlined />} danger onClick={() => stopLoop(record.key)} disabled={!isRunning}>停止</Button>
          <Button danger onClick={() => removeTask(record.key)}>删除</Button>
        </Space>
      );
      },
    },
  ];

  const historyColumns: ColumnsType<ServiceUsageHistoryItem> = [
    { title: "时间", dataIndex: "calledAt", key: "calledAt", width: 170, render: (value: string) => formatDateTime(value) },
    { title: "任务", dataIndex: "taskName", key: "taskName", width: 180 },
    { title: "请求", key: "request", width: 220, render: (_, record) => `${record.method} ${record.path}` },
    { title: "状态", dataIndex: "status", key: "status", width: 90, render: (value: string) => <Tag color={value === "成功" ? "success" : "error"}>{value}</Tag> },
    { title: "耗时", dataIndex: "latencyMs", key: "latencyMs", width: 100, render: (value?: number) => value ? `${value}ms` : "-" },
    { title: "说明", dataIndex: "message", key: "message", ellipsis: true },
    {
      title: "结果",
      key: "result",
      width: 120,
      render: (_, record) => (
        <Button type="link" onClick={() => setActiveHistory(record)}>
          查看结果
        </Button>
      ),
    },
  ];

  return (
    <div className="app-page">
      <div className="app-page-body">
        <PageToolbar
          left={(
            <Space>
              <Typography.Title level={4} style={{ margin: 0 }}>服务测试</Typography.Title>
              <Typography.Text type="secondary">任务清单模式管理服务调用，点击编辑进入任务配置界面。</Typography.Text>
            </Space>
          )}
          right={(
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => setTasks(loadServiceUsageTasks())}>刷新任务</Button>
              <Button onClick={() => persistHistory([])}>清空历史</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                const task = createServiceUsageTask();
                persistTasks([task, ...tasks]);
                navigate(`/dashboard/service-usage/${task.key}/edit`);
              }}>
                新建任务
              </Button>
            </Space>
          )}
        />

        {runningTaskKeys.length ? (
          <Alert
            type="info"
            showIcon
            message={`当前有 ${runningTaskKeys.length} 个任务正在循环调用：${tasks.filter((item) => runningTaskKeys.includes(item.key)).map((item) => item.taskName).join("、")}`}
          />
        ) : null}

        <Card title="任务清单">
          <Table
            rowKey="key"
            columns={taskColumns}
            dataSource={tasks}
            pagination={false}
            locale={{ emptyText: "暂无任务，请先新建调用任务。" }}
            scroll={{ x: 1200 }}
          />
        </Card>

        <Card title="调用历史">
          <Table
            rowKey="key"
            columns={historyColumns}
            dataSource={history}
            pagination={false}
            locale={{ emptyText: "尚未发起调用" }}
            scroll={{ x: 960 }}
          />
        </Card>

        <Modal
          open={Boolean(activeHistory)}
          title={activeHistory ? `${activeHistory.taskName} - 调用结果` : "调用结果"}
          footer={null}
          width={860}
          onCancel={() => setActiveHistory(null)}
          destroyOnHidden
        >
          {activeHistory ? (
            <Space direction="vertical" size={12} style={{ display: "flex" }}>
              <Typography.Text>请求时间：{formatDateTime(activeHistory.calledAt)}</Typography.Text>
              <Typography.Text>请求：{activeHistory.method} {activeHistory.path}</Typography.Text>
              <Typography.Text>状态：{activeHistory.status}</Typography.Text>
              <Typography.Text>耗时：{activeHistory.latencyMs ? `${activeHistory.latencyMs}ms` : "-"}</Typography.Text>
              <div>
                <Typography.Text strong>请求参数</Typography.Text>
                <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", overflow: "auto" }}>
                  {JSON.stringify(activeHistory.requestParams || {}, null, 2)}
                </pre>
              </div>
              <div>
                <Typography.Text strong>{activeHistory.status === "成功" ? "响应结果" : "错误信息"}</Typography.Text>
                <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", overflow: "auto" }}>
                  {activeHistory.status === "成功"
                    ? JSON.stringify(activeHistory.responseData ?? {}, null, 2)
                    : (activeHistory.errorDetail || activeHistory.message)}
                </pre>
              </div>
            </Space>
          ) : null}
        </Modal>
      </div>
    </div>
  );
}
