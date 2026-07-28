import { cn } from "@/lib/utils";

// The `pending` states used to be `amber-400`, which was byte-identical to the
// OLD --color-accent (#FBBF24) — brand colour and status colour were the same
// value by accident. The accent has since moved to #F5A524, and measuring the
// two shows they sit only 6° apart in hue: not "distinct", just mismatched, in
// the way that reads as a bug rather than a decision. No amber can be both a
// warning and clearly separate from a golden accent — 21° is the maximum
// separation available while staying warm and passing AA.
//
// So `pending` stops using hue at all. It is a PROGRESS state, not a caution,
// and it now says so through CONTRAST: active states get bright text and a
// strong border, terminal ones recede to subtle text and a plain border. That
// also fixes a pre-existing flaw — hue alone was the only thing separating
// pending from closed/cancelled, which is invisible to a colourblind user.
const STYLES: Record<string, string> = {
  // post statuses
  open:             "bg-emerald-950/30 text-emerald-400 border-emerald-900/40",
  pending_approval: "bg-surface text-foreground border-border-strong",
  closed:           "bg-surface text-subtle border-border",
  expired:          "bg-red-950/30 text-red-400 border-red-900/40",
  completed:        "bg-blue-950/30 text-blue-400 border-blue-900/40",
  // request statuses
  pending:          "bg-surface text-foreground border-border-strong",
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