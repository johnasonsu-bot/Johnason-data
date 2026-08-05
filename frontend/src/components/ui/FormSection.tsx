import { Card, Typography } from "antd";
import type { ReactNode } from "react";

type FormSectionProps = {
  title: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
};

export function FormSection(props: FormSectionProps) {
  const { title, description, extra, children } = props;

  return (
    <Card variant="borderless" className="form-section" extra={extra}>
      <div className="form-section__header">
        <Typography.Title level={4} className="form-section__title">
          {title}
        </Typography.Title>
        {description ? (
          <Typography.Paragraph className="form-section__description" type="secondary">
            {description}
          </Typography.Paragraph>
        ) : null}
      </div>
      {children}
    </Card>
  );
}
