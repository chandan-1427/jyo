import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

// "+25%" against the 30 days before; nothing when there's nothing to compare.
function Trend({ now, before }: { now: number; before: number }) {
  if (!before) return null;
  const change = Math.round(((now - before) / before) * 100);
  const Icon = change >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-fg-muted tabular-nums ring-1 ring-inset ring-fg/[0.12]">
      <Icon className="size-3.5" aria-hidden="true" />
      {change >= 0 ? "+" : ""}
      {change}%<span className="sr-only"> against the 30 days before</span>
    </span>
  );
}

export function StatCard({
  label,
  value,
  trend,
  note,
  detail,
  icon,
  alert,
}: {
  label: string;
  value: number | undefined;
  trend?: { now: number; before: number };
  note: string;
  detail: string;
  icon: ReactNode;
  alert?: boolean;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-raised p-5 ring-1 ring-inset ring-fg/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <span className={cn("flex [&>svg]:size-4", alert ? "text-danger" : "text-fg-subtle")} aria-hidden="true">
            {icon}
          </span>
          {label}
        </p>
        {trend && <Trend {...trend} />}
      </div>
      <p className={cn("font-display text-3xl font-semibold tabular-nums", alert ? "text-danger" : "text-fg")}>{value ?? "–"}</p>
      <div className="mt-auto text-sm">
        <p className="font-medium text-fg">{note}</p>
        <p className="mt-0.5 text-fg-subtle">{detail}</p>
      </div>
    </section>
  );
}
