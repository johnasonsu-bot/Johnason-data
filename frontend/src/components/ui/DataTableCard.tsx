import { Card, Table } from "antd";
import type { ReactNode } from "react";
import type { TableProps } from "antd";

type DataTableCardProps<T extends object> = {
  className?: string;
  title?: ReactNode;
  extra?: ReactNode;
  footer?: ReactNode;
  tableProps: TableProps<T>;
};

export function DataTableCard<T extends object>(props: DataTableCardProps<T>) {
  const { className, title, extra, footer, tableProps } = props;

  return (
    <Card variant="borderless" className={["data-table-card", className].filter(Boolean).join(" ")} title={title} extra={extra}>
      <Table {...tableProps} className={`app-table ${tableProps.className || ""}`.trim()} />
      {footer ? <div className="data-table-card__footer">{footer}</div> : null}
    </Card>
  );
}
