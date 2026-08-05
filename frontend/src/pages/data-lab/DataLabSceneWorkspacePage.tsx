import { Button, Card, Space, Typography } from "antd";
import { useNavigate, useParams } from "react-router-dom";

export function DataLabSceneWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <Card bordered={false}>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>场景工作台</Typography.Title>
        <Typography.Text type="secondary">
          该兼容页保留给旧路由使用，建议直接进入场景定义、结构设计、数据生成、数据预览和运行日志等页面。
        </Typography.Text>
      </Card>
      <Card bordered={false}>
        <Space wrap>
          <Button type="primary" onClick={() => navigate(`/dashboard/data-modeling/scene-editor/${id}`)}>场景定义</Button>
          <Button onClick={() => navigate(`/dashboard/data-modeling/schema/${id}`)}>结构设计</Button>
          <Button onClick={() => navigate(`/dashboard/data-modeling/strategy/${id}`)}>数据生成</Button>
          <Button onClick={() => navigate(`/dashboard/data-modeling/data-preview/${id}`)}>数据预览</Button>
          <Button onClick={() => navigate(`/dashboard/data-modeling/kafka-preview/${id}`)}>Kafka 预览</Button>
          <Button onClick={() => navigate(`/dashboard/data-modeling/run-log/${id}`)}>运行日志</Button>
          <Button onClick={() => navigate(`/dashboard/data-modeling/quality/${id}`)}>质量报告</Button>
        </Space>
      </Card>
    </Space>
  );
}
