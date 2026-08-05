import { Card, Space, Tabs } from "antd";
import { DataLabDataPreviewPage } from "./DataLabDataPreviewPage";
import { DataLabKafkaPreviewPage } from "./DataLabKafkaPreviewPage";
import { DataLabQualityReportPage } from "./DataLabQualityReportPage";

export function DataLabResultQueryPage() {
  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <Card bordered={false}>
        <Tabs
          items={[
            {
              key: "data-preview",
              label: "数据预览",
              children: <DataLabDataPreviewPage embedded />,
            },
            {
              key: "kafka-preview",
              label: "Kafka 预览",
              children: <DataLabKafkaPreviewPage embedded />,
            },
            {
              key: "quality-report",
              label: "质量报告",
              children: <DataLabQualityReportPage embedded />,
            },
          ]}
        />
      </Card>
    </Space>
  );
}
