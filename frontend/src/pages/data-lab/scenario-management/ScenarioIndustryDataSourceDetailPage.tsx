import { Alert, Button, Card, Descriptions, Drawer, Empty, Popconfirm, Space, Spin, Statistic, Table, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  deleteIndustryDataSource,
  fetchIndustryDataSourceDetail,
  fetchIndustryDataSourceSharedEntityDetail,
  rebuildIndustryDataSourcePreview,
} from "../../../services/dataLab";
import type {
  LabIndustryDataSourceRecord,
  LabIndustryDataSourceSharedEntityDetailRecord,
  LabIndustryDataSourceSharedEntityRecord,
} from "../../../types/api";

const STATUS_META: Record<string, { color: string; label: string }> = {
  draft: { color: "default", label: "草稿" },
  active: { color: "processing", label: "启用" },
  archived: { color: "gold", label: "归档" },
};

const THEME_META: Record<string, { color: string; label: string }> = {
  user: { color: "blue", label: "用户身份" },
  merchant: { color: "green", label: "经营主体" },
  activity: { color: "purple", label: "业务活动" },
};

const MATCH_METHOD_META: Record<string, string> = {
  phone: "手机号",
  email: "邮箱",
  id_card: "证件号",
  name: "名称",
  code: "编码",
  synthetic_slot: "槽位兜底",
};

const ASSEMBLY_STATUS_META: Record<string, { color: string; label: string }> = {
  ready: { color: "success", label: "可联动" },
  pending_generation: { color: "warning", label: "缺少样本方案" },
  load_failed: { color: "error", label: "加载失败" },
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return String(value).replace("T", " ").replace(/\.\d+Z?$/, "");
}

function toNumber(value: unknown) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

function renderThemes(values: string[]) {
  if (!Array.isArray(values) || values.length === 0) return "-";
  return (
    <Space size={[4, 4]} wrap>
      {values.map((item) => {
        const meta = THEME_META[item] || { color: "default", label: item };
        return <Tag key={item} color={meta.color}>{meta.label}</Tag>;
      })}
    </Space>
  );
}

function renderAttributes(values: Array<{ fieldName: string; value: string }>) {
  if (!Array.isArray(values) || values.length === 0) return "-";
  return (
    <Space size={[4, 4]} wrap>
      {values.map((item) => (
        <Tag key={`${item.fieldName}_${item.value}`}>
          {item.fieldName}: {item.value}
        </Tag>
      ))}
    </Space>
  );
}

function renderAssemblyStatus(value?: string) {
  if (!value) return "-";
  const meta = ASSEMBLY_STATUS_META[value] || { color: "default", label: value };
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

export function ScenarioIndustryDataSourceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const dataSourceId = Number(id || 0);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingDataSource, setDeletingDataSource] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [entityLoading, setEntityLoading] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<LabIndustryDataSourceRecord | null>(null);
  const [entityDetail, setEntityDetail] = useState<LabIndustryDataSourceSharedEntityDetailRecord | null>(null);

  async function loadDetail() {
    if (!token || !dataSourceId) return;
    setLoading(true);
    try {
      const response = await fetchIndustryDataSourceDetail(token, dataSourceId);
      setDataSource(response.data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载联动数据集详情失败");
    } finally {
      setLoading(false);
    }
  }

  async function openEntityDrawer(entity: LabIndustryDataSourceSharedEntityRecord) {
    if (!token || !dataSourceId) return;
    setDrawerOpen(true);
    setSelectedEntityId(entity.entityId);
    setEntityLoading(true);
    try {
      const response = await fetchIndustryDataSourceSharedEntityDetail(token, dataSourceId, entity.entityId);
      setEntityDetail(response.data);
    } catch (error) {
      setDrawerOpen(false);
      setSelectedEntityId(null);
      setEntityDetail(null);
      message.error(error instanceof Error ? error.message : "加载共享实体详情失败");
    } finally {
      setEntityLoading(false);
    }
  }

  async function handleRefresh() {
    if (!token || !dataSourceId) return;
    setRefreshing(true);
    try {
      const response = await rebuildIndustryDataSourcePreview(token, dataSourceId);
      setDataSource(response.data);
      setDrawerOpen(false);
      setSelectedEntityId(null);
      setEntityDetail(null);
      message.success("联动数据集预览已刷新");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "刷新联动数据集预览失败");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDeleteDataSource() {
    if (!token || !dataSourceId || !dataSource) return;
    setDeletingDataSource(true);
    try {
      const response = await deleteIndustryDataSource(token, dataSourceId);
      message.success(`已删除联动数据集：${response.data.dataSourceName}`);
      navigate("/dashboard/data-modeling/simulation");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除联动数据集失败");
    } finally {
      setDeletingDataSource(false);
    }
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setSelectedEntityId(null);
    setEntityDetail(null);
  }

  function jumpToInstance(instanceId: number, tab?: "plan" | "dirty" | "quality") {
    const search = tab ? `?tab=${tab}` : "";
    navigate(`/dashboard/data-modeling/simulation/instances/${instanceId}${search}`);
  }

  useEffect(() => {
    void loadDetail();
  }, [token, dataSourceId]);

  const linkagePreview = dataSource?.linkagePreview || null;
  const summary = linkagePreview?.summary || {};
  const linkedInstances = dataSource?.linkedInstances || [];
  const warnings = linkagePreview?.warnings || [];
  const themeCoverage = linkagePreview?.themeCoverage || [];
  const sharedEntities = linkagePreview?.sharedEntities || [];

  const cards = useMemo(() => ([
    { title: "装配实例数", value: toNumber(summary.instanceCount || linkedInstances.length) },
    { title: "可联动实例数", value: toNumber(summary.readyInstanceCount) },
    { title: "共享实体数", value: toNumber(summary.sharedEntityCount) },
    { title: "跨系统实体数", value: toNumber(summary.crossSystemEntityCount) },
  ]), [summary, linkedInstances.length]);

  const previewTotal = toNumber(summary.sharedEntityCount);
  const previewLimited = previewTotal > sharedEntities.length;

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <Card bordered={false} loading={loading}>
        {dataSource ? (
          <Space direction="vertical" size={16} style={{ display: "flex" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div>
                <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 8 }}>
                  联动数据设计
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  数据集：{dataSource.dataSourceName}。基于当前装配实例的最新样本方案，汇总共享实体、跨系统映射与主题联动覆盖结果。
                </Typography.Paragraph>
              </div>
              <Space wrap>
                <Button onClick={() => navigate("/dashboard/data-modeling/simulation")}>返回清单</Button>
                <Button type="primary" onClick={() => void handleRefresh()} loading={refreshing}>
                  刷新联动预览
                </Button>
              </Space>
            </div>

            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="联动数据集编码">{dataSource.dataSourceCode}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={(STATUS_META[dataSource.sourceStatus] || { color: "default" }).color}>
                  {(STATUS_META[dataSource.sourceStatus] || { label: dataSource.sourceStatus }).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="行业编码">{dataSource.industryCode}</Descriptions.Item>
              <Descriptions.Item label="预览时间">{formatDateTime(linkagePreview?.generatedAt)}</Descriptions.Item>
              <Descriptions.Item label="共享主题" span={2}>{renderThemes(dataSource.selectedThemes)}</Descriptions.Item>
              <Descriptions.Item label="联动说明" span={2}>{dataSource.dataSourceDesc || "-"}</Descriptions.Item>
            </Descriptions>

            <Space wrap>
              <Popconfirm
                title="确认删除当前联动数据集？"
                description="删除后将移除当前联动数据集及实例装配关系，不会删除业务系统实例本身。"
                okText="删除"
                cancelText="取消"
                onConfirm={() => void handleDeleteDataSource()}
              >
                <Button danger loading={deletingDataSource}>删除数据集</Button>
              </Popconfirm>
            </Space>

            <Space size={16} style={{ width: "100%" }} align="start">
              {cards.map((item) => (
                <Card key={item.title} bordered={false} style={{ flex: 1 }}>
                  <Statistic title={item.title} value={item.value} />
                </Card>
              ))}
            </Space>

            {warnings.length > 0 ? (
              <Alert
                type="warning"
                showIcon
                message={`当前有 ${warnings.length} 条装配提醒`}
                description={(
                  <Space direction="vertical" size={4} style={{ display: "flex" }}>
                    {warnings.map((item, index) => (
                      <Typography.Text key={`${item.code}_${index}`}>{item.message}</Typography.Text>
                    ))}
                  </Space>
                )}
              />
            ) : null}
          </Space>
        ) : (
          <Empty description="未找到联动数据集详情" />
        )}
      </Card>

      <Card bordered={false} title="装配实例清单">
        <Table
          rowKey="id"
          dataSource={linkedInstances}
          pagination={{ pageSize: 8, size: "small" }}
          locale={{ emptyText: <Empty description="暂无装配实例" /> }}
          columns={[
            {
              title: "实例",
              width: 260,
              render: (_: unknown, record: NonNullable<LabIndustryDataSourceRecord["linkedInstances"]>[number]) => (
                <Space direction="vertical" size={0}>
                  <Button
                    type="link"
                    style={{ padding: 0, height: "auto", fontWeight: 600, textAlign: "left" }}
                    onClick={() => jumpToInstance(record.id)}
                  >
                    {record.instanceName}
                  </Button>
                  <Typography.Text type="secondary">{record.instanceCode}</Typography.Text>
                </Space>
              ),
            },
            { title: "数据库", dataIndex: "dbType", width: 120, render: (value: string) => String(value || "-").toUpperCase() },
            { title: "样本方案", dataIndex: "currentGenerationVersion", width: 100, align: "center", render: (value?: number | null) => (value ? `V${value}` : "-") },
            { title: "缺陷版本", dataIndex: "currentDirtyVersion", width: 100, align: "center", render: (value?: number | null) => (value ? `V${value}` : "-") },
            { title: "装配状态", dataIndex: "assemblyStatus", width: 120, render: (value?: string) => renderAssemblyStatus(value) },
            { title: "识别主题", dataIndex: "activeThemes", render: (value: string[]) => renderThemes(value || []) },
          ]}
        />
      </Card>

      <Card bordered={false} title="主题覆盖统计">
        <Table
          rowKey="themeCode"
          dataSource={themeCoverage}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无主题覆盖统计" /> }}
          columns={[
            { title: "主题", dataIndex: "themeLabel", width: 180 },
            { title: "实例数", dataIndex: "instanceCount", width: 100, align: "center" },
            { title: "表数", dataIndex: "tableCount", width: 100, align: "center" },
            { title: "记录数", dataIndex: "recordCount", width: 120, align: "center" },
            { title: "共享实体", dataIndex: "sharedEntityCount", width: 120, align: "center" },
            { title: "跨系统实体", dataIndex: "crossSystemEntityCount", width: 140, align: "center" },
          ]}
        />
      </Card>

      <Card
        bordered={false}
        title="共享实体清单"
        extra={previewLimited ? (
          <Typography.Text type="secondary">
            当前展示前 {sharedEntities.length} / {previewTotal} 条共享实体
          </Typography.Text>
        ) : null}
      >
        <Table<LabIndustryDataSourceSharedEntityRecord>
          rowKey="entityId"
          dataSource={sharedEntities}
          pagination={{ pageSize: 10, size: "small" }}
          locale={{ emptyText: <Empty description="暂无共享实体清单" /> }}
          onRow={(record) => ({
            onClick: () => {
              void openEntityDrawer(record);
            },
            style: { cursor: "pointer" },
          })}
          columns={[
            {
              title: "实体",
              width: 280,
              render: (_: unknown, record) => (
                <Space direction="vertical" size={0}>
                  <Space wrap>
                    <Button
                      type="link"
                      style={{ padding: 0, height: "auto", fontWeight: 600 }}
                      onClick={(event) => {
                        event.stopPropagation();
                        void openEntityDrawer(record);
                      }}
                    >
                      {record.canonicalName}
                    </Button>
                    {record.isCrossSystem ? <Tag color="success">跨系统</Tag> : <Tag>单系统</Tag>}
                  </Space>
                  <Typography.Text type="secondary">{record.entityId}</Typography.Text>
                </Space>
              ),
            },
            { title: "主题", dataIndex: "themeLabel", width: 120 },
            { title: "子类型", dataIndex: "subtype", width: 120 },
            {
              title: "匹配方式",
              dataIndex: "matchMethod",
              width: 120,
              render: (value: string) => MATCH_METHOD_META[value] || value || "-",
            },
            { title: "实例数", dataIndex: "instanceCount", width: 100, align: "center" },
            { title: "联动点位", dataIndex: "linkageCount", width: 100, align: "center" },
            {
              title: "关键属性",
              dataIndex: "keyAttributes",
              width: 280,
              render: (value: Array<{ fieldName: string; value: string }>) => renderAttributes(value || []),
            },
            { title: "来源表", dataIndex: "tableNames", render: (value: string[]) => (Array.isArray(value) && value.length > 0 ? value.join(" / ") : "-") },
          ]}
        />
      </Card>

      <Drawer
        open={drawerOpen}
        width={960}
        title={entityDetail?.canonicalName || selectedEntityId || "共享实体详情"}
        onClose={closeDrawer}
        destroyOnClose
      >
        {entityLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
            <Spin />
          </div>
        ) : entityDetail ? (
          <Space direction="vertical" size={16} style={{ display: "flex" }}>
            <Alert
              type="info"
              showIcon
              message="实体联动详情基于当前联动数据集预览实时计算"
              description={`预览时间：${formatDateTime(entityDetail.generatedAt)}。如样本方案、缺陷版本或实例装配关系有变化，请返回页面刷新后再查看。`}
            />

            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="实体 ID">{entityDetail.entityId}</Descriptions.Item>
              <Descriptions.Item label="主题">{THEME_META[entityDetail.themeCode]?.label || entityDetail.themeLabel}</Descriptions.Item>
              <Descriptions.Item label="子类型">{entityDetail.subtype}</Descriptions.Item>
              <Descriptions.Item label="匹配方式">{MATCH_METHOD_META[entityDetail.matchMethod] || entityDetail.matchMethod}</Descriptions.Item>
              <Descriptions.Item label="覆盖实例数">{entityDetail.instanceCount}</Descriptions.Item>
              <Descriptions.Item label="联动点位">{entityDetail.linkageCount}</Descriptions.Item>
              <Descriptions.Item label="跨系统联动">{entityDetail.isCrossSystem ? "是" : "否"}</Descriptions.Item>
              <Descriptions.Item label="匹配信号">
                {entityDetail.signalField ? `${entityDetail.signalField}: ${entityDetail.signalValue || "-"}` : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="涉及实例" span={2}>
                {Array.isArray(entityDetail.instanceNames) && entityDetail.instanceNames.length > 0
                  ? entityDetail.instanceNames.join(" / ")
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="涉及表" span={2}>
                {Array.isArray(entityDetail.tableNames) && entityDetail.tableNames.length > 0
                  ? entityDetail.tableNames.join(" / ")
                  : "-"}
              </Descriptions.Item>
            </Descriptions>

            <Card bordered={false} title="共享实体关键属性">
              {renderAttributes(entityDetail.keyAttributes)}
            </Card>

            <Card bordered={false} title="来源映射">
              <Table
                rowKey="mappingId"
                dataSource={entityDetail.mappings}
                pagination={{ pageSize: 8, size: "small" }}
                scroll={{ x: 1360 }}
                locale={{ emptyText: <Empty description="暂无来源映射" /> }}
                columns={[
                  {
                    title: "实例",
                    width: 220,
                    render: (_: unknown, record: NonNullable<LabIndustryDataSourceSharedEntityDetailRecord["mappings"]>[number]) => (
                      <Space direction="vertical" size={0}>
                        <Button
                          type="link"
                          style={{ padding: 0, height: "auto", fontWeight: 600, textAlign: "left" }}
                          onClick={() => jumpToInstance(record.instanceId)}
                        >
                          {record.instanceName}
                        </Button>
                        <Typography.Text type="secondary">{record.instanceCode}</Typography.Text>
                      </Space>
                    ),
                  },
                  {
                    title: "来源表",
                    width: 220,
                    render: (_: unknown, record: NonNullable<LabIndustryDataSourceSharedEntityDetailRecord["mappings"]>[number]) => (
                      <Space direction="vertical" size={0}>
                        <Typography.Text strong>{record.logicalLabel || record.logicalTableName}</Typography.Text>
                        <Typography.Text type="secondary">{record.logicalTableName}</Typography.Text>
                      </Space>
                    ),
                  },
                  { title: "行号", dataIndex: "rowIndex", width: 80, align: "center" },
                  { title: "行主键", dataIndex: "rowKey", width: 140 },
                  { title: "展示值", dataIndex: "displayLabel", width: 180 },
                  {
                    title: "行内关键值",
                    dataIndex: "rowAttributes",
                    width: 300,
                    render: (value: Array<{ fieldName: string; value: string }>) => renderAttributes(value || []),
                  },
                  {
                    title: "跳转",
                    width: 240,
                    render: (_: unknown, record: NonNullable<LabIndustryDataSourceSharedEntityDetailRecord["mappings"]>[number]) => (
                      <Space size={4} wrap>
                        <Button size="small" onClick={() => jumpToInstance(record.instanceId, "plan")}>样本</Button>
                        <Button
                          size="small"
                          onClick={() => jumpToInstance(record.instanceId, "dirty")}
                          disabled={!record.currentDirtyVersion}
                        >
                          缺陷数据
                        </Button>
                        <Button size="small" onClick={() => jumpToInstance(record.instanceId, "quality")}>质量</Button>
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>
          </Space>
        ) : (
          <Empty description="暂无共享实体详情" />
        )}
      </Drawer>
    </Space>
  );
}
