import { Button, Card, Descriptions, Space, Table, Tag, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { fetchQualityReport, rebuildQualityReport, reviewSceneRealism } from "../../services/dataLab";
import type { LabQualityReportRecord } from "../../types/api";

type RealismIssue = {
  issueCode?: string;
  severity?: string;
  fixTarget?: string;
  fixStrategy?: string;
  evidence?: string[];
};

type RealismFixPlan = {
  issueCode?: string;
  severity?: string;
  fixTarget?: string;
  fixStrategy?: string;
};

type RealismReview = {
  enabled?: boolean;
  usedModel?: boolean;
  structured?: boolean;
  parseMode?: string;
  pass?: boolean | null;
  realismScore?: number | null;
  summary?: string;
  findings?: string[];
  obviousFakePatterns?: string[];
  recommendations?: string[];
  normalizedIssues?: RealismIssue[];
  fixPlan?: RealismFixPlan[];
  issueStats?: Record<string, number>;
  rawText?: string;
  promptPayload?: Record<string, unknown>;
};

function JsonBlock({ value }: { value: unknown }) {
  return <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(value ?? {}, null, 2)}</pre>;
}

function renderTags(items: string[] = []) {
  if (items.length === 0) {
    return <Typography.Text type="secondary">暂无</Typography.Text>;
  }
  return <Space wrap>{items.map((item) => <Tag key={item}>{item}</Tag>)}</Space>;
}

export function DataLabQualityReportPage({ embedded = false }: { embedded?: boolean }) {
  const { token } = useAuth();
  const { id } = useParams();
  const [report, setReport] = useState<LabQualityReportRecord | null>(null);
  const [realism, setRealism] = useState<RealismReview | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  async function load() {
    if (!token || !id) return;
    const response = await fetchQualityReport(token, Number(id));
    setReport(response.data || null);
  }

  async function handleRebuildReport() {
    if (!token || !id) return;
    const key = "quality-rebuild";
    try {
      setRebuilding(true);
      message.loading({ key, content: "正在刷新质量报告", duration: 0 });
      await rebuildQualityReport(token, Number(id));
      await load();
      message.success({ key, content: "质量报告已刷新", duration: 2 });
    } catch (error) {
      message.error({ key, content: error instanceof Error ? error.message : "质量报告刷新失败", duration: 3 });
    } finally {
      setRebuilding(false);
    }
  }

  async function handleReviewRealism() {
    if (!token || !id) return;
    const key = "realism-review";
    try {
      setReviewing(true);
      message.loading({ key, content: "正在运行真实性评审", duration: 0 });
      const response = await reviewSceneRealism(token, Number(id), { sampleTables: 6, sampleRows: 2 });
      setRealism((response.data || null) as RealismReview | null);
      message.success({ key, content: "真实性评审完成", duration: 2 });
    } catch (error) {
      message.error({ key, content: error instanceof Error ? error.message : "真实性评审失败", duration: 3 });
    } finally {
      setReviewing(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token, id]);

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <Card bordered={false}>
        <Space direction="vertical" size={12} style={{ display: "flex" }}>
          <Descriptions size="small" column={2}>
            <Descriptions.Item label="总体得分">{report?.score ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="报告时间">{report?.updatedAt || "-"}</Descriptions.Item>
          </Descriptions>
          <JsonBlock value={report?.summary || {}} />
          <Space wrap>
            <Button loading={rebuilding} onClick={() => void handleRebuildReport()}>刷新质量报告</Button>
            <Button type="primary" loading={reviewing} onClick={() => void handleReviewRealism()}>运行真实性评审</Button>
          </Space>
        </Space>
      </Card>

      <Card bordered={false} title="表级统计">
        <Table rowKey={(record) => JSON.stringify(record)} dataSource={(report?.tableStats || []) as any[]} pagination={false} columns={[{ title: "表", dataIndex: "tableName" }, { title: "总行数", dataIndex: "rowCount" }, { title: "脏数据行数", dataIndex: "dirtyRows" }, { title: "异常字段", dataIndex: "issueFields", render: (value: unknown) => JSON.stringify(value || []) }]} />
      </Card>

      <Card bordered={false} title="字段级异常">
        <Table rowKey={(record) => JSON.stringify(record)} dataSource={(report?.fieldIssues || []) as any[]} pagination={false} columns={[{ title: "表", dataIndex: "tableName" }, { title: "字段", dataIndex: "fieldName" }, { title: "问题类别", dataIndex: "issueCategory" }, { title: "异常类型", dataIndex: "issueType" }, { title: "数量", dataIndex: "issueCount" }]} />
      </Card>

      <Card bordered={false} title="真实性评审">
        {realism ? (
          <Space direction="vertical" size={12} style={{ display: "flex" }}>
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="已启用模型">{realism.enabled ? "是" : "否"}</Descriptions.Item>
              <Descriptions.Item label="结构化返回">{realism.structured === false ? "否" : "是"}</Descriptions.Item>
              <Descriptions.Item label="解析方式">{realism.parseMode || "-"}</Descriptions.Item>
              <Descriptions.Item label="真实性评分">{realism.realismScore ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="评审结论">{realism.pass === null || realism.pass === undefined ? "-" : realism.pass ? "通过" : "未通过"}</Descriptions.Item>
            </Descriptions>
            <Typography.Paragraph>{realism.summary || "暂无评审摘要"}</Typography.Paragraph>
            <div><Typography.Text strong>发现问题：</Typography.Text>{renderTags(realism.findings || [])}</div>
            <div><Typography.Text strong>明显假数据模式：</Typography.Text>{renderTags(realism.obviousFakePatterns || [])}</div>
            <div><Typography.Text strong>优化建议：</Typography.Text>{renderTags(realism.recommendations || [])}</div>
            <Table
              size="small"
              rowKey={(record) => `${record.issueCode || "issue"}-${record.fixStrategy || ""}`}
              dataSource={realism.normalizedIssues || []}
              pagination={false}
              columns={[
                { title: "问题码", dataIndex: "issueCode", width: 180 },
                { title: "严重级别", dataIndex: "severity", width: 120 },
                { title: "修复目标", dataIndex: "fixTarget", width: 160 },
                { title: "证据", render: (_: unknown, record: RealismIssue) => JSON.stringify(record.evidence || []) },
              ]}
            />
            <Card size="small" title="Fix Plan">
              <Table
                size="small"
                rowKey={(record) => `${record.issueCode || "fix"}-${record.fixStrategy || ""}`}
                dataSource={realism.fixPlan || []}
                pagination={false}
                columns={[
                  { title: "问题码", dataIndex: "issueCode", width: 180 },
                  { title: "严重级别", dataIndex: "severity", width: 120 },
                  { title: "修复目标", dataIndex: "fixTarget", width: 160 },
                  { title: "修复策略", dataIndex: "fixStrategy" },
                ]}
              />
            </Card>
            {realism.structured === false && realism.rawText ? <Card size="small" title="原始评审文本"><Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{realism.rawText}</Typography.Paragraph></Card> : null}
            {!embedded && realism.promptPayload ? <Card size="small" title="评审采样上下文"><JsonBlock value={realism.promptPayload} /></Card> : null}
          </Space>
        ) : (
          <Typography.Text type="secondary">尚未运行真实性评审。点击上方按钮即可让大模型从中文业务语境、时间链、金额比例、地址和编号等维度检查数据是否自然。</Typography.Text>
        )}
      </Card>

      <Card bordered={false} title="Kafka 异常统计">
        <JsonBlock value={report?.kafkaStats || {}} />
      </Card>
    </Space>
  );
}
