import { PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, message } from "antd";
import { useState } from "react";
import { createDevDatasource, deleteDevDatasource, testDevDatasourceConfig, updateDevDatasource } from "../../../services/dataDevelopment";
import type { DevDatasourceRecord } from "../../../types/api";
import { buildDevDatasourceExtraConfig, getDefaultPort } from "../../../utils/datasource";
import { formatDateTime } from "../helpers";

interface DatasourceManagerProps {
  token: string;
  datasources: DevDatasourceRecord[];
  loading?: boolean;
  onRefresh: () => Promise<void>;
  onOpenWorkbench: (datasourceId: number, databaseName?: string | null) => void;
}

const typeOptions = [
  { value: "mysql", label: "MySQL" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "gaussdb", label: "GaussDB" },
  { value: "jdbc", label: "JDBC" },
  { value: "clickhouse", label: "ClickHouse" },
  { value: "hive", label: "Hive" },
];

function buildJdbcUrl(type?: string, values?: Record<string, unknown>) {
  const host = String(values?.host ?? "").trim();
  const port = Number(values?.port || 0);
  const databaseName = String(values?.databaseName ?? "").trim();

  if (!host || !port) {
    return "";
  }

  switch (type) {
    case "mysql":
      return `jdbc:mysql://${host}:${port}/${databaseName}?useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=Asia/Shanghai`;
    case "postgresql":
      return `jdbc:postgresql://${host}:${port}/${databaseName}`;
    case "gaussdb":
      return `jdbc:gaussdb://${host}:${port}/${databaseName}`;
    case "clickhouse":
      return `jdbc:clickhouse://${host}:${port}/${databaseName}`;
    case "hive":
      return `jdbc:hive2://${host}:${port}/${databaseName || "default"}`;
    default:
      return "";
  }
}

function getDefaultDriverClassName(type?: string) {
  switch (type) {
    case "mysql":
      return "com.mysql.cj.jdbc.Driver";
    case "postgresql":
      return "org.postgresql.Driver";
    case "gaussdb":
      return "org.opengauss.Driver";
    case "clickhouse":
      return "com.clickhouse.jdbc.ClickHouseDriver";
    case "hive":
      return "org.apache.hive.jdbc.HiveDriver";
    default:
      return "";
  }
}

export function DatasourceManager({ token, datasources, loading, onRefresh, onOpenWorkbench }: DatasourceManagerProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DevDatasourceRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [form] = Form.useForm();
  const currentType = Form.useWatch("type", form);
  const jdbcMode = currentType === "jdbc";

  function resetDerivedFields(type: string, nextValues?: Record<string, unknown>) {
    const jdbcUrl = buildJdbcUrl(type, nextValues || form.getFieldsValue(true));
    const driverClassName = getDefaultDriverClassName(type);

    if (type === "jdbc") {
      form.setFieldsValue({
        port: undefined,
      });
      return;
    }

    form.setFieldsValue({
      jdbcUrl,
      driverClassName,
    });
  }

  function openModal(record?: DevDatasourceRecord) {
    setEditing(record || null);
    setTestMessage("");

    form.setFieldsValue(record ? {
      name: record.name,
      type: record.type,
      host: record.host,
      port: record.port,
      databaseName: record.databaseName ?? undefined,
      username: record.username ?? undefined,
      jdbcUrl: record.extraConfig?.jdbcUrl,
      schema: record.extraConfig?.schema,
      driverClassName: record.extraConfig?.driverClassName,
      password: undefined,
    } : {
      type: "mysql",
      port: getDefaultPort("mysql"),
      driverClassName: getDefaultDriverClassName("mysql"),
    });

    if (!record) {
      resetDerivedFields("mysql", {
        type: "mysql",
        port: getDefaultPort("mysql"),
      });
    }

    setModalOpen(true);
  }

  async function handleSubmit() {
    const values = await form.validateFields();
    const password = typeof values.password === "string" && values.password.length > 0 ? values.password : undefined;
    const payload = {
      name: values.name,
      type: values.type,
      host: values.host,
      port: values.port,
      databaseName: values.databaseName,
      username: values.username,
      ...(password !== undefined ? { password } : {}),
      extraConfig: buildDevDatasourceExtraConfig(values, (editing?.extraConfig as Record<string, unknown>) || {}),
    };

    setSubmitting(true);
    try {
      if (editing) {
        await updateDevDatasource(token, editing.id, payload);
        message.success("数据源已更新");
      } else {
        await createDevDatasource(token, payload);
        message.success("数据源已创建");
      }
      setModalOpen(false);
      await onRefresh();
    } catch (error: any) {
      message.error(error.message || "保存数据源失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const values = await form.validateFields([
        "type",
        "host",
        "port",
        "databaseName",
        "username",
        "password",
        "jdbcUrl",
        "schema",
        "driverClassName",
      ]);
      const res = await testDevDatasourceConfig(token, {
        ...(editing ? { datasourceId: editing.id } : {}),
        type: values.type,
        host: values.host,
        port: values.port,
        databaseName: values.databaseName,
        username: values.username,
        ...(typeof values.password === "string" && values.password.length > 0 ? { password: values.password } : {}),
        extraConfig: buildDevDatasourceExtraConfig(values),
      });
      setTestMessage(res.data.message);
      message.success(res.data.message);
    } catch (error: any) {
      setTestMessage(error.message || "连接测试失败");
      message.error(error.message || "连接测试失败");
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteDevDatasource(token, id);
      message.success("数据源已删除");
      await onRefresh();
    } catch (error: any) {
      message.error(error.message || "删除数据源失败");
    }
  }

  function handleValuesChange(changedValues: Record<string, unknown>) {
    const allValues = form.getFieldsValue(true);
    const nextType = String(("type" in changedValues ? changedValues.type : allValues.type) || "");

    if ("type" in changedValues) {
      const nextPort = nextType === "jdbc" ? undefined : getDefaultPort(nextType);
      form.setFieldValue("port", nextPort);
      if (nextType !== "jdbc") {
        resetDerivedFields(nextType, { ...allValues, ...changedValues, port: nextPort });
      }
    }

    if (nextType !== "jdbc" && ("host" in changedValues || "port" in changedValues || "databaseName" in changedValues)) {
      resetDerivedFields(nextType, { ...allValues, ...changedValues });
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()} style={{ alignSelf: "flex-end" }}>
        新建数据源
      </Button>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={datasources}
        pagination={{ pageSize: 6 }}
        columns={[
          { title: "名称", dataIndex: "name" },
          { title: "类型", dataIndex: "type" },
          { title: "地址", render: (_, record) => `${record.host}:${record.port}` },
          { title: "默认库", dataIndex: "databaseName", render: (value: string) => value || "-" },
          { title: "更新时间", dataIndex: "updatedAt", render: formatDateTime },
          {
            title: "操作",
            render: (_, record) => (
              <Space>
                <Button type="link" onClick={() => onOpenWorkbench(record.id, record.databaseName)}>进入SQL分析</Button>
                <Button type="link" onClick={() => openModal(record)}>编辑</Button>
                <Popconfirm title="确认删除该数据源？" onConfirm={() => void handleDelete(record.id)}>
                  <Button type="link" danger>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        open={modalOpen}
        title={editing ? "编辑数据源" : "新建数据源"}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        footer={[
          <Button key="test" loading={testing} onClick={() => void handleTest()}>测试连接</Button>,
          <Button key="cancel" onClick={() => setModalOpen(false)}>取消</Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={() => void handleSubmit()}>保存</Button>,
        ]}
      >
        <Form layout="vertical" form={form} onValuesChange={handleValuesChange}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
                <Input placeholder="例如：生产 GaussDB" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="type" label="类型" rules={[{ required: true, message: "请选择类型" }]}>
                <Select options={typeOptions} />
              </Form.Item>
            </Col>
          </Row>

          {!jdbcMode ? (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="host" label="主机" rules={[{ required: true, message: "请输入主机" }]}>
                  <Input placeholder="例如：1.94.150.18" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="port" label="端口" rules={[{ required: true, message: "请输入端口" }]}>
                  <InputNumber style={{ width: "100%" }} placeholder="例如：8000" />
                </Form.Item>
              </Col>
            </Row>
          ) : null}

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="databaseName" label="默认库">
                <Input placeholder="例如：postgres" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="username" label="用户名">
                <Input placeholder="例如：root" />
              </Form.Item>
            </Col>
          </Row>

          {jdbcMode ? (
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="jdbcUrl" label="JDBC URL" rules={[{ required: true, message: "请输入 JDBC URL" }]}>
                  <Input placeholder="jdbc:gaussdb://host:port/db" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="schema" label="Schema">
                  <Input placeholder="public" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="driverClassName" label="Driver Class">
                  <Input placeholder="org.opengauss.Driver" />
                </Form.Item>
              </Col>
            </Row>
          ) : null}

          <Form.Item name="password" label="密码">
            <Input.Password placeholder={editing ? "留空表示不修改密码" : "请输入密码"} />
          </Form.Item>

          {testMessage ? <Alert type="info" message={testMessage} /> : null}
        </Form>
      </Modal>
    </Space>
  );
}
