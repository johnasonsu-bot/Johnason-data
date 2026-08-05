import { Card, Tabs, Typography } from "antd";
import { useNavigate } from "react-router-dom";

type DataLabSceneTopNavProps = {
  sceneId?: number;
  activeKey: "edit" | "schema" | "strategy";
  title: string;
  description?: string;
};

export function DataLabSceneTopNav(props: DataLabSceneTopNavProps) {
  const { sceneId, activeKey, title, description } = props;
  const navigate = useNavigate();

  return (
    <Card bordered={false}>
      <Typography.Title level={3} style={{ marginBottom: 4 }}>
        {title}
      </Typography.Title>
      {description ? (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {description}
        </Typography.Paragraph>
      ) : null}
      <Tabs
        activeKey={activeKey}
        style={{ marginTop: 12, marginBottom: -8 }}
        onChange={(key) => {
          if (!sceneId) {
            return;
          }
          if (key === "edit") navigate(`/dashboard/data-modeling/scene-editor/${sceneId}`);
          if (key === "schema") navigate(`/dashboard/data-modeling/schema/${sceneId}`);
          if (key === "strategy") navigate(`/dashboard/data-modeling/strategy/${sceneId}`);
        }}
        items={[
          { key: "edit", label: "场景定义" },
          { key: "schema", label: "逻辑模型", disabled: !sceneId },
          { key: "strategy", label: "数据生成", disabled: !sceneId },
        ]}
      />
    </Card>
  );
}
