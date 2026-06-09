import { cn } from "../../lib/utils";

const STYLES: Record<string, string> = {
  // post statuses
  open:             "bg-emerald-50 text-emerald-600 border-emerald-100",
  pending_approval: "bg-amber-50 text-amber-600 border-amber-100",
  closed:           "bg-neutral-100 text-neutral-500 border-neutral-200",
  expired:          "bg-red-50 text-red-400 border-red-100",
  completed:        "bg-blue-50 text-blue-600 border-blue-100",
  // request statuses
  pending:          "bg-amber-50 text-amber-600 border-amber-100",
  approved:         "bg-emerald-50 text-emerald-600 border-emerald-100",
  rejected:         "bg-red-50 text-red-400 border-red-100",
  cancelled:        "bg-neutral-100 text-neutral-500 border-neutral-200",
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
      STYLES[status] ?? "bg-neutral-100 text-neutral-500 border-neutral-200"
    )}>
      {LABELS[status] ?? status}
    </span>
  );
}