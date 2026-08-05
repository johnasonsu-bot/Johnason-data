import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { DeleteOutlined, EditOutlined, EyeOutlined, PlayCircleOutlined, StopOutlined, UploadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  cancelFileImportRun,
  deleteFileImportTask,
  fetchFileImportRunErrors,
  fetchFileImportRuns,
  fetchFileImportTaskById,
  fetchFileImportTasks,
  runFileImportTask,
} from "../../services/fileImport";
import type { FileImportRun, FileImportRunError, FileImportTask } from "../../types/api";

const AUTO_REFRESH_INTERVAL_MS = 10000;

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("zh-CN", { hour12: false });
}

function renderStatus(status?: string) {
  const map: Record<string, { color: string; label: string }> = {
    draft: { color: "default", label: "草稿" },
    completed: { color: "green", label: "完成" },
    failed: { color: "red", label: "失败" },
    running: { color: "blue", label: "运行中" },
    cancelling: { color: "orange", label: "终止中" },
    cancelled: { color: "default", label: "已终止" },
  };
  const current = map[String(status || "").toLowerCase()] || { color: "default", label: status || "-" };
  return <Tag color={current.color}>{current.label}</Tag>;
}

function isRunningStatus(status?: string | null) {
  return ["running", "cancelling"].includes(String(status || "").toLowerCase());
}

function getRunMetric(run: FileImportRun, key: string) {
  const value = Number(run.executionInfo?.[key]);
  return Number.isFinite(value) ? value : null;
}

function getProcessedRows(run: FileImportRun) {
  return getRunMetric(run, "processedRows") ?? Math.min(run.totalRows, run.successRows + run.skippedRows);
}

function getElapsedSeconds(run: FileImportRun) {
  const recorded = getRunMetric(run, "elapsedSeconds");
  if (recorded !== null) return recorded;
  if (!run.startTime) return 0;
  const startTime = new Date(run.startTime).getTime();
  const endTime = run.endTime ? new Date(run.endTime).getTime() : Date.now();
  return Number.isFinite(startTime) && Number.isFinite(endTime) ? Math.max(0, (endTime - startTime) / 1000) : 0;
}

function formatDuration(seconds: number) {
  const normalized = Math.max(0, Math.round(seconds));
  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);
  const remainingSeconds = normalized % 60;
  if (hours > 0) return `${hours}时${minutes}分${remainingSeconds}秒`;
  if (minutes > 0) return `${minutes}分${remainingSeconds}秒`;
  return `${remainingSeconds}秒`;
}

function formatRowsPerSecond(run: FileImportRun) {
  const processedRows = getProcessedRows(run);
  const elapsedSeconds = getElapsedSeconds(run);
  const speed = getRunMetric(run, "rowsPerSecond") ?? (elapsedSeconds > 0 ? processedRows / elapsedSeconds : 0);
  return `${Math.max(0, speed).toLocaleString("zh-CN", { maximumFractionDigits: 2 })} 行/秒`;
}

export function FileImportTasksPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<FileImportTask[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<FileImportTask | null>(null);
  const [runs, setRuns] = useState<FileImportRun[]>([]);
  const [runErrors, setRunErrors] = useState<FileImportRunError[]>([]);
  const [runErrorsLoading, setRunErrorsLoading] = useState(false);
  const [runErrorTotal, setRunErrorTotal] = useState(0);
  const [runErrorPage, setRunErrorPage] = useState(1);
  const [runErrorPageSize, setRunErrorPageSize] = useState(10);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const hasRunningTask = tasks.some((item) => isRunningStatus(item.status) || isRunningStatus(item.lastRun?.runStatus));
  const hasRunningRun = runs.some((item) => isRunningStatus(item.runStatus));

  async function loadTasks(nextPage = page, nextPageSize = pageSize, nextKeyword = keyword, options?: { silent?: boolean }) {
    if (!token) return;
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const response = await fetchFileImportTasks(token, {
        page: nextPage,
        pageSize: nextPageSize,
        keyword: nextKeyword || undefined,
      });
      setTasks(response.data || []);
      setTotal(Number(response.meta?.total || 0));
      setPage(nextPage);
      setPageSize(nextPageSize);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载文件上传任务失败");
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadTasks(1, pageSize, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token || !hasRunningTask) return;
    const timer = window.setInterval(() => {
      void loadTasks(page, pageSize, keyword, { silent: true });
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, hasRunningTask, page, pageSize, keyword]);

  async function refreshDetail(taskId: number) {
    if (!token) return;
    try {
      const [taskResponse, runsResponse] = await Promise.all([
        fetchFileImportTaskById(token, taskId),
        fetchFileImportRuns(token, taskId, 20),
      ]);
      setDetailTask(taskResponse.data);
      setRuns(runsResponse.data || []);
    } catch (error) {
      console.warn("自动刷新文件上传任务状态失败", error);
    }
  }

  useEffect(() => {
    if (!token || !detailOpen || !detailTask?.id || !hasRunningRun) return;
    const timer = window.setInterval(() => {
      void refreshDetail(detailTask.id);
      void loadTasks(page, pageSize, keyword, { silent: true });
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, detailOpen, detailTask?.id, hasRunningRun, page, pageSize, keyword]);

  async function openDetail(taskId: number) {
    if (!token) return;
    setLoading(true);
    try {
      const [taskResponse, runsResponse] = await Promise.all([
        fetchFileImportTaskById(token, taskId),
        fetchFileImportRuns(token, taskId, 20),
      ]);
      const currentTask = taskResponse.data;
      const currentRuns = runsResponse.data || [];
      setDetailTask(currentTask);
      setRuns(currentRuns);
      setRunErrors([]);
      setRunErrorTotal(0);
      setRunErrorPage(1);
      setRunErrorPageSize(10);
      setActiveRunId(null);
      setDetailOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载任务详情失败");
    } finally {
      setLoading(false);
    }
  }

  async function openRunErrors(taskId: number, runId: number, nextPage = 1, nextPageSize = runErrorPageSize) {
    if (!token) return;
    setRunErrorsLoading(true);
    try {
      const response = await fetchFileImportRunErrors(token, taskId, runId, {
        page: nextPage,
        pageSize: nextPageSize,
      });
      setRunErrors(response.data || []);
      setRunErrorTotal(Number(response.meta?.total || 0));
      setRunErrorPage(Number(response.meta?.page || nextPage));
      setRunErrorPageSize(Number(response.meta?.pageSize || nextPageSize));
      setActiveRunId(runId);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载错误明细失败");
    } finally {
      setRunErrorsLoading(false);
    }
  }

  async function cancelRun(taskId: number, runId: number) {
    if (!token) return;
    try {
      await cancelFileImportRun(token, taskId, runId);
      message.success("已提交终止请求");
      await Promise.all([
        loadTasks(page, pageSize, keyword, { silent: true }),
        detailOpen && detailTask?.id === taskId ? refreshDetail(taskId) : Promise.resolve(),
      ]);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "终止任务失败");
    }
  }

  const columns: ColumnsType<FileImportTask> = [
    { title: "任务名称", dataIndex: "taskName", width: 220, fixed: "left" },
    { title: "任务编码", dataIndex: "taskCode", width: 220 },
    { title: "目标数据源", dataIndex: "targetSourceName", width: 180, render: (value) => value || "-" },
    { title: "目标表", dataIndex: "targetTable", width: 180 },
    {
      title: "写入方式",
      dataIndex: "writeMode",
      width: 120,
      render: (value) => (value === "overwrite" ? "覆盖" : "追加"),
    },
    {
      title: "最近运行",
      width: 160,
      render: (_, record) => renderStatus(record.lastRun?.runStatus || record.status),
    },
    {
      title: "最近时间",
      width: 180,
      render: (_, record) => formatDateTime(record.lastRun?.createdAt || record.updatedAt),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 280,
      render: (_, record) => (
        <Space size={4}>
          <Button type="link" icon={<EyeOutlined />} onClick={() => void openDetail(record.id)}>
            查看
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => navigate(`/dashboard/data-file-imports/${record.id}/edit`)}>
            编辑
          </Button>
          <Button
            type="link"
            icon={<PlayCircleOutlined />}
            onClick={async () => {
              if (!token) return;
              try {
                message.success("任务已开始执行");
                const runningRequest = runFileImportTask(token, record.id);
                window.setTimeout(() => void loadTasks(page, pageSize, keyword, { silent: true }), 500);
                await runningRequest;
                void loadTasks();
              } catch (error) {
                message.error(error instanceof Error ? error.message : "执行任务失败");
              }
            }}
          >
            执行
          </Button>
          {record.lastRun && isRunningStatus(record.lastRun.runStatus) ? (
            <Popconfirm
              title="确认终止当前运行？"
              description="已写入目标表的数据将保留。"
              onConfirm={() => void cancelRun(record.id, record.lastRun!.id)}
            >
              <Button type="link" danger icon={<StopOutlined />}>终止</Button>
            </Popconfirm>
          ) : null}
          <Popconfirm
            title="确认删除该文件上传任务？"
            onConfirm={async () => {
              if (!token) return;
              try {
                await deleteFileImportTask(token, record.id);
                message.success("任务已删除");
                void loadTasks();
              } catch (error) {
                message.error(error instanceof Error ? error.message : "删除任务失败");
              }
            }}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <Card bordered={false}>
        <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
          <Space>
            <Input.Search
              placeholder="搜索任务名 / 编码 / 目标表"
              allowClear
              style={{ width: 320 }}
              onSearch={(value) => {
                setKeyword(value);
                void loadTasks(1, pageSize, value);
              }}
            />
          </Space>
          <Button type="primary" icon={<UploadOutlined />} onClick={() => navigate("/dashboard/data-file-imports/create")}>
            新建上传任务
          </Button>
        </Space>
      </Card>

      <Card bordered={false}>
        <Table<FileImportTask>
          rowKey="id"
          loading={loading}
          dataSource={tasks}
          columns={columns}
          scroll={{ x: 1280 }}
          pagination={{
            total,
            current: page,
            pageSize,
            showSizeChanger: true,
            onChange: (nextPage, nextPageSize) => {
              void loadTasks(nextPage, nextPageSize, keyword);
            },
          }}
        />
      </Card>

      <Drawer
        title={detailTask ? `任务详情 - ${detailTask.taskName}` : "任务详情"}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={960}
      >
        {detailTask ? (
          <Space direction="vertical" size={16} style={{ display: "flex" }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="任务编码">{detailTask.taskCode}</Descriptions.Item>
              <Descriptions.Item label="目标数据源">{detailTask.targetSourceName || "-"}</Descriptions.Item>
              <Descriptions.Item label="目标表">{detailTask.targetTable}</Descriptions.Item>
              <Descriptions.Item label="写入方式">{detailTask.writeMode === "overwrite" ? "覆盖" : "追加"}</Descriptions.Item>
              <Descriptions.Item label="表模式">{detailTask.targetTableMode === "existing" ? "已有表" : "自动建表"}</Descriptions.Item>
              <Descriptions.Item label="任务状态">{renderStatus(detailTask.status)}</Descriptions.Item>
              <Descriptions.Item label="任务说明" span={2}>{detailTask.description || "-"}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="文件清单">
              <Table
                rowKey="id"
                pagination={false}
                dataSource={detailTask.files || []}
                columns={[
                  { title: "文件名", dataIndex: "fileName" },
                  { title: "类型", dataIndex: "fileExt", width: 100 },
                  { title: "大小", dataIndex: "fileSize", width: 140, render: (value) => `${Math.round(Number(value || 0) / 1024)} KB` },
                  { title: "Sheet", dataIndex: "sheetName", width: 180, render: (value) => value || "-" },
                ]}
              />
            </Card>

            <Card size="small" title="字段映射">
              <Table
                rowKey={(record) => `${record.sourceField}-${record.targetField}`}
                pagination={false}
                dataSource={detailTask.fieldMappings || []}
                columns={[
                  { title: "来源字段", dataIndex: "sourceField", width: 180 },
                  { title: "目标字段", dataIndex: "targetField", width: 180 },
                  { title: "类型", dataIndex: "dataType", width: 160 },
                  { title: "启用", dataIndex: "enabled", width: 80, render: (value) => (value ? "是" : "否") },
                  { title: "说明", dataIndex: "columnComment" },
                ]}
                scroll={{ x: 900 }}
              />
            </Card>

            <Card size="small" title="运行记录" extra={hasRunningRun ? <Tag color="processing">每 10 秒自动刷新</Tag> : null}>
              <Table<FileImportRun>
                rowKey="id"
                pagination={false}
                dataSource={runs}
                columns={[
                  { title: "运行ID", dataIndex: "id", width: 90 },
                  { title: "状态", dataIndex: "runStatus", width: 100, render: (value) => renderStatus(value) },
                  { title: "开始时间", dataIndex: "startTime", width: 180, render: formatDateTime },
                  { title: "结束时间", dataIndex: "endTime", width: 180, render: formatDateTime },
                  {
                    title: "进度",
                    width: 180,
                    render: (_, record) => {
                      const processedRows = getProcessedRows(record);
                      const percent = record.totalRows > 0 ? Math.min(100, (processedRows / record.totalRows) * 100) : 0;
                      return `${processedRows.toLocaleString("zh-CN")} / ${record.totalRows.toLocaleString("zh-CN")}（${percent.toFixed(2)}%）`;
                    },
                  },
                  { title: "成功", dataIndex: "successRows", width: 100 },
                  { title: "错误/跳过", width: 140, render: (_, record) => `${record.errorRows}/${record.skippedRows}` },
                  { title: "执行速度", width: 140, render: (_, record) => formatRowsPerSecond(record) },
                  { title: "耗时", width: 120, render: (_, record) => formatDuration(getElapsedSeconds(record)) },
                  {
                    title: "错误详情",
                    width: 100,
                    render: (_, record) => (
                      <Button type="link" disabled={!record.errorRows} onClick={() => void openRunErrors(detailTask.id, record.id)}>
                        查看
                      </Button>
                    ),
                  },
                  {
                    title: "操作",
                    width: 100,
                    render: (_, record) => isRunningStatus(record.runStatus) ? (
                      <Popconfirm
                        title="确认终止当前运行？"
                        description="已写入目标表的数据将保留。"
                        onConfirm={() => void cancelRun(detailTask.id, record.id)}
                      >
                        <Button type="link" danger icon={<StopOutlined />}>终止</Button>
                      </Popconfirm>
                    ) : "-",
                  },
                ]}
                scroll={{ x: 1500 }}
              />
            </Card>

            <Card size="small" title={activeRunId ? `错误明细 - Run ${activeRunId}` : "错误明细"}>
              <Table<FileImportRunError>
                rowKey="id"
                loading={runErrorsLoading}
                pagination={activeRunId ? {
                  total: runErrorTotal,
                  current: runErrorPage,
                  pageSize: runErrorPageSize,
                  showSizeChanger: true,
                  showTotal: (currentTotal) => `共 ${currentTotal} 条`,
                  onChange: (nextPage, nextPageSize) => {
                    void openRunErrors(detailTask.id, activeRunId, nextPage, nextPageSize);
                  },
                } : false}
                dataSource={runErrors}
                locale={{ emptyText: activeRunId ? "该运行暂无错误明细" : "请选择一条运行记录查看错误" }}
                columns={[
                  { title: "文件", dataIndex: "fileName", width: 180 },
                  { title: "Sheet", dataIndex: "sheetName", width: 140, render: (value) => value || "-" },
                  { title: "行号", dataIndex: "rowNo", width: 90, render: (value) => value || "-" },
                  { title: "字段", dataIndex: "columnName", width: 160, render: (value) => value || "-" },
                  { title: "类型", dataIndex: "errorType", width: 100 },
                  { title: "错误信息", dataIndex: "errorMessage", width: 420, ellipsis: true },
                ]}
                scroll={{ x: 1100 }}
              />
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </Space>
  );
}
