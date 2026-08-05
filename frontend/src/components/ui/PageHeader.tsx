import { Space, Typography } from "antd";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  extra?: ReactNode;
};

export function PageHeader(props: PageHeaderProps) {
  const { title, description, eyebrow, meta, extra } = props;

  return (
    <section className="page-header">
      <Space direction="vertical" size={6} className="page-header__main">
        {eyebrow ? <span className="page-header__eyebrow">{eyebrow}</span> : null}
        <div className="page-header__title-row">
          <Typography.Title level={2} className="page-header__title">
            {title}
          </Typography.Title>
          {meta ? <div className="page-header__meta">{meta}</div> : null}
        </div>
        {description ? (
          <Typography.Paragraph className="page-header__description" type="secondary">
            {description}
          </Typography.Paragraph>
        ) : null}
      </Space>
      {extra ? <div className="page-header__extra">{extra}</div> : null}
    </section>
  );
}
