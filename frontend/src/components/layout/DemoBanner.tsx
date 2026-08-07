import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Jyo only operates within Tirupati, but anyone — a visitor outside it, or
// a Tirupati local exploring while there's little real content yet — can
// opt into a sandboxed demo session (see docs/demo-mode-plan.md). Shown
// app-wide for the length of that session so it's never mistaken for the
// real thing, with a countdown that auto-exits when the session ends
// (backend content expiry is independent and handled by the cleanup cron
// regardless of whether this fires).
export default function DemoBanner() {
  const { user, stopDemo } = useAuth();
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.isDemo || !user.demoExpiresAt) return;

    const expiresAt = new Date(user.demoExpiresAt).getTime();

    const tick = () => {
      const remaining = expiresAt - Date.now();
      setRemainingMs(remaining);
      if (remaining <= 0) stopDemo().catch(() => {});
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [user?.isDemo, user?.demoExpiresAt, stopDemo]);

  if (!user?.isDemo) return null;

  return (
    <div className="bg-accent/10 border-b border-accent/30 px-4 py-2.5">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 text-xs font-medium">
        <p className="text-muted leading-snug flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
          You're in demo mode — everything here is sandboxed
          {remainingMs !== null && ` and ends in ${formatRemaining(remainingMs)}`}.
        </p>
        <button
          type="button"
          onClick={() => stopDemo()}
          className="cursor-pointer text-accent underline underline-offset-2 hover:text-foreground transition-colors shrink-0"
        >
          Exit Demo
        </button>
      </div>
    </div>
  );
}
