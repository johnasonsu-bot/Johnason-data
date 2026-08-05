import {
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { DataTableCard } from "../../components/ui/DataTableCard";
import { PageToolbar } from "../../components/ui/PageToolbar";
import {
  createReportingChartAsset,
  deleteReportingChartAsset,
  fetchReportingChartAssets,
  updateReportingChartAsset,
} from "../../services/reporting";
import type { ReportingChartAssetRecord } from "../../types/api";

function formatTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value || {}, null, 2);
  } catch (error) {
    return "{}";
  }
}

export function ReportingChartLibraryPage() {
  const { token } = useAuth();
  const [form] = Form.useForm();
  const [records, setRecords] = useState<ReportingChartAssetRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ReportingChartAssetRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [keyword, setKeyword] = useState("");

  async function loadData() {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetchReportingChartAssets(token);
      setRecords(response.data || []);
    } catch (error: any) {
      message.error(`加载图表库失败: ${error.message || "未知错误"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  const filteredRecords = useMemo(() => records.filter((item) => {
    return !keyword || `${item.chartName} ${item.chartCode} ${(item.tags || []).join(" ")}`.toLowerCase().includes(keyword.toLowerCase());
  }), [keyword, records]);

  function closeModal() {
    setOpen(false);
    setEditingRecord(null);
    form.resetFields();
  }

  function openCreateModal() {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      chartType: "echarts",
      category: "custom",
      renderMode: "dataset",
      ownerName: "报表分析师",
      status: "draft",
      tagsText: "",
      isBuiltin: "false",
      configText: "{}",
      optionTemplateText: JSON.stringify({
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: [] },
        yAxis: { type: "value" },
        series: [{ type: "bar", data: [] }],
      }, null, 2),
      mappingSchemaText: JSON.stringify({
        fields: [
          { key: "xField", label: "分类字段", required: true },
          { key: "yField", label: "指标字段", required: true },
        ],
      }, null, 2),
    });
    setOpen(true);
  }

  function openEditModal(record: ReportingChartAssetRecord) {
    setEditingRecord(record);
    form.setFieldsValue({
      chartName: record.chartName,
      chartCode: record.chartCode,
      chartType: record.chartType,
      category: record.category,
      renderMode: record.renderMode,
      coverImageUrl: record.coverImageUrl,
      description: record.description,
      ownerName: record.ownerName,
      status: record.status,
      tagsText: (record.tags || []).join(", "),
      isBuiltin: record.isBuiltin ? "true" : "false",
      configText: prettyJson(record.config),
      optionTemplateText: prettyJson(record.optionTemplate),
      mappingSchemaText: prettyJson(record.mappingSchema),
    });
    setOpen(true);
  }

  async function handleSubmit() {
    if (!token) return;
    try {
      const values = await form.validateFields();
      const payload = {
        chartName: values.chartName,
        chartCode: values.chartCode,
        chartType: values.chartType,
        category: values.category,
        renderMode: values.renderMode,
        coverImageUrl: values.coverImageUrl || null,
        description: values.description || null,
        ownerName: values.ownerName,
        status: values.status,
        isBuiltin: values.isBuiltin === "true",
        tags: String(values.tagsText || "").split(",").map((item: string) => item.trim()).filter(Boolean),
        config: JSON.parse(values.configText || "{}"),
        optionTemplate: JSON.parse(values.optionTemplateText || "{}"),
        mappingSchema: JSON.parse(values.mappingSchemaText || "{}"),
      };
      setSubmitting(true);
      if (editingRecord) {
        await updateReportingChartAsset(token, editingRecord.id, payload);
        message.success("图表资产已更新");
      } else {
        await createReportingChartAsset(token, payload);
        message.success("图表资产已创建");
      }
      closeModal();
      await loadData();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(`保存失败: ${error.message || "请检查 JSON 配置格式"}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const columns: ColumnsType<ReportingChartAssetRecord> = [
    { title: "名称", dataIndex: "chartName", key: "chartName", width: 180 },
    { title: "编码", dataIndex: "chartCode", key: "chartCode", width: 180 },
    { title: "分类", dataIndex: "category", key: "category", width: 120 },
    { title: "渲染模式", dataIndex: "renderMode", key: "renderMode", width: 120 },
    {
      title: "标签",
      key: "tags",
      width: 220,
      render: (_, record) => (
        <Space wrap size={[4, 4]}>
          {(record.tags || []).slice(0, 4).map((tag) => <Tag key={tag}>{tag}</Tag>)}
        </Space>
      ),
    },
    { title: "状态", dataIndex: "status", key: "status", width: 120, render: (value: string) => <Tag color={value === "active" ? "green" : value === "draft" ? "gold" : "default"}>{value}</Tag> },
    { title: "更新时间", dataIndex: "updatedAt", key: "updatedAt", width: 180, render: (value: string) => formatTime(value) },
    {
      title: "操作",
      key: "actions",
      width: 220,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => openEditModal(record)}>编辑</Button>
          {!record.isBuiltin ? (
            <Button
              danger
              type="link"
              onClick={() => {
                Modal.confirm({
                  title: `确认删除图表“${record.chartName}”？`,
                  content: "删除后画布中引用该资产的部件需要重新绑定。",
                  okText: "删除",
                  cancelText: "取消",
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    if (!token) return;
                    try {
                      await deleteReportingChartAsset(token, record.id);
                      message.success("图表资产已删除");
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
          ) : <Tag color="blue">内置</Tag>}
        </Space>
      ),
    },
  ];

  return (
    <div className="app-page">
      <div className="app-page-body">
        <PageToolbar
          left={<Input.Search allowClear className="toolbar-search" placeholder="搜索图表名称、编码、标签" value={keyword} onChange={(event) => setKeyword(event.target.value)} />}
          right={(
            <>
              <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>刷新</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>新增图表资产</Button>
            </>
          )}
        />
        <DataTableCard<ReportingChartAssetRecord>
          title="图表资产目录"
          extra={<Typography.Text type="secondary">共 {filteredRecords.length} 条记录</Typography.Text>}
          tableProps={{
            rowKey: "id",
            loading,
            columns,
            dataSource: filteredRecords,
            pagination: { pageSize: 8, showSizeChanger: false },
            scroll: { x: 1560 },
          }}
        />
      </div>

      <Modal
        open={open}
        title={editingRecord ? "编辑图表资产" : "新增图表资产"}
        onCancel={closeModal}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        width={1120}
        destroyOnHidden
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="chartName" label="图表名称" rules={[{ required: true, message: "请输入图表名称" }]}><Input /></Form.Item>
          <Form.Item name="chartCode" label="图表编码" rules={[{ required: true, message: "请输入图表编码" }]}><Input /></Form.Item>
          <Form.Item name="chartType" label="图表类型" rules={[{ required: true, message: "请选择图表类型" }]}><Select options={[{ value: "echarts", label: "ECharts" }]} /></Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: "请输入分类" }]}><Input /></Form.Item>
          <Form.Item name="renderMode" label="渲染模式" rules={[{ required: true, message: "请选择渲染模式" }]}><Select options={[{ value: "dataset", label: "数据集驱动" }, { value: "static", label: "静态配置" }]} /></Form.Item>
          <Form.Item name="ownerName" label="负责人" rules={[{ required: true, message: "请输入负责人" }]}><Input /></Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}><Select options={[{ value: "draft", label: "草稿" }, { value: "active", label: "启用" }, { value: "inactive", label: "停用" }]} /></Form.Item>
          <Form.Item name="isBuiltin" label="是否内置" rules={[{ required: true, message: "请选择是否内置" }]}><Select options={[{ value: "false", label: "否" }, { value: "true", label: "是" }]} /></Form.Item>
          <Form.Item name="tagsText" label="标签"><Input placeholder="使用逗号分隔，例如 bar, compare, sales" /></Form.Item>
          <Form.Item name="description" label="描述"><Input /></Form.Item>
          <Form.Item name="configText" label="基础配置 JSON" rules={[{ required: true, message: "请输入基础配置 JSON" }]}><Input.TextArea rows={6} /></Form.Item>
          <Form.Item name="optionTemplateText" label="ECharts Option 模板 JSON" rules={[{ required: true, message: "请输入 Option 模板 JSON" }]}><Input.TextArea rows={10} /></Form.Item>
          <Form.Item name="mappingSchemaText" label="字段映射 Schema JSON" rules={[{ required: true, message: "请输入映射 Schema JSON" }]}><Input.TextArea rows={6} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
