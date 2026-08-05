import { Card, Typography } from "antd";
import type { ReactNode } from "react";

type StatCardProps = {
  title: ReactNode;
  value: ReactNode;
  suffix?: ReactNode;
  icon?: ReactNode;
  description?: ReactNode;
  trend?: ReactNode;
};

export function StatCard(props: StatCardProps) {
  const { title, value, suffix, icon, description, trend } = props;

  return (
    <Card variant="borderless" className="stat-card">
      <div className="stat-card__head">
        <Typography.Text className="stat-card__title">{title}</Typography.Text>
        {icon ? <span className="stat-card__icon">{icon}</span> : null}
      </div>
      <div className="stat-card__value-row">
        <span className="stat-card__value">{value}</span>
        {suffix ? <span className="stat-card__suffix">{suffix}</span> : null}
      </div>
      {description ? (
        <Typography.Text className="stat-card__description" type="secondary">
          {description}
        </Typography.Text>
      ) : null}
      {trend ? <div className="stat-card__trend">{trend}</div> : null}
    </Card>
  );
}
