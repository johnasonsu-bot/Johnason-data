import { Card, Space, Typography } from "antd";
import { DataLabScenarioEnhancementTab } from "./DataLabScenarioEnhancementTab";

export function DataLabScenarioEnhancementPage() {
  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <DataLabScenarioEnhancementTab />
    </Space>
  );
}
