import { Button, Card, Input, Popconfirm, Select, Space, Table, Tag, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { deleteScene, fetchScenes, initScene, startSceneTask, stopSceneTask } from "../../services/dataLab";
import type { LabSceneRecord } from "../../types/api";

const STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "草稿", color: "default" },
  READY: { label: "就绪", color: "blue" },
  RUNNING: { label: "运行中", color: "green" },
  PAUSED: { label: "已暂停", color: "gold" },
  ERROR: { label: "异常", color: "red" },
  SCHEMA_PENDING_CONFIRM: { label: "逻辑模型待确认", color: "orange" },
  STRATEGY_PENDING_CONFIRM: { label: "生成配置待确认", color: "cyan" },
  SCHEMA_CONFIRMED: { label: "逻辑模型已确认", color: "processing" },
};

function formatLastRunTime(value?: string | null) {
  if (!value) return "-";
  return String(value).trim().replace("T", " ").replace(/\.\d+Z?$/, "") || "-";
}

function renderEllipsisText(value?: string | null) {
  const text = value || "-";
  return (
    <span
      title={text}
      style={{
        display: "block",
        width: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        verticalAlign: "bottom",
      }}
    >
      {text}
    </span>
  );
}

function renderStatus(status: string) {
  const meta = STATUS_META[status] || { label: status || "-", color: "default" };
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function ActionLink(props: { children: React.ReactNode; loading?: boolean; onClick: () => void }) {
  return (
    <Button
      type="link"
      size="small"
      loading={props.loading}
      onClick={props.onClick}
      style={{ paddingInline: 2, height: 24, fontSize: 13 }}
    >
      {props.children}
    </Button>
  );
}

export function DataLabSceneListPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<LabSceneRecord[]>([]);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);

  async function load() {
    if (!token) return;
    const response = await fetchScenes(token);
    setRecords(response.data);
    setSelectedRowKeys((current) => current.filter((sceneId) => response.data.some((item) => item.id === sceneId)));
  }

  useEffect(() => {
    void load();
  }, [token]);

  const filtered = useMemo(
    () =>
      records.filter((item) => {
        const matchKeyword =
          !keyword ||
          item.sceneName.includes(keyword) ||
          item.sceneCode.includes(keyword) ||
          (item.sceneDesc || "").includes(keyword) ||
          (item.industryKbName || "").includes(keyword);
        const matchStatus = !status || item.status === status;
        return matchKeyword && matchStatus;
      }),
    [records, keyword, status]
  );

  async function handleInit(record: LabSceneRecord) {
    if (!token) return;
    const key = `init-${record.id}`;
    try {
      setActionKey(key);
      await initScene(token, record.id);
      await load();
      message.success(`场景 ${record.sceneName} 已清空历史数据并完成全量重载`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "数据重载失败");
    } finally {
      setActionKey(null);
    }
  }

  async function handleToggleTask(record: LabSceneRecord) {
    if (!token) return;
    const key = `task-${record.id}`;
    try {
      setActionKey(key);
      if (record.taskEnabled) {
        await stopSceneTask(token, record.id);
        message.success(`场景 ${record.sceneName} 已暂停任务`);
      } else {
        await startSceneTask(token, record.id);
        message.success(`场景 ${record.sceneName} 已启动任务，并自动补齐首轮执行`);
      }
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : record.taskEnabled ? "暂停任务失败" : "启动任务失败");
    } finally {
      setActionKey(null);
    }
  }

  async function handleDelete(ids: number[], names: string[]) {
    if (!token || ids.length === 0) return;
    const key = ids.length === 1 ? `delete-${ids[0]}` : "delete-batch";
    try {
      setActionKey(key);
      const results = await Promise.allSettled(ids.map((sceneId) => deleteScene(token, sceneId)));
      const failed = results.filter((item): item is PromiseRejectedResult => item.status === "rejected");
      const successCount = results.length - failed.length;

      if (successCount > 0) {
        await load();
        setSelectedRowKeys((current) => current.filter((sceneId) => !ids.includes(sceneId)));
      }

      if (failed.length === 0) {
        message.success(ids.length === 1 ? `场景 ${names[0]} 已删除` : `已删除 ${successCount} 个场景`);
        return;
      }

      if (successCount > 0) {
        message.warning(`已删除 ${successCount} 个场景，${failed.length} 个删除失败`);
        return;
      }

      const firstError = failed[0]?.reason;
      message.error(firstError instanceof Error ? firstError.message : "删除场景失败");
    } finally {
      setActionKey(null);
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <Card bordered={false}>
        <Space>
          <Input
            placeholder="搜索场景名称、描述或行业知识库"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ width: 320 }}
          />
          <Select
            allowClear
            placeholder="状态筛选"
            value={status}
            onChange={setStatus}
            style={{ width: 180 }}
            options={[
              { label: "草稿", value: "DRAFT" },
              { label: "就绪", value: "READY" },
              { label: "运行中", value: "RUNNING" },
              { label: "已暂停", value: "PAUSED" },
              { label: "异常", value: "ERROR" },
              { label: "逻辑模型待确认", value: "SCHEMA_PENDING_CONFIRM" },
              { label: "生成配置待确认", value: "STRATEGY_PENDING_CONFIRM" },
            ]}
          />
          <Popconfirm
            title={`确认删除选中的 ${selectedRowKeys.length} 个场景？`}
            disabled={selectedRowKeys.length === 0}
            onConfirm={() => {
              const selectedRecords = records.filter((item) => selectedRowKeys.includes(item.id));
              void handleDelete(
                selectedRecords.map((item) => item.id),
                selectedRecords.map((item) => item.sceneName)
              );
            }}
          >
            <Button danger disabled={selectedRowKeys.length === 0} loading={actionKey === "delete-batch"}>
              删除所选{selectedRowKeys.length > 0 ? ` (${selectedRowKeys.length})` : ""}
            </Button>
          </Popconfirm>
          <Button onClick={() => navigate("/dashboard/data-modeling/scene-editor")}>新建场景</Button>
        </Space>
      </Card>

      <Card bordered={false}>
        <Table
          rowKey="id"
          dataSource={filtered}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys.map((key) => Number(key))),
          }}
          tableLayout="fixed"
          size="small"
          pagination={{ pageSize: 10, size: "small" }}
          columns={[
            { title: "场景名称", dataIndex: "sceneName", width: "14%", render: (value: string) => renderEllipsisText(value) },
            { title: "场景描述", dataIndex: "sceneDesc", width: "18%", render: (value: string) => renderEllipsisText(value) },
            { title: "行业知识库", dataIndex: "industryKbName", width: "12%", render: (value: string) => renderEllipsisText(value || "-") },
            { title: "状态", dataIndex: "status", width: "9%", render: (value: string) => renderStatus(value) },
            { title: "表数量", dataIndex: "tableCount", width: "7%", align: "center" as const },
            { title: "增量规模", dataIndex: "incrVolume", width: "8%", align: "center" as const },
            { title: "总数据量", dataIndex: "totalDataCount", width: "9%", align: "center" as const },
            { title: "最近运行时间", dataIndex: "lastRunTime", width: "13%", render: (value: string) => renderEllipsisText(formatLastRunTime(value)) },
            {
              title: "操作",
              width: "16%",
              render: (_: unknown, record: LabSceneRecord) => (
                <div style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                  <ActionLink onClick={() => navigate(`/dashboard/data-modeling/scene-editor/${record.id}`)}>编辑</ActionLink>
                  <ActionLink loading={actionKey === `init-${record.id}`} onClick={() => void handleInit(record)}>重载</ActionLink>
                  <ActionLink loading={actionKey === `task-${record.id}`} onClick={() => void handleToggleTask(record)}>
                    {record.taskEnabled ? "暂停" : "启动"}
                  </ActionLink>
                  <ActionLink onClick={() => navigate(`/dashboard/data-modeling/result-query/${record.id}`)}>查询</ActionLink>
                  <ActionLink onClick={() => navigate(`/dashboard/data-modeling/run-log/${record.id}`)}>日志</ActionLink>
                  <Popconfirm
                    title={`确认删除场景 ${record.sceneName}？`}
                    onConfirm={() => void handleDelete([record.id], [record.sceneName])}
                  >
                    <Button
                      type="link"
                      size="small"
                      danger
                      loading={actionKey === `delete-${record.id}`}
                      style={{ paddingInline: 2, height: 24, fontSize: 13 }}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
