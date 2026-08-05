import { CalendarOutlined, DeleteOutlined, EditOutlined, PartitionOutlined } from "@ant-design/icons";
import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, message } from "antd";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDevOrchestration, createDevWorkflowFromTask, deleteDevOrchestration, updateDevOrchestration } from "../../../services/dataDevelopment";
import type { DevDatasourceRecord, DevOrchestrationTaskRecord } from "../../../types/api";
import { formatDateTime } from "../helpers";

interface OrchestrationTaskListProps {
  token: string;
  datasources: DevDatasourceRecord[];
  tasks: DevOrchestrationTaskRecord[];
  loading?: boolean;
  onRefresh: () => Promise<void>;
  onEditTask: (taskId: number) => void;
}

type TaskFormValues = {
  name: string;
  description?: string;
  datasourceId?: number;
  databaseName?: string;
};

export function OrchestrationTaskList({ token, datasources, tasks, loading, onRefresh, onEditTask }: OrchestrationTaskListProps) {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<DevOrchestrationTaskRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [creatingScheduleId, setCreatingScheduleId] = useState<number | null>(null);
  const [form] = Form.useForm<TaskFormValues>();

  const sortedTasks = useMemo(
    () => [...tasks].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
    [tasks]
  );

  function openCreateModal() {
    setEditingTask(null);
    form.resetFields();
    setModalOpen(true);
  }

  function openEditModal(task: DevOrchestrationTaskRecord) {
    setEditingTask(task);
    form.setFieldsValue({
      name: task.name,
      description: task.description || "",
      datasourceId: task.datasourceId || undefined,
      databaseName: task.databaseName || "",
    });
    setModalOpen(true);
  }

  async function handleSubmit() {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const payload = {
        name: values.name,
        description: values.description || null,
        datasourceId: values.datasourceId || null,
        databaseName: values.databaseName || null,
        cronExpr: null,
        isPaused: true,
        retryTimes: editingTask?.retryTimes ?? 0,
        timeoutSec: editingTask?.timeoutSec ?? 300,
        runtimeConfig: editingTask?.runtimeConfig || {},
      };

      if (editingTask) {
        await updateDevOrchestration(token, editingTask.id, payload);
        message.success("算子任务已更新");
        setModalOpen(false);
        await onRefresh();
        return;
      }

      const response = await createDevOrchestration(token, payload);
      message.success("算子任务已创建");
      setModalOpen(false);
      await onRefresh();
      onEditTask(response.data.id);
    } catch (error: any) {
      message.error(error.message || "保存算子任务失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(task: DevOrchestrationTaskRecord) {
    try {
      await deleteDevOrchestration(token, task.id);
      message.success("算子任务已删除");
      await onRefresh();
    } catch (error: any) {
      message.error(error.message || "删除算子任务失败");
    }
  }

  async function handleCreateSchedule(task: DevOrchestrationTaskRecord) {
    setCreatingScheduleId(task.id);
    try {
      const response = await createDevWorkflowFromTask(token, { taskType: "operator_task", taskId: task.id });
      message.success("调度工作流已创建");
      navigate(`/dashboard/data-development/scheduling/${response.data.id}/edit`);
    } catch (error: any) {
      message.error(error.message || "创建调度工作流失败");
    } finally {
      setCreatingScheduleId(null);
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <Card title="算子任务" extra={<Button type="primary" onClick={openCreateModal}>新增任务</Button>}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={sortedTasks}
          pagination={{ pageSize: 8 }}
          columns={[
            { title: "任务名称", dataIndex: "name" },
            {
              title: "数据源",
              render: (_, record) => record.datasourceName ? `${record.datasourceName}${record.databaseName ? ` / ${record.databaseName}` : ""}` : "-",
            },
            {
              title: "调度方式",
              render: () => <Tag color="blue">调度管理统一编排</Tag>,
            },
            {
              title: "节点数",
              dataIndex: "nodeCount",
              render: (value: number | undefined) => value ?? 0,
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
                  <Button type="link" icon={<PartitionOutlined />} onClick={() => onEditTask(record.id)}>
                    进入画布
                  </Button>
                  <Button type="link" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
                    基础配置
                  </Button>
                  <Button
                    type="link"
                    icon={<CalendarOutlined />}
                    loading={creatingScheduleId === record.id}
                    onClick={() => void handleCreateSchedule(record)}
                  >
                    创建调度
                  </Button>
                  <Popconfirm title="确认删除这个算子任务？" onConfirm={() => void handleDelete(record)}>
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
        open={modalOpen}
        title={editingTask ? "编辑算子任务" : "新增算子任务"}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="name" label="任务名称" rules={[{ required: true, message: "请输入任务名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="datasourceId" label="默认数据源">
            <Select
              allowClear
              showSearch
              placeholder="可先不选，进入画布后再配置"
              optionFilterProp="label"
              options={datasources.map((item) => ({ value: item.id, label: `${item.name} / ${item.type}` }))}
            />
          </Form.Item>
          <Form.Item name="databaseName" label="默认数据库 / Schema">
            <Input placeholder="例如：ods 或 public" />
          </Form.Item>
          <Form.Item name="description" label="任务描述">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
