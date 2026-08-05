import { Card, Space, Tag, Typography } from "antd";
import type { ReactNode } from "react";

type FeatureCardProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  tag?: ReactNode;
  extra?: ReactNode;
  children?: ReactNode;
};

export function FeatureCard(props: FeatureCardProps) {
  const { title, description, icon, tag, extra, children } = props;

  return (
    <Card variant="borderless" className="feature-card" extra={extra}>
      <Space direction="vertical" size={12} style={{ display: "flex" }}>
        <div className="feature-card__head">
          <div className="feature-card__title-wrap">
            {icon ? <span className="feature-card__icon">{icon}</span> : null}
            <Typography.Title level={4} className="feature-card__title">
              {title}
            </Typography.Title>
          </div>
          {tag ? (
            <Tag bordered={false} className="feature-card__tag">
              {tag}
            </Tag>
          ) : null}
        </div>
        {description ? (
          <Typography.Paragraph className="feature-card__description" type="secondary">
            {description}
          </Typography.Paragraph>
        ) : null}
        {children}
      </Space>
    </Card>
  );
}
