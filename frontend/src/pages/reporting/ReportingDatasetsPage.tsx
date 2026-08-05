import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FolderAddOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tree,
  TreeSelect,
  Typography,
  message,
} from "antd";
import type { MenuProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { DataNode } from "antd/es/tree";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { DataTableCard } from "../../components/ui/DataTableCard";
import { PageToolbar } from "../../components/ui/PageToolbar";
import {
  createReportingDatasetFolder,
  createReportingDataset,
  deleteReportingDatasetFolder,
  deleteReportingDataset,
  fetchReportingDatasetFolders,
  fetchReportingDataSourceTables,
  fetchReportingDataSources,
  fetchReportingDatasets,
  previewReportingDataset,
  updateReportingDatasetFolder,
  updateReportingDataset,
} from "../../services/reporting";
import type {
  ReportingDataSourceRecord,
  ReportingDatasetFieldRecord,
  ReportingDatasetFolderRecord,
  ReportingDatasetPreview,
  ReportingDatasetRecord,
} from "../../types/api";

function formatTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function buildDraftDatasetCode() {
  const timestampPart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `rpt_ds_${timestampPart}_${randomPart}`;
}

function buildFolderChildrenMap(folders: ReportingDatasetFolderRecord[]) {
  const map = new Map<number | null, ReportingDatasetFolderRecord[]>();
  folders.forEach((folder) => {
    const parentId = folder.parentId ?? null;
    const siblings = map.get(parentId) || [];
    siblings.push(folder);
    map.set(parentId, siblings);
  });
  return map;
}

function collectDescendantFolderIds(folderId: number, childrenMap: Map<number | null, ReportingDatasetFolderRecord[]>) {
  const result: number[] = [];
  const stack = [folderId];
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    result.push(currentId);
    const children = childrenMap.get(currentId) || [];
    children.forEach((child) => {
      stack.push(child.id);
    });
  }
  return result;
}

type FolderTreeNode = DataNode & {
  folderId: number;
};

function readFolderTreeNodeId(node: { key: string | number | bigint; folderId?: number }) {
  return Number(node.folderId ?? node.key);
}

function buildFolderTreeNodes(
  folders: ReportingDatasetFolderRecord[],
  countMap: Map<number, number>,
  actions: {
    onCreateChild: (folder: ReportingDatasetFolderRecord) => void;
    onRename: (folder: ReportingDatasetFolderRecord) => void;
    onDelete: (folder: ReportingDatasetFolderRecord) => void;
  },
): FolderTreeNode[] {
  const nodeMap = new Map<string, FolderTreeNode & { children: FolderTreeNode[] }>();
  const roots: Array<FolderTreeNode & { children: FolderTreeNode[] }> = [];

  folders.forEach((folder) => {
    const menuItems: MenuProps["items"] = [
      { key: "create-child", icon: <FolderAddOutlined />, label: "创建子目录" },
      { key: "rename", icon: <EditOutlined />, label: "重命名" },
      { key: "delete", icon: <DeleteOutlined />, danger: true, label: "删除" },
    ];

    nodeMap.set(String(folder.id), {
      key: String(folder.id),
      folderId: folder.id,
      title: (
        <Dropdown
          trigger={["contextMenu"]}
          menu={{
            items: menuItems,
            onClick: ({ key, domEvent }) => {
              domEvent.preventDefault();
              if (key === "create-child") {
                actions.onCreateChild(folder);
                return;
              }
              if (key === "rename") {
                actions.onRename(folder);
                return;
              }
              if (key === "delete") {
                actions.onDelete(folder);
              }
            },
          }}
        >
          <div className="reporting-datasets-nav__node-title">
            <Space size={8}>
              <span>{folder.folderName}</span>
              <Typography.Text type="secondary">{countMap.get(folder.id) || 0}</Typography.Text>
            </Space>
          </div>
        </Dropdown>
      ),
      children: [],
    });
  });

  folders.forEach((folder) => {
    const current = nodeMap.get(String(folder.id))!;
    if (folder.parentId && nodeMap.has(String(folder.parentId))) {
      nodeMap.get(String(folder.parentId))!.children.push(current);
    } else {
      roots.push(current);
    }
  });

  return roots;
}

function buildFolderSelectTree(
  folders: ReportingDatasetFolderRecord[],
  disabledIds: number[] = [],
): Array<{ title: string; value: number; key: string; disabled?: boolean; children?: any[] }> {
  const disabledIdSet = new Set(disabledIds);
  const nodeMap = new Map<string, { title: string; value: number; key: string; disabled?: boolean; children: any[] }>();
  const roots: Array<{ title: string; value: number; key: string; disabled?: boolean; children: any[] }> = [];

  folders.forEach((folder) => {
    nodeMap.set(String(folder.id), {
      title: folder.folderName,
      value: folder.id,
      key: String(folder.id),
      disabled: disabledIdSet.has(folder.id),
      children: [],
    });
  });

  folders.forEach((folder) => {
    const current = nodeMap.get(String(folder.id))!;
    if (folder.parentId && nodeMap.has(String(folder.parentId))) {
      nodeMap.get(String(folder.parentId))!.children.push(current);
    } else {
      roots.push(current);
    }
  });

  return roots;
}

export function ReportingDatasetsPage() {
  const { token } = useAuth();
  const [form] = Form.useForm();
  const [folderForm] = Form.useForm();
  const datasetType = Form.useWatch("datasetType", form) as "table" | "sql" | undefined;
  const sourceId = Form.useWatch("sourceId", form) as number | undefined;

  const [records, setRecords] = useState<ReportingDatasetRecord[]>([]);
  const [sources, setSources] = useState<ReportingDataSourceRecord[]>([]);
  const [folders, setFolders] = useState<ReportingDatasetFolderRecord[]>([]);
  const [sourceTables, setSourceTables] = useState<Array<{ tableName: string }>>([]);
  const [preview, setPreview] = useState<ReportingDatasetPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ReportingDatasetRecord | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ReportingDatasetFolderRecord | null>(null);
  const [folderSubmitting, setFolderSubmitting] = useState(false);

  async function loadData() {
    if (!token) return;
    setLoading(true);
    try {
      const [datasetRes, sourceRes, folderRes] = await Promise.all([
        fetchReportingDatasets(token),
        fetchReportingDataSources(token),
        fetchReportingDatasetFolders(token),
      ]);
      const nextRecords = datasetRes.data || [];
      const nextSources = sourceRes.data || [];
      const nextFolders = folderRes.data || [];
      setRecords(nextRecords);
      setSources(nextSources);
      setFolders(nextFolders);
      setSelectedFolderId((current) => (current != null && !nextFolders.some((item) => item.id === current) ? null : current));
    } catch (error: any) {
      message.error(`加载数据集失败: ${error.message || "未知错误"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  useEffect(() => {
    if (!token || !sourceId || datasetType !== "table") {
      setSourceTables([]);
      return undefined;
    }
    let active = true;
    void fetchReportingDataSourceTables(token, sourceId)
      .then((response) => {
        if (active) {
          setSourceTables(response.data || []);
        }
      })
      .catch(() => {
        if (active) {
          setSourceTables([]);
        }
      });
    return () => {
      active = false;
    };
  }, [datasetType, sourceId, token]);

  const activeSourceOptions = useMemo(() => sources.filter((item) => item.status === "active").map((item) => ({
    label: `${item.sourceName} (${item.sourceType})`,
    value: item.id,
  })), [sources]);

  const folderChildrenMap = useMemo(() => buildFolderChildrenMap(folders), [folders]);
  const folderMap = useMemo(
    () => new Map(folders.map((item) => [item.id, item])),
    [folders],
  );

  const folderDatasetCountMap = useMemo(() => {
    const directCountMap = new Map<number, number>();
    records.forEach((record) => {
      if (record.folderId != null) {
        directCountMap.set(record.folderId, (directCountMap.get(record.folderId) || 0) + 1);
      }
    });

    const totalCountMap = new Map<number, number>();
    const countFolder = (folderId: number) => {
      if (totalCountMap.has(folderId)) {
        return totalCountMap.get(folderId)!;
      }
      let total = directCountMap.get(folderId) || 0;
      const children = folderChildrenMap.get(folderId) || [];
      children.forEach((child) => {
        total += countFolder(child.id);
      });
      totalCountMap.set(folderId, total);
      return total;
    };

    folders.forEach((folder) => {
      countFolder(folder.id);
    });

    return totalCountMap;
  }, [folderChildrenMap, folders, records]);

  const selectedFolder = useMemo(
    () => folders.find((item) => item.id === selectedFolderId) || null,
    [folders, selectedFolderId],
  );

  const selectedFolderDescendantIds = useMemo(() => {
    if (selectedFolderId == null) {
      return new Set<number>();
    }
    return new Set(collectDescendantFolderIds(selectedFolderId, folderChildrenMap));
  }, [folderChildrenMap, selectedFolderId]);

  const filteredRecords = useMemo(() => records.filter((item) => {
    const matchesKeyword = !keyword || `${item.datasetName} ${item.sourceName || ""} ${item.folderName || ""}`.toLowerCase().includes(keyword.toLowerCase());
    const matchesFolder = selectedFolderId == null
      ? true
      : item.folderId != null && selectedFolderDescendantIds.has(item.folderId);
    return matchesKeyword && matchesFolder;
  }), [keyword, records, selectedFolderDescendantIds, selectedFolderId]);

  const folderTreeData = useMemo<DataNode[]>(() => [
    ...buildFolderTreeNodes(folders, folderDatasetCountMap, {
      onCreateChild: openCreateChildFolder,
      onRename: openRenameFolder,
      onDelete: confirmDeleteFolder,
    }),
  ], [confirmDeleteFolder, folderDatasetCountMap, folders, openCreateChildFolder, openRenameFolder]);

  const folderSelectTreeData = useMemo(
    () => buildFolderSelectTree(folders),
    [folders],
  );

  const folderParentTreeData = useMemo(
    () => buildFolderSelectTree(folders, editingFolder ? [editingFolder.id] : []),
    [editingFolder, folders],
  );

  function resetModal() {
    form.resetFields();
    setEditingRecord(null);
    setPreview(null);
    setSourceTables([]);
  }

  function resetFolderModal() {
    folderForm.resetFields();
    setEditingFolder(null);
  }

  function closeModal() {
    setOpen(false);
    resetModal();
  }

  function closeFolderModal() {
    setFolderModalOpen(false);
    resetFolderModal();
  }

  function openCreateModal() {
    resetModal();
    form.setFieldsValue({
      datasetType: "table",
      folderId: selectedFolderId,
      ownerName: "报表分析师",
      status: "draft",
    });
    setOpen(true);
  }

  function openEditModal(record: ReportingDatasetRecord) {
    resetModal();
    setEditingRecord(record);
    form.setFieldsValue({
      datasetName: record.datasetName,
      sourceId: record.sourceId,
      datasetType: record.datasetType,
      sourceTable: record.sourceTable,
      sourceSql: record.sourceSql,
      folderId: record.folderId ?? null,
      ownerName: record.ownerName,
      status: record.status,
      description: record.description,
    });
    setPreview({ fields: record.fields, sampleRows: [], rowCount: 0 });
    setOpen(true);
  }

  function openCreateFolderModal(parentId: number | null = null) {
    resetFolderModal();
    folderForm.setFieldsValue({
      folderName: "",
      parentId,
    });
    setFolderModalOpen(true);
  }

  function openEditFolderModal(folder: ReportingDatasetFolderRecord) {
    resetFolderModal();
    setEditingFolder(folder);
    folderForm.setFieldsValue({
      folderName: folder.folderName,
      parentId: folder.parentId ?? null,
    });
    setFolderModalOpen(true);
  }

  function openCreateChildFolder(folder: ReportingDatasetFolderRecord) {
    setSelectedFolderId(folder.id);
    openCreateFolderModal(folder.id);
  }

  function openRenameFolder(folder: ReportingDatasetFolderRecord) {
    setSelectedFolderId(folder.id);
    openEditFolderModal(folder);
  }

  function confirmDeleteFolder(folder: ReportingDatasetFolderRecord) {
    setSelectedFolderId(folder.id);
    Modal.confirm({
      title: `确认删除文件夹“${folder.folderName}”？`,
      content: "删除后子文件夹会转为顶级目录，已归属的数据集会变为未分组。",
      okText: "删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        await handleDeleteFolder(folder);
      },
    });
  }

  async function handlePreview() {
    if (!token) return;
    try {
      const values = await form.validateFields(datasetType === "sql"
        ? ["sourceId", "datasetType", "sourceSql"]
        : ["sourceId", "datasetType", "sourceTable"]);
      setPreviewLoading(true);
      const response = await previewReportingDataset(token, {
        sourceId: values.sourceId,
        datasetType: values.datasetType,
        sourceTable: values.sourceTable,
        sourceSql: values.sourceSql,
      });
      setPreview(response.data);
      message.success("数据集预览已更新");
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(`预览失败: ${error.message || "未知错误"}`);
      }
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSubmit() {
    if (!token) return;
    try {
      const values = await form.validateFields();
      const datasetCode = typeof editingRecord?.datasetCode === "string" && editingRecord.datasetCode.trim()
        ? editingRecord.datasetCode.trim()
        : buildDraftDatasetCode();
      const payload = {
        datasetName: values.datasetName,
        datasetCode,
        sourceId: values.sourceId,
        folderId: values.folderId ?? null,
        datasetType: values.datasetType,
        sourceTable: values.datasetType === "table" ? values.sourceTable : null,
        sourceSql: values.datasetType === "sql" ? values.sourceSql : null,
        ownerName: values.ownerName,
        status: values.status,
        description: typeof values.description === "string" ? values.description : undefined,
        fields: (preview?.fields || []) as ReportingDatasetFieldRecord[],
      };
      setSubmitting(true);
      if (editingRecord) {
        await updateReportingDataset(token, editingRecord.id, payload);
        message.success("数据集已更新");
      } else {
        await createReportingDataset(token, payload);
        message.success("数据集已创建");
      }
      closeModal();
      await loadData();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(`保存失败: ${error.message || "未知错误"}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFolderSubmit() {
    if (!token) return;
    try {
      const values = await folderForm.validateFields();
      const payload = {
        folderName: values.folderName,
        parentId: values.parentId ?? null,
      };
      setFolderSubmitting(true);
      const response = editingFolder
        ? await updateReportingDatasetFolder(token, editingFolder.id, payload)
        : await createReportingDatasetFolder(token, payload);
      setSelectedFolderId(response.data.id);
      message.success(editingFolder ? "文件夹已更新" : "文件夹已创建");
      closeFolderModal();
      await loadData();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(`保存文件夹失败: ${error.message || "未知错误"}`);
      }
    } finally {
      setFolderSubmitting(false);
    }
  }

  async function handleDeleteFolder(folder: ReportingDatasetFolderRecord) {
    if (!token) return;
    try {
      await deleteReportingDatasetFolder(token, folder.id);
      if (selectedFolderId === folder.id) {
        setSelectedFolderId(null);
      }
      message.success("文件夹已删除");
      await loadData();
    } catch (error: any) {
      message.error(`删除文件夹失败: ${error.message || "未知错误"}`);
    }
  }

  async function handleMoveFolder(folderId: number, parentId: number | null) {
    if (!token) return;
    try {
      const folder = folderMap.get(folderId);
      if (!folder) {
        return;
      }
      if ((folder.parentId ?? null) === parentId) {
        return;
      }
      await updateReportingDatasetFolder(token, folderId, {
        folderName: folder.folderName,
        parentId,
      });
      message.success("文件夹已移动");
      await loadData();
    } catch (error: any) {
      message.error(`移动文件夹失败: ${error.message || "未知错误"}`);
    }
  }

  function resolveFolderMoveParentId(dropFolderId: number, dropToGap: boolean) {
    if (!dropToGap) {
      return dropFolderId;
    }
    return folderMap.get(dropFolderId)?.parentId ?? null;
  }

  const columns: ColumnsType<ReportingDatasetRecord> = [
    { title: "名称", dataIndex: "datasetName", key: "datasetName", width: 130, ellipsis: true },
    {
      title: "文件夹",
      dataIndex: "folderName",
      key: "folderName",
      width: 128,
      ellipsis: true,
      render: (value?: string | null) => value || <Typography.Text type="secondary">未分组</Typography.Text>,
    },
    { title: "来源", dataIndex: "sourceName", key: "sourceName", width: 96, ellipsis: true },
    {
      title: "模式",
      dataIndex: "datasetType",
      key: "datasetType",
      width: 72,
      align: "center",
      render: (value: string) => <Tag color={value === "sql" ? "cyan" : "blue"}>{String(value).toUpperCase()}</Tag>,
    },
    { title: "字段数", key: "fieldCount", width: 64, align: "center", render: (_, record) => record.fields.length },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 82,
      align: "center",
      render: (value: string) => <Tag color={value === "active" ? "green" : value === "draft" ? "gold" : "default"}>{value}</Tag>,
    },
    { title: "更新时间", dataIndex: "updatedAt", key: "updatedAt", width: 140, ellipsis: true, render: (value: string) => formatTime(value) },
    {
      title: "操作",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <Space size={2}>
          <Button type="link" onClick={() => openEditModal(record)}>编辑</Button>
          <Button type="link" icon={<EyeOutlined />} onClick={() => openEditModal(record)}>查看</Button>
          <Button
            danger
            type="link"
            onClick={() => {
              Modal.confirm({
                title: `确认删除数据集“${record.datasetName}”？`,
                content: "删除后相关报表组件需要重新绑定。",
                okText: "删除",
                cancelText: "取消",
                okButtonProps: { danger: true },
                onOk: async () => {
                  if (!token) return;
                  try {
                    await deleteReportingDataset(token, record.id);
                    message.success("数据集已删除");
                    await loadData();
                  } catch (error: any) {
                    message.error(`删除失败: ${error.message || "未知错误"}`);
                  }
                },
              });
            }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="app-page reporting-datasets-page">
      <div className="app-page-body">
        <PageToolbar
          left={(
            <Space size={12}>
              <Input.Search allowClear className="toolbar-search" placeholder="搜索名称、来源、文件夹" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
              <Typography.Text type="secondary">
                {selectedFolder ? `当前文件夹：${selectedFolder.folderName}` : "当前范围：全部数据集"} · 结果 {filteredRecords.length} 条
              </Typography.Text>
            </Space>
          )}
          right={(
            <>
              <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>刷新</Button>
              <Button icon={<FolderAddOutlined />} onClick={() => openCreateFolderModal(null)}>新建文件夹</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>新建数据集</Button>
            </>
          )}
        />

        <div className="reporting-datasets-layout">
          <Card
            bordered={false}
            className="reporting-datasets-nav"
            title={(
              <div className="reporting-datasets-nav__card-title">
                <span>文件夹导航</span>
                <Typography.Text type="secondary">{folders.length} 个文件夹</Typography.Text>
              </div>
            )}
            extra={<Button size="small" type="primary" ghost icon={<FolderAddOutlined />} onClick={() => openCreateFolderModal(null)}>新建</Button>}
          >
            <div className="reporting-datasets-nav__tree">
              {folders.length === 0 ? (
                <Empty description="暂无文件夹，点击右上角创建" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Tree
                  blockNode
                  defaultExpandAll
                  draggable={{ icon: false }}
                  className="reporting-datasets-nav__tree-control"
                  selectedKeys={selectedFolderId == null ? [] : [String(selectedFolderId)]}
                  treeData={folderTreeData}
                  allowDrop={({ dragNode, dropNode, dropPosition }) => {
                    const dragFolderId = readFolderTreeNodeId(dragNode as FolderTreeNode);
                    const dropFolderId = readFolderTreeNodeId(dropNode as FolderTreeNode);
                    if (!Number.isFinite(dragFolderId) || !Number.isFinite(dropFolderId)) {
                      return false;
                    }
                    const draggedFolder = folderMap.get(dragFolderId);
                    if (!draggedFolder) {
                      return false;
                    }
                    const nextParentId = resolveFolderMoveParentId(dropFolderId, dropPosition !== 0);
                    if (dragFolderId === dropFolderId || (draggedFolder.parentId ?? null) === nextParentId) {
                      return false;
                    }
                    const descendantIds = new Set(collectDescendantFolderIds(dragFolderId, folderChildrenMap));
                    return nextParentId == null || !descendantIds.has(nextParentId);
                  }}
                  onSelect={(keys) => {
                    const nextKey = keys[0];
                    setSelectedFolderId(nextKey ? Number(nextKey) : null);
                  }}
                  onDrop={(info) => {
                    const dragFolderId = readFolderTreeNodeId(info.dragNode as unknown as FolderTreeNode);
                    const dropFolderId = readFolderTreeNodeId(info.node as unknown as FolderTreeNode);
                    if (!Number.isFinite(dragFolderId) || !Number.isFinite(dropFolderId)) {
                      return;
                    }
                    const draggedFolder = folderMap.get(dragFolderId);
                    if (!draggedFolder) {
                      return;
                    }
                    const nextParentId = resolveFolderMoveParentId(dropFolderId, info.dropToGap);
                    if (dragFolderId === dropFolderId || (draggedFolder.parentId ?? null) === nextParentId) {
                      return;
                    }
                    const descendantIds = new Set(collectDescendantFolderIds(dragFolderId, folderChildrenMap));
                    if (nextParentId != null && descendantIds.has(nextParentId)) {
                      return;
                    }
                    void handleMoveFolder(dragFolderId, nextParentId);
                  }}
                />
              )}
            </div>
          </Card>

          <DataTableCard<ReportingDatasetRecord>
            className="reporting-datasets-table-card"
            tableProps={{
              rowKey: "id",
              loading,
              columns,
              dataSource: filteredRecords,
              size: "middle",
              tableLayout: "fixed",
              pagination: { pageSize: 8, showSizeChanger: false },
              scroll: { x: "max-content" },
            }}
          />
        </div>
      </div>

      <Modal
        open={open}
        title={editingRecord ? "编辑数据集" : "新建数据集"}
        onCancel={closeModal}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        width={1180}
        destroyOnHidden
        footer={[
          <Button key="preview" icon={<EyeOutlined />} onClick={() => void handlePreview()} loading={previewLoading}>预览数据</Button>,
          <Button key="cancel" onClick={closeModal}>取消</Button>,
          <Button key="submit" type="primary" onClick={() => void handleSubmit()} loading={submitting}>
            {editingRecord ? "保存" : "创建"}
          </Button>,
        ]}
      >
        <Row gutter={16}>
          <Col span={10}>
            <Card size="small" title="数据集配置">
              <Form layout="vertical" form={form}>
                <Form.Item name="datasetName" label="数据集名称" rules={[{ required: true, message: "请输入名称" }]}><Input /></Form.Item>
                <Form.Item name="sourceId" label="报表数据源" rules={[{ required: true, message: "请选择报表数据源" }]}><Select options={activeSourceOptions} /></Form.Item>
                <Form.Item name="folderId" label="所属文件夹">
                  <TreeSelect
                    allowClear
                    treeDefaultExpandAll
                    treeData={folderSelectTreeData}
                    placeholder="未分组"
                  />
                </Form.Item>
                <Form.Item name="datasetType" label="数据集模式" rules={[{ required: true, message: "请选择模式" }]}><Radio.Group options={[{ value: "table", label: "表模式" }, { value: "sql", label: "SQL 模式" }]} /></Form.Item>
                {datasetType === "sql" ? (
                  <Form.Item name="sourceSql" label="查询 SQL" rules={[{ required: true, message: "请输入查询 SQL" }]}><Input.TextArea rows={8} placeholder="请输入 SELECT 或 WITH ... SELECT 查询 SQL" /></Form.Item>
                ) : (
                  <Form.Item name="sourceTable" label="数据表" rules={[{ required: true, message: "请选择数据表" }]}><Select options={sourceTables.map((item) => ({ label: item.tableName, value: item.tableName }))} /></Form.Item>
                )}
                <Form.Item name="ownerName" label="负责人" rules={[{ required: true, message: "请输入负责人" }]}><Input /></Form.Item>
                <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}><Select options={[{ value: "draft", label: "草稿" }, { value: "active", label: "启用" }, { value: "published", label: "已发布" }, { value: "inactive", label: "停用" }]} /></Form.Item>
                <Form.Item name="description" label="描述"><Input.TextArea rows={3} /></Form.Item>
              </Form>
            </Card>
          </Col>
          <Col span={14}>
            <Card size="small" title="字段与样例预览" extra={<Typography.Text type="secondary">{preview ? `样例 ${preview.rowCount} 行` : "点击“预览数据”生成字段定义"}</Typography.Text>}>
              <Space direction="vertical" size={12} style={{ display: "flex" }}>
                <Table
                  size="small"
                  rowKey="columnName"
                  dataSource={preview?.fields || []}
                  pagination={false}
                  columns={[
                    { title: "字段名", dataIndex: "columnName", key: "columnName", width: 180 },
                    { title: "显示名", dataIndex: "label", key: "label", width: 180 },
                    { title: "类型", dataIndex: "dataType", key: "dataType", width: 120 },
                    { title: "角色", dataIndex: "role", key: "role", width: 120 },
                  ]}
                  scroll={{ y: 180 }}
                  locale={{ emptyText: "暂无字段定义" }}
                />
                <Table
                  size="small"
                  rowKey={(_, index) => String(index)}
                  dataSource={preview?.sampleRows || []}
                  pagination={false}
                  columns={(preview?.fields || []).map((field) => ({
                    title: field.label || field.columnName,
                    dataIndex: field.columnName,
                    key: field.columnName,
                    width: 160,
                    render: (value: unknown) => value === null || value === undefined || value === "" ? "-" : String(value),
                  }))}
                  scroll={{ x: "max-content", y: 240 }}
                  locale={{ emptyText: "暂无样例数据" }}
                />
              </Space>
            </Card>
          </Col>
        </Row>
      </Modal>

      <Modal
        open={folderModalOpen}
        title={editingFolder ? "编辑文件夹" : "新建文件夹"}
        onCancel={closeFolderModal}
        onOk={() => void handleFolderSubmit()}
        confirmLoading={folderSubmitting}
        destroyOnHidden
      >
        <Form layout="vertical" form={folderForm}>
          <Form.Item name="folderName" label="文件夹名称" rules={[{ required: true, message: "请输入文件夹名称" }]}>
            <Input maxLength={128} placeholder="例如：营销专题、供应链分析" />
          </Form.Item>
          <Form.Item name="parentId" label="上级文件夹">
            <TreeSelect
              allowClear
              treeDefaultExpandAll
              treeData={folderParentTreeData}
              placeholder="根目录"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
