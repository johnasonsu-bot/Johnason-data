import {
  CalendarOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Button, Input, Popconfirm, Select, Space, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { DataTableCard } from "../../components/ui/DataTableCard";
import { PageToolbar } from "../../components/ui/PageToolbar";
import { StatusTag } from "../../components/ui/StatusTag";
import {
  createDevWorkflowFromTask,
  deleteDevScript,
  executeDevQuery,
  fetchDevDatasources,
  fetchDevQueryHistory,
  fetchDevScripts,
} from "../../services/dataDevelopment";
import type { DevDatasourceRecord, DevQueryHistoryRecord, DevScriptRecord } from "../../types/api";
import { formatDateTime } from "./helpers";
import { splitSqlStatements } from "./sqlTaskUtils";

export function DataDevelopmentSqlTasksPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [datasourceFilter, setDatasourceFilter] = useState<number | undefined>();
  const [datasources, setDatasources] = useState<DevDatasourceRecord[]>([]);
  const [tasks, setTasks] = useState<DevScriptRecord[]>([]);
  const [histories, setHistories] = useState<DevQueryHistoryRecord[]>([]);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [creatingScheduleId, setCreatingScheduleId] = useState<number | null>(null);

  async function loadList() {
    if (!token) return;
    setLoading(true);
    try {
      const [datasourceRes, taskRes, historyRes] = await Promise.all([
        fetchDevDatasources(token),
        fetchDevScripts(token),
        fetchDevQueryHistory(token, { limit: 200 }),
      ]);
      setDatasources(datasourceRes.data || []);
      setTasks(taskRes.data || []);
      setHistories(historyRes.data || []);
    } catch (error: any) {
      message.error(error.message || "加载SQL任务列表失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadList();
  }, [token]);

  const filteredTasks = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return tasks.filter((task) => {
      if (datasourceFilter && task.datasourceId !== datasourceFilter) return false;
      if (!normalizedKeyword) return true;
      return `${task.name} ${task.description || ""} ${task.datasourceName} ${task.defaultDatabase || ""}`
        .toLowerCase()
        .includes(normalizedKeyword);
    });
  }, [datasourceFilter, keyword, tasks]);

  const latestHistoryByTask = useMemo(() => {
    const result = new Map<number, DevQueryHistoryRecord>();
    histories.forEach((history) => {
      if (history.scriptId && !result.has(history.scriptId)) result.set(history.scriptId, history);
    });
    return result;
  }, [histories]);

  async function handleRun(task: DevScriptRecord) {
    if (!token) return;
    const statements = splitSqlStatements(task.content);
    if (!statements.length) {
      message.warning("当前SQL任务没有可执行内容");
      return;
    }

    setRunningId(task.id);
    try {
      for (const sqlText of statements) {
        const response = await executeDevQuery(token, {
          datasourceId: task.datasourceId,
          scriptId: task.id,
          sqlText,
          databaseName: task.defaultDatabase,
          resultLimit: 200,
        });
        if (response.data.status === "failed") {
          throw new Error(response.data.errorMessage || "SQL任务执行失败");
        }
      }
      message.success("SQL任务执行成功");
    } catch (error: any) {
      message.error(error.message || "SQL任务执行失败");
    } finally {
      setRunningId(null);
      try {
        const historyRes = await fetchDevQueryHistory(token, { limit: 200 });
        setHistories(historyRes.data || []);
      } catch {
        // 任务执行结果已经提示，历史刷新失败时保留当前列表状态。
      }
    }
  }

  async function handleCreateSchedule(task: DevScriptRecord) {
    if (!token) return;
    setCreatingScheduleId(task.id);
    try {
      const response = await createDevWorkflowFromTask(token, { taskType: "script", taskId: task.id });
      message.success("调度工作流已创建");
      navigate(`/dashboard/data-development/scheduling/${response.data.id}/edit`);
    } catch (error: any) {
      message.error(error.message || "创建调度工作流失败");
    } finally {
      setCreatingScheduleId(null);
    }
  }

  async function handleDelete(task: DevScriptRecord) {
    if (!token) return;
    try {
      await deleteDevScript(token, task.id);
      message.success("SQL任务已删除");
      await loadList();
    } catch (error: any) {
      message.error(error.message || "删除SQL任务失败");
    }
  }

  const columns: ColumnsType<DevScriptRecord> = [
    {
      title: "任务名称",
      dataIndex: "name",
      width: 220,
      render: (value, record) => (
        <div style={{ minWidth: 0 }}>
          <Typography.Text strong>{value}</Typography.Text>
          {record.description ? (
            <Typography.Text type="secondary" ellipsis style={{ display: "block", maxWidth: 210 }}>
              {record.description}
            </Typography.Text>
          ) : null}
        </div>
      ),
    },
    { title: "数据源", dataIndex: "datasourceName", width: 180 },
    { title: "默认数据库", dataIndex: "defaultDatabase", width: 180, render: (value) => value || "-" },
    { title: "当前版本", dataIndex: "currentVersion", width: 100, render: (value) => `V${value || 1}` },
    {
      title: "标签",
      dataIndex: "tags",
      width: 180,
      render: (values: string[]) => values?.length ? values.map((value) => <Tag key={value}>{value}</Tag>) : "-",
    },
    {
      title: "状态",
      key: "status",
      width: 100,
      render: (_, record) => {
        const latestHistory = latestHistoryByTask.get(record.id);
        if (!latestHistory) return <StatusTag label="未运行" tone="default" />;
        return latestHistory.status === "success"
          ? <StatusTag label="成功" tone="success" />
          : <StatusTag label="失败" tone="error" />;
      },
    },
    {
      title: "最近运行",
      key: "lastRunAt",
      width: 180,
      render: (_, record) => formatDateTime(latestHistoryByTask.get(record.id)?.executedAt),
    },
    {
      title: "操作",
      key: "actions",
      width: 330,
      render: (_, record) => (
        <Space size={4}>
          <Button type="link" onClick={() => navigate(`/dashboard/data-development/workbench2?scriptId=${record.id}`)}>
            分析
          </Button>
          <Button
            type="link"
            icon={<PlayCircleOutlined />}
            loading={runningId === record.id}
            onClick={() => void handleRun(record)}
          >
            运行
          </Button>
          <Button
            type="link"
            icon={<CalendarOutlined />}
            loading={creatingScheduleId === record.id}
            onClick={() => void handleCreateSchedule(record)}
          >
            创建调度
          </Button>
          <Popconfirm
            title={`确认删除SQL任务“${record.name}”？`}
            description="删除后不可恢复。"
            okText="删除"
            cancelText="取消"
            onConfirm={() => void handleDelete(record)}
          >
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
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索任务名称/数据源/数据库"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              style={{ width: 320 }}
            />
            <Select
              allowClear
              placeholder="筛选数据源"
              style={{ width: 220 }}
              options={datasources.map((item) => ({ value: item.id, label: item.name }))}
              value={datasourceFilter}
              onChange={setDatasourceFilter}
            />
          </>
        )}
        right={(
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void loadList()} loading={loading}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/dashboard/data-development/workbench2")}>
              新建SQL任务
            </Button>
          </Space>
        )}
      />

      <div className="app-page-body">
        <DataTableCard<DevScriptRecord>
          title="SQL任务"
          tableProps={{
            rowKey: "id",
            loading,
            columns,
            dataSource: filteredTasks,
            pagination: { pageSize: 10, showSizeChanger: true },
            scroll: { x: 1500 },
          }}
        />
      </div>
    </div>
  );
}
