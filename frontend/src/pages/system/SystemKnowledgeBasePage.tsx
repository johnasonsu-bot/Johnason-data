import { CloudUploadOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, EyeOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Card, Descriptions, Drawer, Form, Input, Modal, Select, Space, Table, Tag, Typography, Upload, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  createSystemKnowledgeBase,
  deleteSystemKnowledgeBase,
  deleteSystemKnowledgeDocument,
  downloadSystemKnowledgeDocument,
  fetchSystemKnowledgeBaseDetail,
  fetchSystemKnowledgeBases,
  fetchSystemKnowledgeDocumentPreview,
  reparseSystemKnowledgeDocument,
  updateSystemKnowledgeBase,
  uploadSystemKnowledgeDocument,
  type SystemKnowledgeBasePayload,
} from "../../services/systemKnowledgeBases";
import type { SystemKnowledgeBaseRecord, SystemKnowledgeDocumentPreview, SystemKnowledgeDocumentRecord } from "../../types/api";
import { StatusTag } from "../../components/ui/StatusTag";
import { SystemPageLayout } from "./SystemPageLayout";

type Scope = "industry" | "platform" | "personal";
type EditorValues = { kbName: string; kbDesc?: string; tagsText?: string; status: "active" | "inactive" };

const scopeMeta: Record<Scope, { title: string; description: string; tag: string }> = {
  industry: { title: "行业知识库", description: "维护数据建模和行业孵化使用的行业知识。", tag: "scope:industry" },
  platform: { title: "平台知识库", description: "维护平台公共方法、规范和实施知识。", tag: "scope:platform" },
  personal: { title: "个人知识库", description: "维护当前项目内部使用的个人知识。", tag: "scope:personal" },
};

function parseTags(value?: string) {
  return Array.from(new Set(String(value || "").split(/[，,、\n]/).map((item) => item.trim()).filter(Boolean)));
}

function resolveScope(pathname: string): Scope {
  if (pathname.endsWith("/platform")) return "platform";
  if (pathname.endsWith("/personal")) return "personal";
  return "industry";
}

export function SystemKnowledgeBasePage() {
  const { pathname } = useLocation();
  const { token } = useAuth();
  const scope = resolveScope(pathname);
  const meta = scopeMeta[scope];
  const [form] = Form.useForm<EditorValues>();
  const [records, setRecords] = useState<SystemKnowledgeBaseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SystemKnowledgeBaseRecord | null>(null);
  const [detail, setDetail] = useState<SystemKnowledgeBaseRecord | null>(null);
  const [preview, setPreview] = useState<SystemKnowledgeDocumentPreview | null>(null);

  async function loadData() {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetchSystemKnowledgeBases(token);
      setRecords(response.data || []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "知识库加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, [token]);

  const scopedRecords = useMemo(
    () => records.filter((record) => (record.tags || []).includes(meta.tag)),
    [meta.tag, records]
  );

  function openCreate() {
    setEditing(null);
    form.setFieldsValue({ kbName: "", kbDesc: "", tagsText: "", status: "active" });
    setEditorOpen(true);
  }

  function openEdit(record: SystemKnowledgeBaseRecord) {
    setEditing(record);
    form.setFieldsValue({
      kbName: record.kbName,
      kbDesc: record.kbDesc || "",
      tagsText: (record.tags || []).filter((tag) => !tag.startsWith("scope:")).join("，"),
      status: record.status === "inactive" ? "inactive" : "active",
    });
    setEditorOpen(true);
  }

  async function submitEditor() {
    if (!token) return;
    const values = await form.validateFields();
    const payload: SystemKnowledgeBasePayload = {
      kbName: values.kbName,
      kbDesc: values.kbDesc || null,
      tags: Array.from(new Set([meta.tag, ...parseTags(values.tagsText).filter((tag) => !tag.startsWith("scope:"))])),
      status: values.status,
    };
    setSaving(true);
    try {
      if (editing) await updateSystemKnowledgeBase(token, editing.id, payload);
      else await createSystemKnowledgeBase(token, payload);
      setEditorOpen(false);
      message.success(editing ? "知识库已更新" : "知识库已创建");
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(record: SystemKnowledgeBaseRecord) {
    if (!token) return;
    const response = await fetchSystemKnowledgeBaseDetail(token, record.id);
    setDetail(response.data);
  }

  async function removeKnowledgeBase(record: SystemKnowledgeBaseRecord) {
    if (!token) return;
    await deleteSystemKnowledgeBase(token, record.id);
    if (detail?.id === record.id) setDetail(null);
    message.success("知识库已删除");
    await loadData();
  }

  async function uploadDocument(file: File) {
    if (!token || !detail) return Upload.LIST_IGNORE;
    try {
      const response = await uploadSystemKnowledgeDocument(token, detail.id, file);
      setDetail(response.data);
      message.success("文档已上传并解析");
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "文档上传失败");
    }
    return Upload.LIST_IGNORE;
  }

  async function removeDocument(document: SystemKnowledgeDocumentRecord) {
    if (!token || !detail) return;
    await deleteSystemKnowledgeDocument(token, document.id);
    await openDetail(detail);
    await loadData();
  }

  const columns = [
    { title: "知识库名称", dataIndex: "kbName", key: "kbName" },
    { title: "说明", dataIndex: "kbDesc", key: "kbDesc", render: (value: string) => value || "-" },
    { title: "文档数", dataIndex: "documentCount", key: "documentCount", width: 100, render: (value: number) => Number(value || 0) },
    { title: "状态", dataIndex: "status", key: "status", width: 100, render: (value: string) => <StatusTag status={value} /> },
    {
      title: "操作", key: "actions", width: 220, render: (_: unknown, record: SystemKnowledgeBaseRecord) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => void openDetail(record)}>详情</Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => Modal.confirm({ title: `确认删除“${record.kbName}”？`, okButtonProps: { danger: true }, onOk: () => removeKnowledgeBase(record) })}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <SystemPageLayout
      title={meta.title}
      description={meta.description}
      toolbarRight={<Space><Button icon={<ReloadOutlined />} onClick={() => void loadData()}>刷新</Button><Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建知识库</Button></Space>}
      hideHero
    >
      <Card bordered={false}>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={scopedRecords} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal open={editorOpen} title={editing ? "编辑知识库" : "新建知识库"} onCancel={() => setEditorOpen(false)} onOk={() => void submitEditor()} confirmLoading={saving} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="kbName" label="知识库名称" rules={[{ required: true, message: "请输入知识库名称" }]}><Input maxLength={128} /></Form.Item>
          <Form.Item name="kbDesc" label="知识库说明"><Input.TextArea rows={4} maxLength={1024} /></Form.Item>
          <Form.Item name="tagsText" label="业务标签"><Input placeholder="多个标签使用逗号分隔" /></Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}><Select options={[{ value: "active", label: "启用" }, { value: "inactive", label: "停用" }]} /></Form.Item>
        </Form>
      </Modal>

      <Drawer open={Boolean(detail)} width={900} title={detail?.kbName || "知识库详情"} onClose={() => setDetail(null)} extra={<Upload showUploadList={false} beforeUpload={(file) => { void uploadDocument(file); return false; }}><Button type="primary" icon={<CloudUploadOutlined />}>上传文档</Button></Upload>}>
        {detail ? <Space direction="vertical" size={16} style={{ display: "flex" }}>
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="知识库名称">{detail.kbName}</Descriptions.Item>
            <Descriptions.Item label="状态"><StatusTag status={detail.status} /></Descriptions.Item>
            <Descriptions.Item label="说明" span={2}>{detail.kbDesc || "-"}</Descriptions.Item>
            <Descriptions.Item label="标签" span={2}><Space wrap>{(detail.tags || []).map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space></Descriptions.Item>
          </Descriptions>
          <Table<SystemKnowledgeDocumentRecord>
            rowKey="id"
            dataSource={detail.documents || []}
            pagination={false}
            columns={[
              { title: "文件名", dataIndex: "fileName", key: "fileName" },
              { title: "解析状态", dataIndex: "parseStatus", key: "parseStatus", width: 110 },
              { title: "片段数", dataIndex: "chunkCount", key: "chunkCount", width: 90 },
              { title: "操作", key: "actions", width: 280, render: (_, document) => <Space>
                <Button type="link" onClick={async () => { if (!token) return; const response = await fetchSystemKnowledgeDocumentPreview(token, document.id); setPreview(response.data); }}>预览</Button>
                <Button type="link" onClick={() => token && void reparseSystemKnowledgeDocument(token, document.id).then(() => openDetail(detail))}>重新解析</Button>
                <Button type="link" icon={<DownloadOutlined />} onClick={() => token && void downloadSystemKnowledgeDocument(token, document.id, document.fileName)}>下载</Button>
                <Button type="link" danger onClick={() => void removeDocument(document)}>删除</Button>
              </Space> },
            ]}
          />
        </Space> : null}
      </Drawer>

      <Modal open={Boolean(preview)} width={900} title={preview?.document.fileName || "文档预览"} footer={null} onCancel={() => setPreview(null)}>
        <Typography.Paragraph style={{ whiteSpace: "pre-wrap", maxHeight: 620, overflow: "auto" }}>{preview?.previewText || "暂无可预览内容"}</Typography.Paragraph>
      </Modal>
    </SystemPageLayout>
  );
}
