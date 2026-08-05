import { Button, Card, Drawer, Form, Input, Popconfirm, Space, Table, Tag, Typography, Upload, message } from "antd";
import { useEffect, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  fetchKnowledgeBaseDetail,
  fetchKnowledgeBases,
  reparseKnowledgeDocument,
  updateKnowledgeBase,
  uploadKnowledgeDocument,
  type LabKnowledgeBasePayload,
} from "../../services/dataLab";
import type { LabKnowledgeBaseRecord } from "../../types/api";

export function DataLabKnowledgeBasePage() {
  const { token } = useAuth();
  const [records, setRecords] = useState<LabKnowledgeBaseRecord[]>([]);
  const [selected, setSelected] = useState<LabKnowledgeBaseRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<LabKnowledgeBasePayload>();

  async function loadData() {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetchKnowledgeBases(token);
      setRecords(response.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  async function openDetail(record: LabKnowledgeBaseRecord) {
    if (!token) return;
    const response = await fetchKnowledgeBaseDetail(token, record.id);
    setSelected(response.data);
    setDrawerOpen(true);
  }

  function openCreate() {
    setSelected(null);
    form.resetFields();
    form.setFieldsValue({ status: "active", tags: [] });
    setOpen(true);
  }

  function openEdit(record: LabKnowledgeBaseRecord) {
    setSelected(record);
    form.setFieldsValue({
      kbName: record.kbName,
      kbDesc: record.kbDesc || undefined,
      industryType: record.industryType || undefined,
      tags: record.tags || [],
      status: record.status as "active" | "inactive",
    });
    setOpen(true);
  }

  async function handleSubmit() {
    if (!token) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (selected?.id) {
        await updateKnowledgeBase(token, selected.id, values);
        message.success("知识库已更新");
      } else {
        await createKnowledgeBase(token, values);
        message.success("知识库已创建");
      }
      setOpen(false);
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token) return;
    await deleteKnowledgeBase(token, id);
    message.success("知识库已删除");
    await loadData();
    if (selected?.id === id) {
      setDrawerOpen(false);
      setSelected(null);
    }
  }

  async function handleReparse(docId: number) {
    if (!token || !selected) return;
    await reparseKnowledgeDocument(token, docId);
    message.success("已提交重解析");
    await openDetail(selected);
  }

  const columns = [
    { title: "知识库名称", dataIndex: "kbName", key: "kbName" },
    { title: "行业", dataIndex: "industryType", key: "industryType", render: (value: string) => value || "-" },
    { title: "标签", dataIndex: "tags", key: "tags", render: (tags: string[]) => <Space wrap>{(tags || []).map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space> },
    { title: "文档数", dataIndex: "documentCount", key: "documentCount", width: 90 },
    { title: "状态", dataIndex: "status", key: "status", width: 100, render: (value: string) => <Tag color={value === "active" ? "green" : "default"}>{value}</Tag> },
    {
      title: "操作",
      key: "actions",
      width: 220,
      render: (_: unknown, record: LabKnowledgeBaseRecord) => (
        <Space>
          <Button type="link" onClick={() => openDetail(record)}>详情</Button>
          <Button type="link" onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm title="确认删除该知识库？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <Card bordered={false}>
        <Space style={{ width: "100%", justifyContent: "flex-end" }}>
          <Button type="primary" onClick={openCreate}>新建知识库</Button>
        </Space>
      </Card>

      <Card bordered={false}>
        <Table rowKey="id" loading={loading} dataSource={records} columns={columns} pagination={{ pageSize: 8 }} />
      </Card>

      <Drawer open={drawerOpen} width={840} title={selected?.kbName || "知识库详情"} onClose={() => setDrawerOpen(false)}>
        {selected && (
          <Space direction="vertical" size={16} style={{ display: "flex" }}>
            <Card>
              <Typography.Paragraph>{selected.kbDesc || "暂无描述"}</Typography.Paragraph>
              <Typography.Text type="secondary">行业：{selected.industryType || "-"}</Typography.Text>
            </Card>
            <Upload
              showUploadList={false}
              beforeUpload={async (file) => {
                if (!token) return false;
                await uploadKnowledgeDocument(token, selected.id, file);
                message.success(`已上传 ${file.name}`);
                await openDetail(selected);
                return false;
              }}
            >
              <Button>上传文档</Button>
            </Upload>
            <Table
              rowKey="id"
              dataSource={selected.documents || []}
              pagination={false}
              columns={[
                { title: "文件名", dataIndex: "fileName", key: "fileName" },
                { title: "类型", dataIndex: "fileType", key: "fileType", width: 90 },
                { title: "解析状态", dataIndex: "parseStatus", key: "parseStatus", width: 120 },
                { title: "向量状态", dataIndex: "vectorStatus", key: "vectorStatus", width: 120 },
                { title: "片段数", dataIndex: "chunkCount", key: "chunkCount", width: 90 },
                { title: "解析摘要", dataIndex: "parseSummary", key: "parseSummary", render: (value: string) => value || "-" },
                { title: "操作", key: "actions", width: 100, render: (_: unknown, record: any) => <Button type="link" onClick={() => handleReparse(record.id)}>重解析</Button> }
              ]}
            />
          </Space>
        )}
      </Drawer>

      <Drawer open={open} title={selected?.id ? "编辑知识库" : "新建知识库"} onClose={() => setOpen(false)} width={520} extra={<Button type="primary" loading={saving} onClick={handleSubmit}>保存</Button>}>
        <Form layout="vertical" form={form}>
          <Form.Item name="kbName" label="知识库名称" rules={[{ required: true, message: "请输入知识库名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="industryType" label="行业类型">
            <Input placeholder="例如：婚姻登记 / 电商 / CRM" />
          </Form.Item>
          <Form.Item name="kbDesc" label="知识库描述">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Input placeholder="用逗号分隔" onChange={(event) => form.setFieldValue("tags", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Input placeholder="active / inactive" />
          </Form.Item>
        </Form>
      </Drawer>
    </Space>
  );
}
