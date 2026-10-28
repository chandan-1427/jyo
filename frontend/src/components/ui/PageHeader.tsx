import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
}

// The title block at the top of a logged-in page.
export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="mb-8">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">{title}</h1>
      {subtitle && <p className="mt-1.5 text-fg-muted">{subtitle}</p>}
    </header>
  );
}
