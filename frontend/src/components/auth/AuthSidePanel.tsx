import { CheckCircle2 } from "lucide-react";
import { Logo } from "../ui/Logo";

interface AuthSidePanelProps {
  headline: string;
  subtext: string;
  benefits: string[];
}

export function AuthSidePanel({ headline, subtext, benefits }: AuthSidePanelProps) {
  return (
    <div className="hidden lg:flex flex-col justify-between p-12 border-r border-border bg-surface/40">
      <Logo />

      <div className="max-w-sm">
        <h2 className="text-2xl font-semibold text-foreground tracking-tight leading-snug">
          {headline}
        </h2>
        <p className="mt-3 text-sm text-muted leading-relaxed">{subtext}</p>

        <ul className="mt-8 flex flex-col gap-3">
          {benefits.map((benefit) => (
            <li key={benefit} className="flex items-center gap-2.5 text-sm text-muted">
              <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
              {benefit}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-subtle">&copy; 2026 Jyo</p>
    </div>
  );
}