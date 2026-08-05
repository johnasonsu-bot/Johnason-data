import { Card, Space, Table, Tag } from "antd";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { fetchOperationLogs, fetchRunLogs } from "../../services/dataLab";
import type { LabOperationLogRecord, LabRunLogRecord } from "../../types/api";

const RUN_TYPE_LABELS: Record<string, string> = {
  INIT: "初始化",
  INCR: "增量",
  REALTIME: "实时",
  BACKFILL: "补数",
};

const RUN_STATUS_META: Record<string, { label: string; color: string }> = {
  SUCCESS: { label: "成功", color: "success" },
  FAILED: { label: "失败", color: "error" },
  RUNNING: { label: "运行中", color: "processing" },
  PENDING: { label: "排队中", color: "default" },
};

function formatDateTime(value?: string | null) {
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
      }}
    >
      {text}
    </span>
  );
}

function renderRunStatus(status: string) {
  const meta = RUN_STATUS_META[status] || { label: status || "-", color: "default" };
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

export function DataLabRunLogPage() {
  const { token } = useAuth();
  const { id } = useParams();
  const [logs, setLogs] = useState<LabRunLogRecord[]>([]);
  const [operations, setOperations] = useState<LabOperationLogRecord[]>([]);

  async function load() {
    if (!token || !id) return;
    const [runResp, opResp] = await Promise.all([fetchRunLogs(token, Number(id)), fetchOperationLogs(token, Number(id))]);
    setLogs(runResp.data);
    setOperations(opResp.data);
  }

  useEffect(() => {
    void load();
  }, [token, id]);

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <Card bordered={false} title="运行记录">
        <Table
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10, size: "small" }}
          dataSource={logs}
          columns={[
            {
              title: "类型",
              dataIndex: "runType",
              width: 90,
              render: (value: string) => RUN_TYPE_LABELS[value] || value || "-",
            },
            {
              title: "状态",
              dataIndex: "runStatus",
              width: 100,
              render: (value: string) => renderRunStatus(value),
            },
            {
              title: "开始时间",
              dataIndex: "startTime",
              width: 170,
              render: (value: string) => formatDateTime(value),
            },
            {
              title: "结束时间",
              dataIndex: "endTime",
              width: 170,
              render: (value: string) => formatDateTime(value),
            },
            {
              title: "记录数",
              dataIndex: "recordsCount",
              width: 100,
              align: "center",
            },
            {
              title: "耗时",
              dataIndex: "durationMs",
              width: 100,
              align: "center",
              render: (value: number) => (value ? `${value} ms` : "-"),
            },
            {
              title: "错误信息",
              dataIndex: "errorMessage",
              render: (value: string) => renderEllipsisText(value),
            },
          ]}
        />
      </Card>
      <Card bordered={false} title="操作日志">
        <Table
          rowKey="id"
          size="small"
          pagination={{ pageSize: 8, size: "small" }}
          dataSource={operations}
          columns={[
            {
              title: "操作类型",
              dataIndex: "operationType",
              width: 180,
              render: (value: string) => renderEllipsisText(value),
            },
            {
              title: "操作人",
              dataIndex: "operatorName",
              width: 120,
            },
            {
              title: "结果摘要",
              dataIndex: "resultSummary",
              render: (value: string) => renderEllipsisText(value),
            },
            {
              title: "时间",
              dataIndex: "createdAt",
              width: 170,
              render: (value: string) => formatDateTime(value),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
