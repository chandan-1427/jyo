import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Line drawings for the home page, built on one motif: the steel tiffin
// carrier, the box home food actually travels in from one house to another
// [04: motifs come from what the product is]. One stroke weight in the body
// text colour, with the leaf accent only on the part that carries the
// meaning (the steam, the time, the shared spot, the done tick) [07]. Each
// sits beside text that already says what it shows, so they're hidden from
// screen readers [04].

const LINE = "fill-none stroke-fg-muted";
const ACCENT = "fill-none stroke-leaf";

function Art({ viewBox, className, children }: { viewBox: string; className?: string; children: ReactNode }) {
  return (
    <svg
      viewBox={viewBox}
      aria-hidden="true"
      focusable="false"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
    >
      {children}
    </svg>
  );
}

// Posting: a phone photographing a steaming bowl.
export function PostArt({ className }: { className?: string }) {
  return (
    <Art viewBox="0 0 64 64" className={className}>
      <rect x="18" y="6" width="28" height="52" rx="6" className="fill-fg/5 stroke-fg-muted" />
      <path d="M28 10h8M23 36h18" className={LINE} />
      <path d="M24 36c0 6 3.6 9 8 9s8-3 8-9" className={LINE} />
      <path d="M28.5 30c-1.5-2 1.5-3.5 0-5.5M32 30c-1.5-2 1.5-3.5 0-5.5M35.5 30c-1.5-2 1.5-3.5 0-5.5" className={ACCENT} />
    </Art>
  );
}

// Asking: a selfie on the phone, and a clock for when they'll come.
export function AskArt({ className }: { className?: string }) {
  return (
    <Art viewBox="0 0 64 64" className={className}>
      <rect x="14" y="6" width="28" height="52" rx="6" className="fill-fg/5 stroke-fg-muted" />
      <circle cx="28" cy="26" r="6" className={LINE} />
      <path d="M18.5 44c1.6-6 5.2-9 9.5-9s7.9 3 9.5 9" className={LINE} />
      <circle cx="46" cy="44" r="9" className="fill-raised stroke-leaf" />
      <path d="M46 39.5V44l3 2" className={ACCENT} />
    </Art>
  );
}

// Saying yes: the pickup spot, now shared, with a tick.
export function ApproveArt({ className }: { className?: string }) {
  return (
    <Art viewBox="0 0 64 64" className={className}>
      <path d="M32 58S14 40 14 26a18 18 0 0 1 36 0c0 14-18 32-18 32Z" className="fill-fg/5 stroke-fg-muted" />
      <circle cx="32" cy="26" r="9" className="fill-leaf/15 stroke-leaf" />
      <path d="M28 26.2l2.8 2.8 5.2-5.6" className={ACCENT} />
    </Art>
  );
}

// Picked up: a small tiffin carrier, with a tick.
export function CollectArt({ className }: { className?: string }) {
  return (
    <Art viewBox="0 0 64 64" className={className}>
      <path d="M18 54V24c0-12 28-12 28 0v30M28 12.5c1.2-2 2.4-3 4-3s2.8 1 4 3" className={LINE} />
      <rect x="21" y="23" width="22" height="14" rx="6" className="fill-fg/5 stroke-fg-muted" />
      <rect x="21" y="39" width="22" height="14" rx="6" className="fill-fg/5 stroke-fg-muted" />
      <circle cx="48" cy="48" r="9" className="fill-raised stroke-leaf" />
      <path d="M44.2 48.2l2.6 2.6 4.8-5.2" className={ACCENT} />
    </Art>
  );
}

// A three-tier steel tiffin carrier: the frame rises up the sides and curves
// over the top into the handle, and each tier is a rounded container held by
// a latch. The middle tier is the accent: the food being passed on.
export function TiffinArt({ className }: { className?: string }) {
  return (
    <Art viewBox="0 0 120 120" className={className}>
      <path d="M32 104V44C32 18 88 18 88 44v60M52 22.5c2.4-4 5-6 8-6s5.6 2 8 6M40 40h40M28 104h8M84 104h8" className={LINE} />
      <rect x="37" y="42" width="46" height="18" rx="8" className="fill-fg/5 stroke-fg-muted" />
      <rect x="37" y="62" width="46" height="18" rx="8" className="fill-leaf/15 stroke-leaf" />
      <rect x="37" y="82" width="46" height="18" rx="8" className="fill-fg/5 stroke-fg-muted" />
      {[51, 71, 91].flatMap((y) =>
        [32, 88].map((x) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="2.5" className={cn("fill-canvas", y === 71 ? "stroke-leaf" : "stroke-fg-muted")} />
        ))
      )}
    </Art>
  );
}
