import {
  BranchesOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { Alert, Button, Checkbox, Dropdown, Form, Input, Modal, Select, Space, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { DataTableCard } from "../../components/ui/DataTableCard";
import { StatusTag } from "../../components/ui/StatusTag";
import { useAuth } from "../../app/providers/AuthProvider";
import { createSystemRole, deleteSystemRole, fetchSystemRoles, updateSystemRole, type SystemRolePayload } from "../../services/systemManagement";
import type { SystemRoleRecord } from "../../types/api";
import { SystemPageLayout } from "./SystemPageLayout";

const moduleOptions = [
  { value: "overview", label: "总览" },
  { value: "ingestion", label: "数据接入" },
  { value: "quality", label: "质量管控" },
  { value: "processing", label: "数据处理" },
  { value: "data_map", label: "数据地图" },
  { value: "standards", label: "数据标准" },
  { value: "services", label: "数据服务" },
  { value: "reporting", label: "报表平台" },
  { value: "data_modeling", label: "数据建模" },
  { value: "system_services", label: "服务管理" },
  { value: "system_users", label: "用户管理" },
  { value: "system_roles", label: "角色管理" },
  { value: "system_models", label: "模型管理" },
  { value: "system_projects", label: "项目管理" },
] as const;

const roleTypeOptions = [
  { value: "admin", label: "管理员" },
  { value: "developer", label: "开发" },
  { value: "operator", label: "运维" },
  { value: "viewer", label: "只读" },
  { value: "custom", label: "自定义" },
] as const;

const statusOptions = [
  { value: "active", label: "启用" },
  { value: "inactive", label: "停用" },
] as const;

function getRoleTypeLabel(value: SystemRoleRecord["roleType"]) {
  return roleTypeOptions.find((item) => item.value === value)?.label || value;
}

export function SystemRoleManagementPage() {
  const { token } = useAuth();
  const [records, setRecords] = useState<SystemRoleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SystemRoleRecord | null>(null);
  const [form] = Form.useForm();
  const selectedRoleType = Form.useWatch("roleType", form);

  const stats = useMemo(() => {
    const activeCount = records.filter((item) => item.status === "active").length;
    const systemCount = records.filter((item) => item.isSystem).length;
    const userCount = records.reduce((sum, item) => sum + Number(item.userCount || 0), 0);
    return [
      { title: "角色总数", value: records.length, description: "当前可分配角色", icon: <BranchesOutlined /> },
      { title: "启用角色", value: activeCount, description: "正在生效的权限模板", icon: <SafetyCertificateOutlined /> },
      { title: "系统角色", value: systemCount, description: "平台内置不可随意删除", icon: <ReloadOutlined /> },
      { title: "绑定用户", value: userCount, description: "角色覆盖的用户规模", icon: <PlusOutlined /> },
    ];
  }, [records]);

  async function loadData() {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetchSystemRoles(token);
      setRecords(response.data);
    } catch (error: any) {
      message.error(`加载角色列表失败: ${error.message || "未知错误"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  function openCreateModal() {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ roleType: "custom", status: "active", modules: ["overview"] });
    setOpen(true);
  }

  function openEditModal(record: SystemRoleRecord) {
    setEditingRecord(record);
    form.setFieldsValue({
      roleName: record.roleName,
      roleCode: record.roleCode,
      roleType: record.roleType,
      status: record.status,
      modules: record.permissions?.modules || [],
    });
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEditingRecord(null);
    form.resetFields();
  }

  async function handleSubmit() {
    if (!token) return;

    try {
      const values = await form.validateFields();
      const payload: SystemRolePayload = {
        roleName: values.roleName,
        roleCode: values.roleCode,
        roleType: values.roleType,
        status: values.status,
        permissions: {
          modules: values.modules || [],
          ...(values.roleType === "viewer" || values.roleCode === "viewer" ? { mode: "readonly", actions: ["read"] } : {}),
        },
      };

      setSubmitting(true);
      if (editingRecord) {
        await updateSystemRole(token, editingRecord.id, payload);
        message.success("角色更新成功");
      } else {
        await createSystemRole(token, payload);
        message.success("角色创建成功");
      }

      closeModal();
      await loadData();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(`保存角色失败: ${error.message || "未知错误"}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(record: SystemRoleRecord) {
    if (!token) return;
    try {
      await deleteSystemRole(token, record.id);
      message.success("角色删除成功");
      await loadData();
    } catch (error: any) {
      message.error(`删除角色失败: ${error.message || "未知错误"}`);
    }
  }

  const columns: ColumnsType<SystemRoleRecord> = [
    { title: "角色名称", dataIndex: "roleName", key: "roleName", width: 180 },
    { title: "角色编码", dataIndex: "roleCode", key: "roleCode", width: 180 },
    {
      title: "角色类型",
      dataIndex: "roleType",
      key: "roleType",
      width: 140,
      render: (value: SystemRoleRecord["roleType"]) => <StatusTag label={getRoleTypeLabel(value)} tone="processing" />,
    },
    {
      title: "功能模块",
      dataIndex: "permissions",
      key: "permissions",
      render: (value: SystemRoleRecord["permissions"]) => (
        <Space wrap>
          {value?.mode === "readonly" ? <StatusTag label="只读模式" tone="default" /> : null}
          {(value?.modules || []).map((item) => (
            <StatusTag key={item} label={moduleOptions.find((option) => option.value === item)?.label || item} tone="processing" />
          ))}
        </Space>
      ),
    },
    { title: "绑定用户数", dataIndex: "userCount", key: "userCount", width: 120 },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value: SystemRoleRecord["status"]) => <StatusTag status={value} />,
    },
    {
      title: "操作",
      key: "actions",
      width: 100,
      render: (_: unknown, record) => (
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              { key: "edit", label: "编辑" },
              { type: "divider" },
              { key: "delete", label: "删除", danger: true, disabled: record.isSystem },
            ],
            onClick: ({ key }) => {
              if (key === "edit") openEditModal(record);
              if (key === "delete") {
                Modal.confirm({
                  title: `确认删除角色“${record.roleName}”？`,
                  content: "删除后会影响当前已绑定的用户权限，请谨慎操作。",
                  okText: "删除",
                  cancelText: "取消",
                  okButtonProps: { danger: true },
                  onOk: () => handleDelete(record),
                });
              }
            },
          }}
        >
          <Button icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  return (
    <>
      <SystemPageLayout
        title="角色管理"
        description="通过角色抽象统一控制模块访问范围，保持权限分配清晰、稳定且可审计。"
        heroDescription="角色页面统一使用系统 Hero、KPI 与 Tabs 结构，权限模块信息通过标签表达，不再依赖纯文字颜色。"
        heroBadges={["权限模板化", "状态统一标签化", "删除收纳进更多菜单"]}
        stats={stats}
        activeTab="roles"
        hideHero
        toolbarRight={
          <>
            <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新建角色
            </Button>
          </>
        }
      >
        <DataTableCard<SystemRoleRecord>
          title="角色列表"
          tableProps={{
            rowKey: "id",
            loading,
            dataSource: records,
            columns,
            pagination: { pageSize: 8, showSizeChanger: false },
          }}
        />
      </SystemPageLayout>

      <Modal
        open={open}
        title={editingRecord ? "编辑角色" : "新建角色"}
        onCancel={closeModal}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        destroyOnHidden
        width={760}
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="roleName" label="角色名称" rules={[{ required: true, message: "请输入角色名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="roleCode" label="角色编码" rules={[{ required: true, message: "请输入角色编码" }]}>
            <Input disabled={Boolean(editingRecord?.isSystem)} />
          </Form.Item>
          <Form.Item name="roleType" label="角色类型" rules={[{ required: true, message: "请选择角色类型" }]}>
            <Select options={roleTypeOptions as unknown as { value: string; label: string }[]} />
          </Form.Item>
          {selectedRoleType === "viewer" ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="只读角色仅允许查看已授权模块"
              description="模块勾选只控制可见范围；该角色不能新建、编辑、删除、运行、发布、导入、上传或修改任何配置。"
            />
          ) : null}
          <Form.Item name="modules" label="允许访问的模块" rules={[{ required: true, message: "请至少选择一个模块" }]}>
            <Checkbox.Group
              options={moduleOptions as unknown as { value: string; label: string }[]}
              style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}
            />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={statusOptions as unknown as { value: string; label: string }[]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
