import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  // post statuses
  open:             "bg-emerald-950/30 text-emerald-400 border-emerald-900/40",
  pending_approval: "bg-amber-950/30 text-amber-400 border-amber-900/40",
  closed:           "bg-surface text-subtle border-border",
  expired:          "bg-red-950/30 text-red-400 border-red-900/40",
  completed:        "bg-blue-950/30 text-blue-400 border-blue-900/40",
  // request statuses
  pending:          "bg-amber-950/30 text-amber-400 border-amber-900/40",
  approved:         "bg-emerald-950/30 text-emerald-400 border-emerald-900/40",
  rejected:         "bg-red-950/30 text-red-400 border-red-900/40",
  cancelled:        "bg-surface text-subtle border-border",
};

const LABELS: Record<string, string> = {
  open:             "Open",
  pending_approval: "Pending",
  closed:           "Closed",
  expired:          "Expired",
  completed:        "Completed",
  pending:          "Pending",
  approved:         "Approved",
  rejected:         "Rejected",
  cancelled:        "Cancelled",
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={cn(
      "text-[11px] px-2.5 py-1 rounded-full font-medium border shrink-0",
      STYLES[status] ?? "bg-surface text-subtle border-border"
    )}>
      {LABELS[status] ?? status}
    </span>
  );
}