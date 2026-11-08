import { useState } from "react";
import { BellRing, X } from "lucide-react";
import { usePush } from "@/lib/usePush";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Notice";

const DISMISSED_KEY = "jyo:notification-prompt-dismissed";

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

// Offered at the moment it matters (just after posting or asking), never on
// page load: people say yes far more often when they can see why.
export function NotificationPrompt({ reason }: { reason: string }) {
  const { state, available, enable } = usePush();
  const [dismissed, setDismissed] = useState(wasDismissed);

  if (!available || dismissed || state === null || state === "on" || state === "unsupported") return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Private browsing: it just shows again next time.
    }
  };

  const body =
    state === "needs-install" ? (
      <p className="text-sm leading-relaxed text-fg-muted">
        {reason} On iPhone, add Jyo to your Home Screen first: tap Share, then Add to Home Screen, and open Jyo from
        there.
      </p>
    ) : state === "blocked" ? (
      <p className="text-sm leading-relaxed text-fg-muted">
        Notifications are blocked for Jyo in this browser. To get them, allow notifications in the site settings next to
        the address bar.
      </p>
    ) : (
      <>
        <p className="text-sm leading-relaxed text-fg-muted">{reason}</p>
        {enable.error && <Notice tone="error">{enable.error.message}</Notice>}
        <Button
          onClick={() => enable.mutate()}
          loading={enable.isPending}
          iconLeft={<BellRing className="size-4" aria-hidden="true" />}
        >
          {enable.isPending ? "Turning on…" : "Turn on notifications"}
        </Button>
      </>
    );

  return (
    <section className="relative flex flex-col gap-3 rounded-2xl bg-raised p-5 pr-12 ring-1 ring-inset ring-fg/[0.06]">
      <h2 className="font-display text-lg font-semibold">Get notified on this phone</h2>
      {body}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Not now"
        className="absolute top-3 right-3 grid size-9 cursor-pointer place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-fg/5 hover:text-fg focus-visible:outline-2 focus-visible:outline-leaf"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </section>
  );
}

// The same choice, kept in Profile, to turn it on or off at any time.
export function NotificationSetting() {
  const { state, available, enable, disable } = usePush();

  if (!available || state === null) {
    return <p className="text-sm text-fg-muted">Notifications aren't available right now.</p>;
  }
  if (state === "unsupported") {
    return <p className="text-sm text-fg-muted">This browser can't show notifications from Jyo.</p>;
  }
  if (state === "needs-install") {
    return (
      <p className="text-sm leading-relaxed text-fg-muted">
        On iPhone, add Jyo to your Home Screen (tap Share, then Add to Home Screen) and open it from there to turn
        notifications on.
      </p>
    );
  }
  if (state === "blocked") {
    return (
      <p className="text-sm leading-relaxed text-fg-muted">
        Blocked in this browser. Allow notifications for Jyo in the site settings next to the address bar.
      </p>
    );
  }

  const busy = enable.isPending || disable.isPending;
  const error = enable.error ?? disable.error;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-fg-muted">
        {state === "on"
          ? "On for this device. You'll get an alert when someone asks for your food or answers your request."
          : "Off for this device. Turn on to get an alert when someone asks for your food or answers your request."}
      </p>
      {error && <Notice tone="error">{error.message}</Notice>}
      <Button
        variant={state === "on" ? "outline" : "primary"}
        onClick={() => (state === "on" ? disable.mutate() : enable.mutate())}
        loading={busy}
        iconLeft={<BellRing className="size-4" aria-hidden="true" />}
      >
        {state === "on" ? "Turn off on this device" : "Turn on notifications"}
      </Button>
    </div>
  );
}
