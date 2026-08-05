import { Alert, Button, Card, Col, Drawer, List, Row, Select, Space, Table, Tag, message } from "antd";
import { useEffect, useState } from "react";
import { fetchDevInstanceLogs, fetchDevInstances, fetchDevWorkflowRuns } from "../../../services/dataDevelopment";
import type { DevJobInstanceRecord, DevJobLogRecord, DevWorkflowRecord, DevWorkflowRunRecord } from "../../../types/api";
import { formatDateTime, formatWorkflowLogType, formatWorkflowStatus, formatWorkflowTriggerType } from "../helpers";

interface InstanceMonitorProps {
  token: string;
  workflows: DevWorkflowRecord[];
  selectedWorkflowId?: number;
  onSelectWorkflow: (id: number | undefined) => void;
}

export function InstanceMonitor({ token, workflows, selectedWorkflowId, onSelectWorkflow }: InstanceMonitorProps) {
  const [runs, setRuns] = useState<DevWorkflowRunRecord[]>([]);
  const [instances, setInstances] = useState<DevJobInstanceRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | undefined>(undefined);
  const [logDrawerOpen, setLogDrawerOpen] = useState(false);
  const [logs, setLogs] = useState<DevJobLogRecord[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<DevJobInstanceRecord | null>(null);

  async function loadWorkflowRuns(workflowId: number) {
    try {
      const res = await fetchDevWorkflowRuns(token, workflowId);
      setRuns(res.data);
      if (res.data[0]) {
        await loadRunInstances(res.data[0].id);
      } else {
        setSelectedRunId(undefined);
        setInstances([]);
      }
    } catch (error: any) {
      message.error(error.message || "加载工作流运行记录失败");
      setRuns([]);
      setSelectedRunId(undefined);
      setInstances([]);
    }
  }

  async function loadRunInstances(runId: number) {
    setSelectedRunId(runId);
    const res = await fetchDevInstances(token, { workflowRunId: runId });
    setInstances(res.data);
  }

  async function openLogs(record: DevJobInstanceRecord) {
    setSelectedInstance(record);
    const res = await fetchDevInstanceLogs(token, record.id);
    setLogs(res.data);
    setLogDrawerOpen(true);
  }

  useEffect(() => {
    if (selectedWorkflowId) {
      void loadWorkflowRuns(selectedWorkflowId);
      return;
    }
    setRuns([]);
    setSelectedRunId(undefined);
    setInstances([]);
  }, [token, selectedWorkflowId]);

  return (
    <Row gutter={16}>
      <Col span={10}>
        <Card title="工作流运行记录">
          <Space direction="vertical" size={12} style={{ display: "flex" }}>
            <Select
              placeholder="选择工作流"
              value={selectedWorkflowId}
              onChange={onSelectWorkflow}
              options={workflows.map((item) => ({ value: item.id, label: item.name }))}
            />
            <Table
              rowKey="id"
              dataSource={runs}
              pagination={{ pageSize: 6 }}
              columns={[
                { title: "触发方式", dataIndex: "triggerType", render: formatWorkflowTriggerType },
                {
                  title: "状态",
                  dataIndex: "status",
                  render: (value: string) => (
                    <Tag color={value === "failed" ? "error" : value === "success" ? "success" : "processing"}>
                      {formatWorkflowStatus(value)}
                    </Tag>
                  ),
                },
                { title: "开始时间", dataIndex: "startedAt", render: formatDateTime },
                { title: "操作", render: (_, record) => <Button type="link" onClick={() => void loadRunInstances(record.id)}>查看实例</Button> },
              ]}
            />
          </Space>
        </Card>
      </Col>
      <Col span={14}>
        <Card title={`节点实例${selectedRunId ? ` · 运行 #${selectedRunId}` : ""}`}>
          <Table
            rowKey="id"
            dataSource={instances}
            pagination={{ pageSize: 8 }}
            columns={[
              { title: "节点", dataIndex: "workflowNodeName" },
              {
                title: "绑定任务",
                render: (_, record) => record.scriptName || record.processingJobName || record.orchestrationTaskName || "系统节点",
              },
              { title: "状态", dataIndex: "status", render: formatWorkflowStatus },
              { title: "重试", dataIndex: "retryCount" },
              { title: "耗时", dataIndex: "durationMs", render: (value: number | null) => value ? `${value}ms` : "-" },
              { title: "操作", render: (_, record) => <Button type="link" onClick={() => void openLogs(record)}>日志</Button> },
            ]}
          />
        </Card>
      </Col>

      <Drawer open={logDrawerOpen} title={selectedInstance ? `实例日志 · ${selectedInstance.workflowNodeName}` : "实例日志"} onClose={() => setLogDrawerOpen(false)} width={720}>
        <Space direction="vertical" size={16} style={{ display: "flex" }}>
          {selectedInstance?.errorMessage ? <Alert type="error" message={selectedInstance.errorMessage} /> : null}
          <List
            bordered
            dataSource={logs}
            renderItem={(item) => (
              <List.Item>
                <Space direction="vertical" size={2}>
                  <strong>{formatWorkflowLogType(item.logType)}</strong>
                  <span>{formatDateTime(item.createdAt)}</span>
                  <div style={{ whiteSpace: "pre-wrap" }}>{item.content}</div>
                </Space>
              </List.Item>
            )}
          />
        </Space>
      </Drawer>
    </Row>
  );
}
