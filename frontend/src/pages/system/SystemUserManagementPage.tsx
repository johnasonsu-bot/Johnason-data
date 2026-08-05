import {
  BranchesOutlined,
  MoreOutlined,
  ReloadOutlined,
  TeamOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { Button, Dropdown, Form, Input, Modal, Select, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { DataTableCard } from "../../components/ui/DataTableCard";
import { StatusTag } from "../../components/ui/StatusTag";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  createSystemUser,
  deleteSystemUser,
  fetchSystemRoles,
  fetchSystemUsers,
  updateSystemUser,
  type SystemUserPayload,
} from "../../services/systemManagement";
import type { SystemRoleRecord, SystemUserRecord } from "../../types/api";
import { SystemPageLayout } from "./SystemPageLayout";

export function SystemUserManagementPage() {
  const { token } = useAuth();
  const [records, setRecords] = useState<SystemUserRecord[]>([]);
  const [roles, setRoles] = useState<SystemRoleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SystemUserRecord | null>(null);
  const [form] = Form.useForm();

  const roleOptions = useMemo(
    () => roles.filter((item) => item.status === "active").map((item) => ({ value: item.id, label: item.roleName })),
    [roles]
  );

  const stats = useMemo(() => {
    const activeUsers = records.filter((item) => item.status === "active").length;
    const roleCount = new Set(records.map((item) => item.roleId).filter(Boolean)).size;
    return [
      { title: "用户总数", value: records.length, description: "平台已创建账号数", icon: <TeamOutlined /> },
      { title: "启用账号", value: activeUsers, description: "可正常登录与访问", icon: <UserAddOutlined /> },
      { title: "覆盖角色", value: roleCount, description: "当前已分配角色种类", icon: <BranchesOutlined /> },
      { title: "停用账号", value: Math.max(records.length - activeUsers, 0), description: "已停用的历史账号", icon: <ReloadOutlined /> },
    ];
  }, [records]);

  async function loadData() {
    if (!token) return;
    setLoading(true);
    try {
      const [usersResponse, rolesResponse] = await Promise.all([fetchSystemUsers(token), fetchSystemRoles(token)]);
      setRecords(usersResponse.data);
      setRoles(rolesResponse.data);
    } catch (error: any) {
      message.error(`加载用户管理失败: ${error.message || "未知错误"}`);
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
    form.setFieldsValue({ status: "active", roleId: roleOptions[0]?.value });
    setOpen(true);
  }

  function openEditModal(record: SystemUserRecord) {
    setEditingRecord(record);
    form.setFieldsValue({
      username: record.username,
      displayName: record.displayName,
      roleId: record.roleId,
      status: record.status,
      password: "",
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
      const payload: SystemUserPayload = {
        username: values.username,
        displayName: values.displayName,
        roleId: values.roleId,
        status: values.status,
        password: values.password || undefined,
      };

      setSubmitting(true);
      if (editingRecord) {
        await updateSystemUser(token, editingRecord.id, payload);
        message.success("用户更新成功");
      } else {
        await createSystemUser(token, payload);
        message.success("用户创建成功");
      }

      closeModal();
      await loadData();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(`保存用户失败: ${error.message || "未知错误"}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(record: SystemUserRecord) {
    if (!token) return;
    try {
      await deleteSystemUser(token, record.id);
      message.success("用户删除成功");
      await loadData();
    } catch (error: any) {
      message.error(`删除用户失败: ${error.message || "未知错误"}`);
    }
  }

  const columns: ColumnsType<SystemUserRecord> = [
    { title: "用户名", dataIndex: "username", key: "username", width: 180 },
    { title: "显示名称", dataIndex: "displayName", key: "displayName", width: 180 },
    {
      title: "角色",
      dataIndex: "roleName",
      key: "roleName",
      width: 180,
      render: (value: string | null, record) => value || record.roleCode,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value: string) => <StatusTag status={value} />,
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
              { key: "delete", label: "删除", danger: true },
            ],
            onClick: ({ key }) => {
              if (key === "edit") openEditModal(record);
              if (key === "delete") {
                Modal.confirm({
                  title: `确认删除用户“${record.displayName}”？`,
                  content: "删除后将无法恢复，请确认没有业务依赖。",
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
        title="用户管理"
        description="统一管理后台账号、角色绑定和可用状态，确保权限结构清晰且操作集中。"
        heroDescription="用户管理采用标准系统页框架：Hero 传达治理目标，KPI 快速反映账号规模，Tabs 统一系统页面导航。"
        heroBadges={["统一账号目录", "角色绑定清晰", "删除操作收纳"]}
        stats={stats}
        activeTab="users"
        hideHero
        toolbarRight={
          <>
            <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<UserAddOutlined />} onClick={openCreateModal}>
              新建用户
            </Button>
          </>
        }
      >
        <DataTableCard<SystemUserRecord>
          title="账号列表"
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
        title={editingRecord ? "编辑用户" : "新建用户"}
        onCancel={closeModal}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: "请输入用户名" },
              { min: 3, max: 64, message: "用户名长度需为 3-64 位" },
              { pattern: /^[a-zA-Z0-9_]+$/, message: "用户名仅支持字母、数字和下划线" },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="displayName"
            label="显示名称"
            rules={[
              { required: true, message: "请输入显示名称" },
              { min: 2, max: 64, message: "显示名称长度需为 2-64 位" },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="roleId" label="绑定角色" rules={[{ required: true, message: "请选择角色" }]}>
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item
            name="password"
            label={editingRecord ? "新密码" : "密码"}
            rules={[
              ...(editingRecord ? [] : [{ required: true, message: "请输入密码" }]),
              { min: 6, max: 64, message: "密码长度需为 6-64 位" },
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={[{ value: "active", label: "启用" }, { value: "inactive", label: "停用" }]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
