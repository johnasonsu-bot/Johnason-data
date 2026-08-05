import {
  ApartmentOutlined,
  DownloadOutlined,
  ImportOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  StarFilled,
  StarOutlined,
  TeamOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { Alert, Button, Descriptions, Drawer, Form, Input, InputNumber, Modal, Select, Space, Switch, Tag, Upload, message } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useProject } from "../../app/providers/ProjectProvider";
import { useAuth } from "../../app/providers/AuthProvider";
import { DataTableCard } from "../../components/ui/DataTableCard";
import { StatusTag } from "../../components/ui/StatusTag";
import {
  createProject,
  createProjectAssetBackup,
  deleteProject,
  exportProjectAssets,
  fetchProjectDetail,
  fetchProjects,
  importProjectAssets,
  previewProjectAssetImport,
  removeProjectMember,
  setDefaultProject,
  updateProject,
  updateProjectStatus,
  upsertProjectMember,
  type ProjectMemberPayload,
  type ProjectSpacePayload,
} from "../../services/projects";
import { fetchSystemUsers } from "../../services/systemManagement";
import type { ProjectMemberRecord, ProjectSpaceDetail, ProjectSpaceRecord, SystemUserRecord } from "../../types/api";
import { SystemPageLayout } from "./SystemPageLayout";

type ProjectFormValues = {
  projectName: string;
  projectCode: string;
  projectType: ProjectSpaceRecord["projectType"];
  description?: string;
  ownerUserId?: number;
  status: ProjectSpaceRecord["status"];
  maxDataSources?: number;
  maxConcurrentTasks?: number;
  schedulerEnabled?: boolean;
  defaultStoragePath?: string;
};

const projectTypeOptions = [
  { value: "standard", label: "标准项目" },
  { value: "production", label: "生产项目" },
  { value: "sandbox", label: "沙箱项目" },
  { value: "demo", label: "演示项目" },
  { value: "government_data_project", label: "政务数据项目" },
];

const projectRoleOptions = [
  { value: "owner", label: "项目负责人" },
  { value: "developer", label: "开发成员" },
  { value: "operator", label: "运维成员" },
  { value: "viewer", label: "只读成员" },
];

function buildPayload(values: ProjectFormValues, users: SystemUserRecord[]): ProjectSpacePayload {
  const owner = users.find((item) => item.id === values.ownerUserId) || null;
  return {
    projectName: values.projectName,
    projectCode: values.projectCode,
    projectType: values.projectType || "standard",
    description: values.description || "",
    ownerUserId: values.ownerUserId || null,
    ownerName: owner?.displayName || "",
    status: values.status || "active",
    resourceConfig: {
      maxDataSources: values.maxDataSources || 0,
      maxConcurrentTasks: values.maxConcurrentTasks || 0,
      schedulerEnabled: values.schedulerEnabled !== false,
    },
    settings: {
      defaultStoragePath: values.defaultStoragePath || "",
    },
  };
}

export function SystemProjectManagementPage() {
  const { token } = useAuth();
  const { refreshProjects } = useProject();
  const [records, setRecords] = useState<ProjectSpaceRecord[]>([]);
  const [defaultProjectId, setDefaultProjectId] = useState<number | null>(null);
  const [users, setUsers] = useState<SystemUserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ProjectSpaceRecord | null>(null);
  const [detail, setDetail] = useState<ProjectSpaceDetail | null>(null);
  const [memberSubmitting, setMemberSubmitting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Awaited<ReturnType<typeof previewProjectAssetImport>>["data"] | null>(null);
  const [importMode, setImportMode] = useState<"new" | "overwrite">("new");
  const [importTargetProjectId, setImportTargetProjectId] = useState<number | null>(null);
  const [importProjectName, setImportProjectName] = useState("");
  const [importProjectCode, setImportProjectCode] = useState("");
  const [importPackageKey, setImportPackageKey] = useState("");
  const [exportRecord, setExportRecord] = useState<ProjectSpaceRecord | null>(null);
  const [exportEncrypted, setExportEncrypted] = useState(false);
  const [exportPackageKey, setExportPackageKey] = useState("");
  const [modal, modalContextHolder] = Modal.useModal();
  const [form] = Form.useForm<ProjectFormValues>();
  const [memberForm] = Form.useForm<ProjectMemberPayload>();

  const userOptions = useMemo(
    () => users.filter((item) => item.status === "active").map((item) => ({ value: item.id, label: `${item.displayName}（${item.username}）` })),
    [users]
  );

  const stats = useMemo(() => {
    const activeCount = records.filter((item) => item.status === "active").length;
    const memberTotal = records.reduce((sum, item) => sum + Number(item.memberCount || 0), 0);
    return [
      { title: "项目总数", value: records.length, description: "当前平台项目空间", icon: <ApartmentOutlined /> },
      { title: "启用项目", value: activeCount, description: "可被用户选择进入", icon: <ReloadOutlined /> },
      { title: "成员绑定", value: memberTotal, description: "项目成员关系总数", icon: <TeamOutlined /> },
      { title: "停用项目", value: records.length - activeCount, description: "暂不可进入的空间", icon: <MoreOutlined /> },
    ];
  }, [records]);

  async function loadData() {
    if (!token) return;
    setLoading(true);
    try {
      const [projectsResponse, usersResponse] = await Promise.all([fetchProjects(token), fetchSystemUsers(token)]);
      setRecords(projectsResponse.data || []);
      setDefaultProjectId(Number(projectsResponse.meta?.defaultProjectId || 0) || null);
      setUsers(usersResponse.data || []);
    } catch (error: any) {
      message.error(`加载项目管理失败: ${error.message || "未知错误"}`);
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
    form.setFieldsValue({
      projectType: "standard",
      status: "active",
      schedulerEnabled: true,
      ownerUserId: userOptions[0]?.value,
    });
    setOpen(true);
  }

  function openEditModal(record: ProjectSpaceRecord) {
    setEditingRecord(record);
    form.setFieldsValue({
      projectName: record.projectName,
      projectCode: record.projectCode,
      projectType: record.projectType || "standard",
      description: record.description || "",
      ownerUserId: record.ownerUserId || undefined,
      status: record.status,
      maxDataSources: Number(record.resourceConfig?.maxDataSources || 0),
      maxConcurrentTasks: Number(record.resourceConfig?.maxConcurrentTasks || 0),
      schedulerEnabled: record.resourceConfig?.schedulerEnabled !== false,
      defaultStoragePath: String(record.settings?.defaultStoragePath || ""),
    });
    setOpen(true);
  }

  async function handleSubmit() {
    if (!token) return;
    try {
      const values = await form.validateFields();
      const payload = buildPayload(values, users);
      setSubmitting(true);
      if (editingRecord) {
        await updateProject(token, editingRecord.id, payload);
        message.success("项目更新成功");
      } else {
        await createProject(token, payload);
        message.success("项目创建成功");
      }
      setOpen(false);
      await loadData();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(`保存项目失败: ${error.message || "未知错误"}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function openMemberDrawer(record: ProjectSpaceRecord) {
    if (!token) return;
    try {
      const response = await fetchProjectDetail(token, record.id);
      setDetail(response.data);
      memberForm.resetFields();
      memberForm.setFieldsValue({ projectRole: "developer", status: "active", permissions: { modules: [] } });
    } catch (error: any) {
      message.error(`加载项目成员失败: ${error.message || "未知错误"}`);
    }
  }

  async function handleMemberSubmit() {
    if (!token || !detail) return;
    try {
      const values = await memberForm.validateFields();
      setMemberSubmitting(true);
      await upsertProjectMember(token, detail.id, values);
      const response = await fetchProjectDetail(token, detail.id);
      setDetail(response.data);
      memberForm.resetFields();
      memberForm.setFieldsValue({ projectRole: "developer", status: "active", permissions: { modules: [] } });
      message.success("成员保存成功");
      await loadData();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(`保存成员失败: ${error.message || "未知错误"}`);
      }
    } finally {
      setMemberSubmitting(false);
    }
  }

  async function handleRemoveMember(member: ProjectMemberRecord) {
    if (!token || !detail) return;
    try {
      await removeProjectMember(token, detail.id, member.userId);
      const response = await fetchProjectDetail(token, detail.id);
      setDetail(response.data);
      message.success("成员已移除");
      await loadData();
    } catch (error: any) {
      message.error(`移除成员失败: ${error.message || "未知错误"}`);
    }
  }

  async function handleExportProject(record: ProjectSpaceRecord) {
    setExportRecord(record);
    setExportEncrypted(false);
    setExportPackageKey("");
  }

  async function confirmExportProject() {
    if (!token || !exportRecord) return;
    if (exportEncrypted && exportPackageKey.length < 12) {
      message.warning("加密迁移口令至少需要 12 位");
      return;
    }
    try {
      await exportProjectAssets(token, exportRecord.id, {
        sensitiveMode: exportEncrypted ? "encrypted" : "desensitized",
        packageKey: exportEncrypted ? exportPackageKey : "",
      });
      message.success("项目资产包已开始下载");
      setExportRecord(null);
      await loadData();
    } catch (error: any) {
      message.error(`导出项目资产失败: ${error.message || "未知错误"}`);
    }
  }

  async function handleCreateProjectBackup(record: ProjectSpaceRecord) {
    if (!token) return;
    try {
      const response = await createProjectAssetBackup(token, record.id);
      message.success(`项目备份已创建，编号：${response.data.id}`);
    } catch (error: any) {
      message.error(`创建项目备份失败: ${error.message || "未知错误"}`);
    }
  }

  async function handleSetDefaultProject(record: ProjectSpaceRecord) {
    if (!token) return;
    try {
      const response = await setDefaultProject(token, record.id);
      setDefaultProjectId(response.data.defaultProjectId);
      await refreshProjects();
      message.success("默认项目已设置");
    } catch (error: any) {
      message.error(`设置默认项目失败: ${error.message || "未知错误"}`);
    }
  }

  async function handlePreviewImport(file: File) {
    if (!token) return false;
    setImportFile(file);
    setImportPreview(null);
    try {
      const response = await previewProjectAssetImport(token, file);
      setImportPreview(response.data);
      const sourceName = response.data.sourceProject?.name || "导入项目";
      const sourceCode = response.data.sourceProject?.code || "imported_project";
      setImportProjectName(`${sourceName}-导入`);
      setImportProjectCode(`${sourceCode}_import_${Date.now()}`.toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 64));
      message.success("资产包预检通过");
    } catch (error: any) {
      setImportFile(null);
      message.error(`资产包预检失败: ${error.message || "未知错误"}`);
    }
    return false;
  }

  async function handleImportProjectAssets() {
    if (!token || !importFile) {
      message.warning("请先选择项目资产包");
      return;
    }
    if (importMode === "overwrite" && !importTargetProjectId) {
      message.warning("覆盖导入需要选择目标项目");
      return;
    }
    if (importMode === "new" && !importProjectName.trim()) {
      message.warning("请输入新项目名称");
      return;
    }
    if (importMode === "new" && !/^[a-z0-9_]+$/.test(importProjectCode.trim())) {
      message.warning("项目编码仅支持小写字母、数字和下划线");
      return;
    }
    if (importPreview?.sensitiveMode === "encrypted" && importPackageKey.length < 12) {
      message.warning("该项目包包含加密敏感配置，请填写正确的迁移口令");
      return;
    }
    try {
      setImportSubmitting(true);
      const response = await importProjectAssets(token, importFile, {
        mode: importMode,
        targetProjectId: importTargetProjectId,
        targetProjectName: importProjectName.trim(),
        targetProjectCode: importProjectCode.trim(),
        packageKey: importPackageKey,
      });
      message.success(`导入完成，目标项目 ID：${response.data.projectId}`);
      setImportOpen(false);
      setImportFile(null);
      setImportPreview(null);
      setImportMode("new");
      setImportTargetProjectId(null);
      setImportProjectName("");
      setImportProjectCode("");
      setImportPackageKey("");
      await loadData();
      await refreshProjects();
    } catch (error: any) {
      message.error(`导入项目资产失败: ${error.message || "未知错误"}`);
    } finally {
      setImportSubmitting(false);
    }
  }

  function handleDeleteProject(record: ProjectSpaceRecord) {
    modal.confirm({
      title: "确认删除项目？",
      content: "删除后会一并清空该项目下所有项目隔离资产，包括成员、数据源、接入、质量、开发、标准、地图、服务、报表和数据建模内容，且不可恢复。",
      okText: "删除项目",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        if (!token) return;
        await deleteProject(token, record.id);
        if (detail?.id === record.id) {
          setDetail(null);
        }
        message.success("项目已删除");
        await loadData();
        await refreshProjects();
      },
    });
  }

  const columns: ColumnsType<ProjectSpaceRecord> = [
    { title: "项目名称", dataIndex: "projectName", key: "projectName", width: 180 },
    { title: "项目编码", dataIndex: "projectCode", key: "projectCode", width: 160 },
    {
      title: "类型",
      dataIndex: "projectType",
      key: "projectType",
      width: 120,
      render: (value: string) => projectTypeOptions.find((item) => item.value === value)?.label || value,
    },
    { title: "负责人", dataIndex: "ownerName", key: "ownerName", width: 140 },
    {
      title: "成员数",
      dataIndex: "memberCount",
      key: "memberCount",
      width: 100,
      render: (value: number) => Number(value || 0),
    },
    {
      title: "调度",
      key: "schedulerEnabled",
      width: 100,
      render: (_: unknown, record) => (
        <Tag color={record.resourceConfig?.schedulerEnabled === false ? "default" : "blue"}>
          {record.resourceConfig?.schedulerEnabled === false ? "关闭" : "开启"}
        </Tag>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (value: string) => <StatusTag status={value} />,
    },
    {
      title: "操作",
      key: "actions",
      width: 360,
      render: (_: unknown, record) => (
        <Space>
          <Button size="small" onClick={() => openEditModal(record)}>编辑</Button>
          <Button size="small" onClick={() => void openMemberDrawer(record)}>成员</Button>
          {record.id === defaultProjectId ? (
            <Button size="small" icon={<StarFilled />} disabled>默认</Button>
          ) : (
            <Button
              size="small"
              icon={<StarOutlined />}
              disabled={record.status !== "active"}
              onClick={() => void handleSetDefaultProject(record)}
            >
              设默认
            </Button>
          )}
          <Button size="small" icon={<DownloadOutlined />} onClick={() => void handleExportProject(record)}>导出</Button>
          <Button size="small" icon={<SaveOutlined />} onClick={() => void handleCreateProjectBackup(record)}>备份</Button>
          <Button
            size="small"
            disabled={record.projectCode === "default"}
            onClick={() => {
              modal.confirm({
                title: record.status === "active" ? "确认停用项目？" : "确认启用项目？",
                content: "状态变更后会影响用户是否能够进入该项目空间。",
                okText: "确认",
                cancelText: "取消",
                onOk: async () => {
                  if (!token) return;
                  await updateProjectStatus(token, record.id, record.status === "active" ? "inactive" : "active");
                  await loadData();
                },
              });
            }}
          >
            {record.status === "active" ? "停用" : "启用"}
          </Button>
          <Button size="small" danger disabled={record.projectCode === "default"} onClick={() => handleDeleteProject(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const memberColumns: ColumnsType<ProjectMemberRecord> = [
    { title: "成员", dataIndex: "displayName", key: "displayName", width: 160 },
    { title: "账号", dataIndex: "username", key: "username", width: 140 },
    {
      title: "项目角色",
      dataIndex: "projectRole",
      key: "projectRole",
      width: 130,
      render: (value: string) => projectRoleOptions.find((item) => item.value === value)?.label || value,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (value: string) => <StatusTag status={value} />,
    },
    {
      title: "操作",
      key: "actions",
      width: 100,
      render: (_: unknown, record) => (
        <Button size="small" danger disabled={detail?.projectCode === "default"} onClick={() => void handleRemoveMember(record)}>
          移除
        </Button>
      ),
    },
  ];

  return (
    <>
      {modalContextHolder}
      <SystemPageLayout
        title="项目管理"
        description="统一维护项目空间、项目成员和资源配置，项目切换后业务数据按空间隔离。"
        stats={stats}
        activeTab="projects"
        hideHero
        toolbarRight={
          <>
            <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>刷新</Button>
            <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>导入项目包</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>新建项目</Button>
          </>
        }
      >
        <DataTableCard<ProjectSpaceRecord>
          title="项目列表"
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
        title={editingRecord ? "编辑项目" : "新建项目"}
        onCancel={() => setOpen(false)}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        width={720}
        destroyOnHidden
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="projectName" label="项目名称" rules={[{ required: true, message: "请输入项目名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="projectCode"
            label="项目编码"
            rules={[
              { required: true, message: "请输入项目编码" },
              { pattern: /^[a-z0-9_]+$/, message: "项目编码仅支持小写字母、数字和下划线" },
            ]}
          >
            <Input disabled={editingRecord?.projectCode === "default"} />
          </Form.Item>
          <Form.Item name="projectType" label="项目类型" rules={[{ required: true, message: "请选择项目类型" }]}>
            <Select options={projectTypeOptions} />
          </Form.Item>
          <Form.Item name="ownerUserId" label="负责人">
            <Select allowClear showSearch optionFilterProp="label" options={userOptions} />
          </Form.Item>
          <Form.Item name="description" label="项目说明">
            <Input.TextArea rows={3} maxLength={1024} />
          </Form.Item>
          <Space align="start" size={16}>
            <Form.Item name="maxDataSources" label="数据源上限">
              <InputNumber min={0} precision={0} placeholder="不限" />
            </Form.Item>
            <Form.Item name="maxConcurrentTasks" label="任务并发上限">
              <InputNumber min={0} precision={0} placeholder="不限" />
            </Form.Item>
            <Form.Item name="schedulerEnabled" label="允许调度" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
          <Form.Item name="defaultStoragePath" label="默认存储路径">
            <Input placeholder="可选，例如 /data/projects/demo" />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={[{ value: "active", label: "启用" }, { value: "inactive", label: "停用" }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        open={Boolean(detail)}
        title={detail ? `项目成员：${detail.projectName}` : "项目成员"}
        width={760}
        onClose={() => setDetail(null)}
        destroyOnHidden
      >
        <Form layout="inline" form={memberForm} style={{ marginBottom: 16 }}>
          <Form.Item name="userId" rules={[{ required: true, message: "请选择用户" }]}>
            <Select placeholder="选择用户" style={{ width: 220 }} options={userOptions} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="projectRole" rules={[{ required: true, message: "请选择角色" }]}>
            <Select style={{ width: 140 }} options={projectRoleOptions} />
          </Form.Item>
          <Form.Item name="status" rules={[{ required: true, message: "请选择状态" }]}>
            <Select style={{ width: 110 }} options={[{ value: "active", label: "启用" }, { value: "inactive", label: "停用" }]} />
          </Form.Item>
          <Button type="primary" loading={memberSubmitting} onClick={() => void handleMemberSubmit()}>
            保存成员
          </Button>
        </Form>
        <DataTableCard<ProjectMemberRecord>
          title="成员列表"
          tableProps={{
            rowKey: "id",
            dataSource: detail?.members || [],
            columns: memberColumns,
            pagination: false,
          }}
        />
      </Drawer>

      <Modal
        open={importOpen}
        title="导入项目资产包"
        onCancel={() => {
          setImportOpen(false);
          setImportFile(null);
          setImportPreview(null);
          setImportMode("new");
          setImportTargetProjectId(null);
          setImportProjectName("");
          setImportProjectCode("");
          setImportPackageKey("");
        }}
        onOk={() => void handleImportProjectAssets()}
        okText="开始导入"
        confirmLoading={importSubmitting}
        width={720}
        destroyOnHidden
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Upload
            accept=".json,.medata-project.json"
            maxCount={1}
            beforeUpload={(file) => void handlePreviewImport(file)}
            onRemove={() => {
              setImportFile(null);
              setImportPreview(null);
            }}
            fileList={importFile ? [{ uid: "project-import", name: importFile.name, status: "done" } as UploadFile] : []}
          >
            <Button icon={<UploadOutlined />}>选择项目资产包</Button>
          </Upload>
          {importPreview && (
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="源项目">{importPreview.sourceProject?.name || "-"}</Descriptions.Item>
              <Descriptions.Item label="源项目编码">{importPreview.sourceProject?.code || "-"}</Descriptions.Item>
              <Descriptions.Item label="模块数">{importPreview.modules?.length || 0}</Descriptions.Item>
              <Descriptions.Item label="数据表数">{importPreview.tableCount}</Descriptions.Item>
              <Descriptions.Item label="资产记录数">{importPreview.rowCount}</Descriptions.Item>
              <Descriptions.Item label="项目包版本">{importPreview.packageVersion || "-"}</Descriptions.Item>
              <Descriptions.Item label="附件与知识文件">{importPreview.runtimeFileCount || 0} 个</Descriptions.Item>
              <Descriptions.Item label="完整性校验">{importPreview.integrityVerified ? "已通过" : "旧版兼容模式"}</Descriptions.Item>
              <Descriptions.Item label="敏感信息">
                {importPreview.sensitiveMode === "encrypted" ? "已加密（需迁移口令）" : "已脱敏"}
              </Descriptions.Item>
              <Descriptions.Item label="迁移范围" span={2}>
                {importPreview.coverage?.projectRuntimeFiles || importPreview.coverage?.externalPhysicalData
                  ? "配置资产及扩展数据"
                  : "配置资产（附件与外部业务数据需单独迁移）"}
              </Descriptions.Item>
            </Descriptions>
          )}
          {importPreview?.warnings?.map((warning) => <Alert key={warning} type="warning" showIcon message={warning} />)}
          <Form layout="vertical">
            {importPreview?.sensitiveMode === "encrypted" && (
              <Form.Item label="迁移口令" required extra="口令仅用于本次解密，不会保存到平台。">
                <Input.Password value={importPackageKey} onChange={(event) => setImportPackageKey(event.target.value)} placeholder="请输入导出时设置的迁移口令" />
              </Form.Item>
            )}
            <Form.Item label="导入模式">
              <Select
                value={importMode}
                onChange={(value) => setImportMode(value)}
                options={[
                  { value: "new", label: "新建项目导入" },
                  { value: "overwrite", label: "覆盖已有项目" },
                ]}
              />
            </Form.Item>
            {importMode === "new" && (
              <>
                <Form.Item label="新项目名称" required>
                  <Input
                    value={importProjectName}
                    onChange={(event) => setImportProjectName(event.target.value)}
                    placeholder="请输入导入后项目名称"
                  />
                </Form.Item>
                <Form.Item label="新项目编码" required>
                  <Input
                    value={importProjectCode}
                    onChange={(event) => setImportProjectCode(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 64))}
                    placeholder="例如 gov_platform_import"
                  />
                </Form.Item>
              </>
            )}
            {importMode === "overwrite" && (
              <Form.Item label="目标项目">
                <Select
                  value={importTargetProjectId || undefined}
                  onChange={(value) => setImportTargetProjectId(Number(value))}
                  placeholder="请选择要覆盖的项目"
                  options={records.map((item) => ({ value: item.id, label: `${item.projectName}（${item.projectCode}）`, disabled: item.projectCode === "default" }))}
                />
              </Form.Item>
            )}
          </Form>
        </Space>
      </Modal>

      <Modal
        open={Boolean(exportRecord)}
        title={`导出项目资产包${exportRecord ? `：${exportRecord.projectName}` : ""}`}
        onCancel={() => setExportRecord(null)}
        onOk={() => void confirmExportProject()}
        okText="开始导出"
        destroyOnHidden
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Alert type="info" showIcon message="默认导出会脱敏连接口令、密钥和 Token；附件与知识文件会一并写入项目包。" />
          <Form layout="vertical">
            <Form.Item label="迁移敏感配置" extra="启用后采用 AES-256-GCM 加密，导入时必须输入同一口令。">
              <Switch checked={exportEncrypted} onChange={setExportEncrypted} checkedChildren="加密迁移" unCheckedChildren="脱敏导出" />
            </Form.Item>
            {exportEncrypted && (
              <Form.Item label="迁移口令" required>
                <Input.Password value={exportPackageKey} onChange={(event) => setExportPackageKey(event.target.value)} placeholder="至少 12 位，请妥善保管" />
              </Form.Item>
            )}
          </Form>
        </Space>
      </Modal>
    </>
  );
}
