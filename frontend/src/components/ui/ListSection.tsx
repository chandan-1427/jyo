import { useId, type ReactNode } from "react";

interface ListSectionProps {
  title: string;
  count?: number;
  // Controls on the right of the heading, e.g. "Select".
  actions?: ReactNode;
  children: ReactNode;
}

// A titled group within a page's list, e.g. "Active" and "Ended".
export function ListSection({ title, count, actions, children }: ListSectionProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="mt-10 first:mt-0">
      <div className="mb-4 flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id={id} className="flex items-baseline gap-2 font-display text-xl font-semibold">
          {title}
          {count !== undefined && <span className="text-base font-normal text-fg-subtle tabular-nums">{count}</span>}
        </h2>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
