import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  // Buttons for the next step.
  actions?: ReactNode;
  className?: string;
}

// A page-level "nothing here" or "can't continue" panel, always with a way forward.
export function EmptyState({ icon, title, children, actions, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl bg-raised px-6 py-14 text-center ring-1 ring-inset ring-fg/[0.06] sm:py-20",
        className
      )}
    >
      <div className="grid size-12 place-items-center rounded-xl bg-lifted text-fg-muted [&>svg]:size-6" aria-hidden="true">
        {icon}
      </div>
      <h2 className="mt-5 font-display text-xl font-semibold">{title}</h2>
      {children && <div className="mt-2 max-w-md leading-relaxed text-fg-muted">{children}</div>}
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  );
}
