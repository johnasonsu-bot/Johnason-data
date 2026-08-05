import type { ReactNode } from "react";

type PageToolbarProps = {
  className?: string;
  left?: ReactNode;
  right?: ReactNode;
};

export function PageToolbar({ className, left, right }: PageToolbarProps) {
  return (
    <section className={["page-toolbar", className].filter(Boolean).join(" ")}>
      <div className="page-toolbar__left">{left}</div>
      <div className="page-toolbar__right">{right}</div>
    </section>
  );
}
