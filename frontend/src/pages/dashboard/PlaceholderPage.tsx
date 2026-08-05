import { Card, Typography } from "antd";
import { PageHeader } from "../../components/ui/PageHeader";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="app-page">
      <PageHeader title={title} description={description} eyebrow="Workspace" />
      <div className="app-page-body">
        <Card bordered={false} className="surface-card">
          <Typography.Paragraph style={{ marginBottom: 0 }} type="secondary">
            {description}
          </Typography.Paragraph>
        </Card>
      </div>
    </div>
  );
}
