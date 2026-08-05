import { Typography } from "antd";
import type { ReactNode } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { PageToolbar } from "../../components/ui/PageToolbar";
import { StatCard } from "../../components/ui/StatCard";

type SystemPageStat = {
  title: ReactNode;
  value: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  suffix?: ReactNode;
};

type SystemPageLayoutProps = {
  title: ReactNode;
  description?: ReactNode;
  heroTitle?: ReactNode;
  heroDescription?: ReactNode;
  heroBadges?: ReactNode[];
  stats?: SystemPageStat[];
  activeTab?: string;
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  hideHeader?: boolean;
  hideHero?: boolean;
  hideToolbar?: boolean;
  children: ReactNode;
};

export function SystemPageLayout(props: SystemPageLayoutProps) {
  const {
    title,
    description,
    heroTitle,
    heroDescription,
    heroBadges,
    stats,
    toolbarLeft,
    toolbarRight,
    hideHeader,
    hideHero,
    hideToolbar,
    children,
  } = props;

  return (
    <div className="app-page">
      {hideHeader ? null : <PageHeader title={title} description={description} eyebrow="System" />}
      {hideToolbar ? null : <PageToolbar left={toolbarLeft} right={toolbarRight} />}
      <div className="app-page-body">
        {hideHero ? null : (
          <section className="system-hero">
            <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 8 }}>
              {heroTitle || title}
            </Typography.Title>
            {heroDescription ? (
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 880 }}>
                {heroDescription}
              </Typography.Paragraph>
            ) : null}
            {heroBadges?.length ? (
              <div className="system-hero__badges">
                {heroBadges.map((badge, index) => (
                  <span key={index}>{badge}</span>
                ))}
              </div>
            ) : null}
          </section>
        )}

        {stats?.length ? (
          <div className="kpi-grid">
            {stats.map((stat, index) => (
              <StatCard
                key={index}
                title={stat.title}
                value={stat.value}
                description={stat.description}
                icon={stat.icon}
                suffix={stat.suffix}
              />
            ))}
          </div>
        ) : null}

        {children}
      </div>
    </div>
  );
}
