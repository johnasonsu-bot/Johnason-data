import MonacoEditor from "@monaco-editor/react";
import { DeleteOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Form, Input, Modal, Popconfirm, Select, Space, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import {
  createDevScript,
  deleteDevScript,
  fetchDevScriptVersions,
  saveDevScriptAs,
  saveDevScriptVersion,
  updateDevScript,
} from "../../../services/dataDevelopment";
import type { DevDatasourceRecord, DevScriptFolderRecord, DevScriptRecord, DevScriptVersionRecord } from "../../../types/api";
import { formatDateTime } from "../helpers";

interface ScriptManagerProps {
  token: string;
  datasources: DevDatasourceRecord[];
  folders: DevScriptFolderRecord[];
  scripts: DevScriptRecord[];
  onRefresh: () => Promise<void>;
  onLoadToWorkbench: (script: DevScriptRecord) => void;
}

type ScriptFormValues = {
  name: string;
  datasourceId: number;
  defaultDatabase?: string;
  description?: string;
  tags?: string;
  content: string;
};

export function ScriptManager({ token, datasources, scripts, onRefresh, onLoadToWorkbench }: ScriptManagerProps) {
  const [keyword, setKeyword] = useState("");
  const [editingScript, setEditingScript] = useState<DevScriptRecord | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versionRows, setVersionRows] = useState<DevScriptVersionRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<ScriptFormValues>();

  const filteredScripts = useMemo(
    () => scripts.filter((item) => {
      if (!keyword) return true;
      return `${item.name} ${item.description || ""} ${item.datasourceName}`.toLowerCase().includes(keyword.toLowerCase());
    }),
    [keyword, scripts]
  );

  function openEditor(record?: DevScriptRecord | null) {
    const firstDatasource = datasources[0];
    const nextRecord = record || null;
    setEditingScript(nextRecord);
    form.resetFields();
    form.setFieldsValue({
      name: nextRecord?.name || `script_${Date.now()}`,
      datasourceId: nextRecord?.datasourceId || firstDatasource?.id,
      defaultDatabase: nextRecord?.defaultDatabase || firstDatasource?.databaseName || undefined,
      description: nextRecord?.description || "",
      tags: nextRecord?.tags?.join(",") || "",
      content: nextRecord?.content || "SELECT 1 AS demo;",
    });
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingScript(null);
    form.resetFields();
  }

  async function handleSave() {
    const values = await form.validateFields();
    const payload = {
      name: values.name,
      folderId: null,
      datasourceId: values.datasourceId,
      defaultDatabase: values.defaultDatabase || null,
      description: values.description || "",
      tags: String(values.tags || "").split(",").map((item) => item.trim()).filter(Boolean),
      content: values.content,
    };

    setSaving(true);
    try {
      if (editingScript) {
        await updateDevScript(token, editingScript.id, payload);
        message.success("脚本已更新");
      } else {
        await createDevScript(token, payload);
        message.success("脚本已创建");
      }
      closeEditor();
      await onRefresh();
    } catch (error: any) {
      message.error(error.message || "保存脚本失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteDevScript(token, id);
      message.success("脚本已删除");
      await onRefresh();
    } catch (error: any) {
      message.error(error.message || "删除脚本失败");
    }
  }

  async function handleVersionSave() {
    if (!editingScript) return;
    try {
      await saveDevScriptVersion(token, editingScript.id);
      message.success("已保存版本");
      await onRefresh();
    } catch (error: any) {
      message.error(error.message || "保存版本失败");
    }
  }

  async function handleSaveAs() {
    if (!editingScript) return;
    const values = await form.validateFields();
    try {
      await saveDevScriptAs(token, editingScript.id, {
        name: `${values.name}_copy`,
        folderId: null,
        datasourceId: values.datasourceId,
        defaultDatabase: values.defaultDatabase || null,
        description: values.description || "",
        tags: String(values.tags || "").split(",").map((item) => item.trim()).filter(Boolean),
        content: values.content,
      });
      message.success("脚本已另存为");
      await onRefresh();
    } catch (error: any) {
      message.error(error.message || "另存为失败");
    }
  }

  async function openVersions(record: DevScriptRecord) {
    try {
      const response = await fetchDevScriptVersions(token, record.id);
      setVersionRows(response.data);
      setVersionsOpen(true);
    } catch (error: any) {
      message.error(error.message || "加载版本历史失败");
    }
  }

  const columns: ColumnsType<DevScriptRecord> = [
    { title: "脚本名称", dataIndex: "name", key: "name", width: 220 },
    { title: "描述", dataIndex: "description", key: "description", render: (value?: string | null) => value || "-" },
    { title: "所属数据源", dataIndex: "datasourceName", key: "datasourceName", width: 180 },
    { title: "默认库", dataIndex: "defaultDatabase", key: "defaultDatabase", width: 140, render: (value?: string | null) => value || "-" },
    { title: "版本", dataIndex: "currentVersion", key: "currentVersion", width: 80, render: (value: number) => `v${value}` },
    { title: "创建时间", dataIndex: "createdAt", key: "createdAt", width: 180, render: formatDateTime },
    {
      title: "操作",
      key: "actions",
      width: 260,
      render: (_value, record) => (
        <Space>
          <Button type="link" onClick={() => openEditor(record)}>编辑</Button>
          <Button type="link" onClick={() => onLoadToWorkbench(record)}>工作台</Button>
          <Button type="link" onClick={() => void openVersions(record)}>版本</Button>
          <Popconfirm title="确认删除该脚本？" onConfirm={() => void handleDelete(record.id)}>
            <Button type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <Card
        size="small"
        title="脚本列表"
        extra={(
          <Space>
            <Input
              allowClear
              placeholder="搜索脚本名称、描述、数据源"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              style={{ width: 320 }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>
              新建脚本
            </Button>
          </Space>
        )}
      >
        <Table
          rowKey="id"
          dataSource={filteredScripts}
          columns={columns}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="暂无脚本" /> }}
        />
      </Card>

      <Modal
        open={editorOpen}
        title={editingScript ? "编辑脚本" : "新建脚本"}
        onCancel={closeEditor}
        onOk={() => void handleSave()}
        confirmLoading={saving}
        width={1240}
        destroyOnHidden
        footer={(
          <Space>
            <Button onClick={closeEditor}>关闭</Button>
            {editingScript ? <Button onClick={() => void handleVersionSave()}>保存版本</Button> : null}
            {editingScript ? <Button onClick={() => void handleSaveAs()}>另存为</Button> : null}
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void handleSave()}>
              保存
            </Button>
          </Space>
        )}
      >
        <Form form={form} layout="vertical">
          <Space size={16} align="start" style={{ width: "100%" }}>
            <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入脚本名称" }]} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="datasourceId" label="数据源" rules={[{ required: true, message: "请选择数据源" }]} style={{ flex: 1 }}>
              <Select options={datasources.map((item) => ({ value: item.id, label: item.name }))} />
            </Form.Item>
          </Space>
          <Space size={16} align="start" style={{ width: "100%" }}>
            <Form.Item name="defaultDatabase" label="默认库" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="tags" label="标签" style={{ flex: 1 }}>
              <Input placeholder="逗号分隔" />
            </Form.Item>
          </Space>
          <Form.Item name="description" label="描述">
            <Input />
          </Form.Item>
          <Form.Item name="content" label="SQL 内容" rules={[{ required: true, message: "请输入 SQL 内容" }]}>
            <MonacoEditor height="460px" language="sql" options={{ minimap: { enabled: false }, wordWrap: "on" }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal open={versionsOpen} title="版本历史" onCancel={() => setVersionsOpen(false)} footer={null} width={860}>
        <Table
          rowKey="id"
          dataSource={versionRows}
          pagination={{ pageSize: 5 }}
          columns={[
            { title: "版本号", dataIndex: "versionNo" },
            { title: "创建时间", dataIndex: "createdAt", render: formatDateTime },
            { title: "内容", dataIndex: "content", render: (value: string) => <Typography.Text>{value.slice(0, 120)}</Typography.Text> },
          ]}
        />
      </Modal>
    </Space>
  );
}
