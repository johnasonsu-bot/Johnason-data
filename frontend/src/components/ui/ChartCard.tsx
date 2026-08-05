import { Card, Typography } from "antd";
import type { ReactNode } from "react";
import ReactECharts from "echarts-for-react";
import { medataEChartsTheme } from "../../design-system";

type ChartCardProps = {
  title: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  option: Record<string, unknown>;
  height?: number;
};

export function ChartCard(props: ChartCardProps) {
  const { title, description, extra, option, height = 320 } = props;

  return (
    <Card variant="borderless" className="chart-card" extra={extra}>
      <div className="chart-card__header">
        <Typography.Title level={4} className="chart-card__title">
          {title}
        </Typography.Title>
        {description ? (
          <Typography.Paragraph className="chart-card__description" type="secondary">
            {description}
          </Typography.Paragraph>
        ) : null}
      </div>
      <ReactECharts option={option} theme={medataEChartsTheme} style={{ height, width: "100%" }} />
    </Card>
  );
}
