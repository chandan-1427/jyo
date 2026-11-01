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
//
// The request is a layer arriving on top of the post, so it's frosted glass:
// the post and a faint green glow show through it, blurred, which is what
// says "on top" [06]. Glass is kept to this one first-impression moment and
// the navigation; content cards stay solid [07]. Near-solid where blur isn't
// supported or less transparency is asked for.
export function PickupPreview({ animate }: Props) {
  const post = enter(animate, 300);
  const request = enter(animate, 1100);

  return (
    <figure>
      <div aria-hidden="true" className="relative isolate pb-28 sm:pb-24">
        {/* The light the glass catches: a soft glow in the accent, behind the
            lower half where the request card sits. */}
        <div className="pointer-events-none absolute -inset-x-8 top-1/3 -bottom-10 -z-10 bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-leaf)_32%,transparent),transparent)] blur-2xl" />
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
            "absolute inset-x-0 bottom-0 ml-6 rounded-3xl bg-lifted/55 p-4 shadow-lift ring-1 ring-inset ring-fg/[0.1] backdrop-blur-xl backdrop-saturate-150 supports-[not(backdrop-filter:blur(0))]:bg-lifted [@media(prefers-reduced-transparency:reduce)]:bg-lifted sm:ml-14",
            request.className
          )}
          style={request.style}
        >
          {/* A faint highlight along the top edge, where light would catch glass. */}
          <span className="pointer-events-none absolute inset-0 rounded-3xl shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]" />
          <div className="relative flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-leaf font-display text-[15px] font-semibold text-canvas">
              RK
            </span>
            <div className="min-w-0">
              <p className="font-medium text-fg">Rahul K. wants this food</p>
              <p className="text-sm text-fg-muted">Selfie added. Will come in 15 minutes.</p>
            </div>
          </div>
          <div className="relative mt-4 grid grid-cols-2 gap-2 text-sm">
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
