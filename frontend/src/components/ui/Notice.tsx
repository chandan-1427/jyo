import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "error" | "info" | "success";

const TONES: Record<Tone, { box: string; Icon: typeof Info }> = {
  error: { box: "bg-danger/10 text-danger", Icon: AlertCircle },
  info: { box: "bg-raised text-fg-muted ring-1 ring-inset ring-fg/[0.06]", Icon: Info },
  success: { box: "bg-leaf/10 text-leaf", Icon: CheckCircle2 },
};

interface NoticeProps {
  tone?: Tone;
  children: ReactNode;
  // Optional control under the message, e.g. "Send the link again".
  action?: ReactNode;
  className?: string;
}

// A message that belongs to the whole form or page rather than one field.
// Errors are announced immediately (role="alert"); the rest politely.
export function Notice({ tone = "info", children, action, className }: NoticeProps) {
  const { box, Icon } = TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-xl px-4 py-3.5 text-sm leading-relaxed", box, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-3">
        <div>{children}</div>
        {action}
      </div>
    </div>
  );
}
