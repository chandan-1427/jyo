import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  // Small icon before the subtitle, e.g. a map pin for "within 20 km".
  icon?: ReactNode;
  // Buttons on the right (under the title on phones).
  actions?: ReactNode;
}

// The title block at the top of a logged-in page.
export function PageHeader({ title, subtitle, icon, actions }: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">{title}</h1>
        {subtitle && (
          <p className="mt-1.5 flex items-center gap-1.5 text-fg-muted">
            {icon && <span className="flex shrink-0 [&>svg]:size-4" aria-hidden="true">{icon}</span>}
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
