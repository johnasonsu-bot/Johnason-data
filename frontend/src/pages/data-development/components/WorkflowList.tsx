import {
  CaretRightOutlined,
  DeleteOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Switch, Table, Tag, message } from "antd";
import { useMemo, useState } from "react";
import { createDevWorkflow, deleteDevWorkflow, runDevWorkflow, updateDevWorkflow } from "../../../services/dataDevelopment";
import type { DevWorkflowRecord } from "../../../types/api";
import { formatDateTime } from "../helpers";
import {
  buildCronFromWorkflowSchedule,
  describeWorkflowSchedule,
  getWorkflowIntervalMax,
  parseCronToWorkflowSchedule,
  workflowIntervalUnitOptions,
  workflowWeekDayOptions,
  type WorkflowIntervalUnit,
  type WorkflowScheduleType,
} from "../workflowSchedule";

interface WorkflowListProps {
  token: string;
  workflows: DevWorkflowRecord[];
  loading?: boolean;
  onRefresh: () => Promise<void>;
  onEditWorkflow: (workflowId: number) => void;
  onOpenInstances: (workflowId: number) => void;
}

type WorkflowFormValues = {
  name: string;
  description?: string;
};

type ScheduleFormValues = {
  scheduleType: WorkflowScheduleType;
  intervalValue?: number;
  intervalUnit?: WorkflowIntervalUnit;
  runTime?: string;
  weekDays?: number[];
  monthDay?: number;
  cronExpr?: string;
  isPaused: boolean;
  retryTimes: number;
  timeoutSec: number;
};

function getScheduleStatus(record: DevWorkflowRecord) {
  if (!record.cronExpr) {
    return { color: "default", text: "手动" };
  }
  return record.isPaused
    ? { color: "orange", text: "已停止" }
    : { color: "green", text: "已启动" };
}

export function WorkflowList({ token, workflows, loading, onRefresh, onEditWorkflow, onOpenInstances }: WorkflowListProps) {
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<DevWorkflowRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [workflowForm] = Form.useForm<WorkflowFormValues>();
  const [scheduleForm] = Form.useForm<ScheduleFormValues>();
  const scheduleType = Form.useWatch("scheduleType", scheduleForm) || "manual";
  const intervalUnit = Form.useWatch("intervalUnit", scheduleForm) || "minute";

  const sortedWorkflows = useMemo(
    () => [...workflows].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
    [workflows]
  );

  function openCreateModal() {
    setEditingWorkflow(null);
    workflowForm.resetFields();
    setWorkflowModalOpen(true);
  }

  function openEditMetaModal(record: DevWorkflowRecord) {
    setEditingWorkflow(record);
    workflowForm.setFieldsValue({
      name: record.name,
      description: record.description || "",
    });
    setWorkflowModalOpen(true);
  }

  function openScheduleModal(record: DevWorkflowRecord) {
    setEditingWorkflow(record);
    const parsed = parseCronToWorkflowSchedule(record.cronExpr);
    scheduleForm.setFieldsValue({
      scheduleType: parsed.scheduleType || "manual",
      intervalValue: parsed.intervalValue || 5,
      intervalUnit: parsed.intervalUnit || "minute",
      runTime: parsed.runTime || "02:00",
      weekDays: parsed.weekDays,
      monthDay: parsed.monthDay || 1,
      cronExpr: parsed.cronExpr || record.cronExpr || "",
      isPaused: record.isPaused,
      retryTimes: record.retryTimes,
      timeoutSec: record.timeoutSec,
    });
    setScheduleModalOpen(true);
  }

  async function handleSubmitWorkflow() {
    const values = await workflowForm.validateFields();
    setSubmitting(true);
    try {
      if (editingWorkflow) {
        await updateDevWorkflow(token, editingWorkflow.id, {
          ...values,
          cronExpr: editingWorkflow.cronExpr,
          isPaused: editingWorkflow.isPaused,
          retryTimes: editingWorkflow.retryTimes,
          timeoutSec: editingWorkflow.timeoutSec,
          runtimeConfig: editingWorkflow.runtimeConfig || {},
        });
        message.success("工作流已更新");
      } else {
        await createDevWorkflow(token, {
          ...values,
          cronExpr: null,
          isPaused: true,
          retryTimes: 0,
          timeoutSec: 300,
          runtimeConfig: {},
        });
        message.success("工作流已创建");
      }
      setWorkflowModalOpen(false);
      await onRefresh();
    } catch (error: any) {
      message.error(error.message || "保存工作流失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveSchedule() {
    if (!editingWorkflow) return;
    const values = await scheduleForm.validateFields();
    const cronExpr = buildCronFromWorkflowSchedule(values);
    setSubmitting(true);
    try {
      await updateDevWorkflow(token, editingWorkflow.id, {
        name: editingWorkflow.name,
        description: editingWorkflow.description || "",
        cronExpr,
        isPaused: values.scheduleType === "manual" ? true : values.isPaused,
        retryTimes: values.retryTimes,
        timeoutSec: values.timeoutSec,
        runtimeConfig: editingWorkflow.runtimeConfig || {},
      });
      message.success("调度配置已保存");
      setScheduleModalOpen(false);
      await onRefresh();
    } catch (error: any) {
      message.error(error.message || "保存调度配置失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRun(record: DevWorkflowRecord) {
    setRunningId(record.id);
    try {
      await runDevWorkflow(token, record.id, { triggerType: "manual" });
      message.success("工作流已触发运行");
      await onRefresh();
    } catch (error: any) {
      message.error(error.message || "触发工作流失败");
    } finally {
      setRunningId(null);
    }
  }

  async function handleToggleSchedule(record: DevWorkflowRecord, nextPaused: boolean) {
    setRunningId(record.id);
    try {
      await updateDevWorkflow(token, record.id, {
        name: record.name,
        description: record.description || "",
        cronExpr: record.cronExpr || null,
        isPaused: nextPaused,
        retryTimes: record.retryTimes,
        timeoutSec: record.timeoutSec,
        runtimeConfig: record.runtimeConfig || {},
      });
      message.success(nextPaused ? "工作流已停止" : "工作流已启动");
      await onRefresh();
    } catch (error: any) {
      message.error(error.message || "更新工作流状态失败");
    } finally {
      setRunningId(null);
    }
  }

  async function handleDelete(record: DevWorkflowRecord) {
    try {
      await deleteDevWorkflow(token, record.id);
      message.success("工作流已删除");
      await onRefresh();
    } catch (error: any) {
      message.error(error.message || "删除工作流失败");
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <Card title="调度工作流" extra={<Button type="primary" onClick={openCreateModal}>新建工作流</Button>}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={sortedWorkflows}
          pagination={{ pageSize: 8 }}
          columns={[
            { title: "名称", dataIndex: "name" },
            {
              title: "调度状态",
              render: (_, record) => {
                const status = getScheduleStatus(record);
                return <Tag color={status.color}>{status.text}</Tag>;
              },
            },
            {
              title: "调度周期",
              dataIndex: "cronExpr",
              render: (value: string | null) => describeWorkflowSchedule(value),
            },
            {
              title: "节点数",
              dataIndex: "nodeCount",
              render: (value: number | undefined) => value ?? 0,
            },
            {
              title: "发布版本",
              render: (_, record) => record.publishedVersionNo ? <Tag color="blue">V{record.publishedVersionNo}</Tag> : <Tag>未发布</Tag>,
            },
            {
              title: "更新时间",
              dataIndex: "updatedAt",
              render: formatDateTime,
            },
            {
              title: "操作",
              render: (_, record) => (
                <Space wrap>
                  <Button type="link" icon={<PlayCircleOutlined />} loading={runningId === record.id} onClick={() => void handleRun(record)}>
                    运行
                  </Button>
                  <Button
                    type="link"
                    icon={record.isPaused ? <CaretRightOutlined /> : <PauseCircleOutlined />}
                    disabled={!record.cronExpr}
                    loading={runningId === record.id}
                    onClick={() => void handleToggleSchedule(record, !record.isPaused)}
                  >
                    {record.isPaused ? "启动" : "停止"}
                  </Button>
                  <Button type="link" icon={<EditOutlined />} onClick={() => onEditWorkflow(record.id)}>
                    编辑
                  </Button>
                  <Button type="link" icon={<SettingOutlined />} onClick={() => openScheduleModal(record)}>
                    调度
                  </Button>
                  <Button type="link" onClick={() => onOpenInstances(record.id)}>
                    实例
                  </Button>
                  <Button type="link" onClick={() => openEditMetaModal(record)}>
                    基础配置
                  </Button>
                  <Popconfirm title="确认删除这个工作流？" onConfirm={() => void handleDelete(record)}>
                    <Button type="link" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={workflowModalOpen}
        title={editingWorkflow ? "编辑工作流" : "新建工作流"}
        onCancel={() => setWorkflowModalOpen(false)}
        onOk={() => void handleSubmitWorkflow()}
        confirmLoading={submitting}
      >
        <Form layout="vertical" form={workflowForm}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={scheduleModalOpen}
        title={`调度配置${editingWorkflow ? ` / ${editingWorkflow.name}` : ""}`}
        onCancel={() => setScheduleModalOpen(false)}
        onOk={() => void handleSaveSchedule()}
        confirmLoading={submitting}
      >
        <Form layout="vertical" form={scheduleForm}>
          <Form.Item name="scheduleType" label="调度方式" rules={[{ required: true, message: "请选择调度方式" }]}>
            <Select options={[
              { value: "manual", label: "手动触发" },
              { value: "interval", label: "固定间隔" },
              { value: "daily", label: "每天执行" },
              { value: "weekly", label: "每周执行" },
              { value: "monthly", label: "每月执行" },
              { value: "custom", label: "自定义 Cron" },
            ]} />
          </Form.Item>
          {scheduleType === "interval" ? (
            <Form.Item label="执行间隔" required>
              <Space.Compact block>
                <Form.Item name="intervalValue" noStyle rules={[{ required: true, message: "请输入间隔时间" }]}>
                  <InputNumber min={1} max={getWorkflowIntervalMax(intervalUnit)} style={{ width: "70%" }} />
                </Form.Item>
                <Form.Item name="intervalUnit" noStyle rules={[{ required: true, message: "请选择间隔单位" }]}>
                  <Select options={workflowIntervalUnitOptions} style={{ width: "30%" }} />
                </Form.Item>
              </Space.Compact>
            </Form.Item>
          ) : null}
          {scheduleType === "daily" || scheduleType === "weekly" || scheduleType === "monthly" ? (
            <Form.Item name="runTime" label="执行时间" rules={[{ required: true, message: "请选择执行时间" }]}>
              <Input type="time" />
            </Form.Item>
          ) : null}
          {scheduleType === "weekly" ? (
            <Form.Item name="weekDays" label="执行日" rules={[{ required: true, message: "请选择执行日" }]}>
              <Select mode="multiple" options={workflowWeekDayOptions} placeholder="选择每周执行日" />
            </Form.Item>
          ) : null}
          {scheduleType === "monthly" ? (
            <Form.Item name="monthDay" label="每月日期" rules={[{ required: true, message: "请输入每月日期" }]}>
              <InputNumber min={1} max={31} style={{ width: "100%" }} />
            </Form.Item>
          ) : null}
          {scheduleType === "custom" ? (
            <Form.Item name="cronExpr" label="Cron 表达式" rules={[{ required: true, message: "请输入 Cron 表达式" }]}>
              <Input placeholder="例如：*/5 * * * *" />
            </Form.Item>
          ) : null}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="retryTimes" label="失败重试次数">
                <InputNumber min={0} max={10} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="timeoutSec" label="运行超时(秒)">
                <InputNumber min={1} max={7200} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          {scheduleType !== "manual" ? (
            <Form.Item name="isPaused" label="暂停调度" valuePropName="checked">
              <Switch />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </Space>
  );
}
