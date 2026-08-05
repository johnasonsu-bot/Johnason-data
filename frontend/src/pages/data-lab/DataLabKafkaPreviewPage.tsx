import { Button, Card, Space, Table, Typography } from "antd";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { fetchTopics, previewTopicMessages } from "../../services/dataLab";
import type { LabTopicRecord } from "../../types/api";

export function DataLabKafkaPreviewPage({ embedded = false }: { embedded?: boolean }) {
  const { token } = useAuth();
  const { id } = useParams();
  const [topics, setTopics] = useState<LabTopicRecord[]>([]);
  const [currentTopic, setCurrentTopic] = useState<string>("");
  const [messages, setMessages] = useState<Array<Record<string, unknown>>>([]);

  async function loadTopics() {
    if (!token || !id) return;
    const response = await fetchTopics(token, Number(id));
    setTopics(response.data);
    if (response.data[0]) {
      await loadMessages(response.data[0].topicName);
    }
  }

  async function loadMessages(topicName: string) {
    if (!token || !id) return;
    const response = await previewTopicMessages(token, Number(id), topicName);
    setCurrentTopic(topicName);
    setMessages(response.data.messages);
  }

  useEffect(() => {
    void loadTopics();
  }, [token, id]);

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <Card bordered={false}>
        <Space wrap>
          {topics.map((topic) => (
            <Button key={topic.topicName} type={currentTopic === topic.topicName ? "primary" : "default"} onClick={() => loadMessages(topic.topicName)}>
              {topic.topicName}
            </Button>
          ))}
        </Space>
      </Card>
      <Card bordered={false} title="Topic 指标">
        <Table rowKey="topicName" dataSource={topics} pagination={false} columns={[
          { title: "Topic", dataIndex: "topicName" },
          { title: "消息量", dataIndex: "messageCount" },
          { title: "最近消息时间", dataIndex: "lastMessageAt" },
          { title: "状态", dataIndex: "status" },
          { title: "本地预览文件", render: (_: unknown, record: LabTopicRecord) => record.metrics?.fileExists ? "是" : "否" },
        ]} />
      </Card>
      <Card bordered={false} title="最近消息">
        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(messages, null, 2)}</pre>
      </Card>
    </Space>
  );
}
