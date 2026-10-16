import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface Props {
  // Plays the arrival sequence. Only true on the first visit of a session.
  animate: boolean;
}

function enter(animate: boolean, delayMs: number): { className?: string; style?: CSSProperties } {
  return animate
    ? { className: "motion-safe:animate-enter", style: { animationDelay: `${delayMs}ms` } }
    : {};
}

// The product's core loop in one picture: a post, and someone asking for it.
// Built in markup rather than a screenshot so it stays sharp, matches the
// real type and colours, and reflows on a phone.
export function PickupPreview({ animate }: Props) {
  const post = enter(animate, 300);
  const request = enter(animate, 1100);

  return (
    <figure>
      <div aria-hidden="true" className="relative pb-28 sm:pb-24">
        <div
          // Extra bottom padding is where the request card lands, so the
          // overlap never covers the pickup details.
          className={cn("rounded-3xl bg-raised p-6 pb-16", post.className)}
          style={post.style}
        >
          <div className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-2 font-medium text-leaf">
              <span className="size-1.5 rounded-full bg-leaf" />
              Open
            </span>
            <span className="text-fg-subtle">Tiruchanur</span>
          </div>

          <p className="mt-5 font-display text-2xl font-semibold leading-tight text-fg">
            Sweet pongal, small batch
          </p>
          <p className="mt-1.5 text-fg-muted">Made extra for a pooja at home.</p>

          <div className="mt-7 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-fg-subtle">Pickup</p>
              <p className="mt-0.5 font-medium text-fg tabular-nums">7:00 to 9:00 pm</p>
            </div>
            <div>
              <p className="text-fg-subtle">Shared by</p>
              <p className="mt-0.5 font-medium text-fg">Anjali R.</p>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "absolute inset-x-0 bottom-0 ml-6 rounded-3xl bg-lifted p-4 shadow-lift sm:ml-14",
            request.className
          )}
          style={request.style}
        >
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-leaf font-display text-[15px] font-semibold text-canvas">
              RK
            </span>
            <div className="min-w-0">
              <p className="font-medium text-fg">Rahul K. wants this food</p>
              <p className="text-sm text-fg-muted">Selfie added. Will come in 15 minutes.</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <span className="rounded-lg bg-leaf py-2.5 text-center font-semibold text-canvas">Approve</span>
            <span className="rounded-lg bg-fg/[0.06] py-2.5 text-center font-medium text-fg-muted">Reject</span>
          </div>
        </div>
      </div>

      <figcaption className="mt-4 text-sm text-fg-subtle">
        <span className="sr-only">
          Example: Anjali posts sweet pongal for pickup from 7 to 9 pm. Rahul asks for it. She can
          approve or reject him.{" "}
        </span>
        Example: someone asks for your food, and you decide.
      </figcaption>
    </figure>
  );
}
