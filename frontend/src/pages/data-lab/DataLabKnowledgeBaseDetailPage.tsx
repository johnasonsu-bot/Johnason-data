import { Button, Card, Space, Table, Typography, Upload, message } from "antd";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { fetchKnowledgeBaseDetail, reparseKnowledgeDocument, uploadKnowledgeDocument } from "../../services/dataLab";
import type { LabKnowledgeBaseRecord } from "../../types/api";

export function DataLabKnowledgeBaseDetailPage() {
  const { token } = useAuth();
  const { id } = useParams();
  const [detail, setDetail] = useState<LabKnowledgeBaseRecord | null>(null);

  async function load() {
    if (!token || !id) return;
    const response = await fetchKnowledgeBaseDetail(token, Number(id));
    setDetail(response.data);
  }

  useEffect(() => {
    void load();
  }, [token, id]);

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <Card bordered={false}>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>{detail?.kbName || "知识库详情"}</Typography.Title>
        <Typography.Text type="secondary">{detail?.kbDesc || "暂无描述"}</Typography.Text>
      </Card>

      <Card bordered={false}>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Typography.Text>行业：{detail?.industryType || "-"}</Typography.Text>
          {detail && (
            <Upload
              showUploadList={false}
              beforeUpload={async (file) => {
                await uploadKnowledgeDocument(token!, detail.id, file);
                message.success(`已上传 ${file.name}`);
                await load();
                return false;
              }}
            >
              <Button>上传文档</Button>
            </Upload>
          )}
        </Space>
      </Card>

      <Card bordered={false} title="文档列表">
        <Table
          rowKey="id"
          dataSource={detail?.documents || []}
          pagination={false}
          columns={[
            { title: "文件名", dataIndex: "fileName" },
            { title: "类型", dataIndex: "fileType", width: 90 },
            { title: "解析状态", dataIndex: "parseStatus", width: 120 },
            { title: "向量状态", dataIndex: "vectorStatus", width: 120 },
            { title: "片段数", dataIndex: "chunkCount", width: 90 },
            { title: "解析摘要", dataIndex: "parseSummary", render: (value: string) => value || "-" },
            {
              title: "操作",
              width: 100,
              render: (_: unknown, record: any) => (
                <Button
                  type="link"
                  onClick={async () => {
                    await reparseKnowledgeDocument(token!, record.id);
                    message.success("已提交重解析");
                    await load();
                  }}
                >
                  重解析
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
