import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// How far a press must move before it becomes a drag, so a tap never does.
const DRAG_THRESHOLD_PX = 3;
// Gap between the indicator and the screen edges it snaps to.
const EDGE_PX = 16;
// Phones have a 56px tab bar floating 12px above the bottom; the indicator
// stays above it.
const TAB_BAR_PX = 68;
// Collapse to just the countdown after this long with no interaction.
const IDLE_MS = 3000;
// How far ahead (ms) a throw is projected when picking the side to snap to.
const THROW_MS = 150;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// The lowest the indicator's bottom edge may go: above the tab bar on phones.
function bottomLimit() {
  const phone = window.matchMedia("(max-width: 639px)").matches;
  return window.innerHeight - EDGE_PX - (phone ? TAB_BAR_PX : 0);
}

// A long, gentle deceleration: quick to leave, slow to settle. As CSS
// transitions, both can be interrupted and retargeted mid-way.
const EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]";
// Gliding to a side after a drop.
const SETTLE = cn("transition-[translate] duration-700", EASE);

// A part of the indicator that folds away when it collapses. Animating the
// grid column from 1fr to 0fr animates its real width, which a plain
// `width: auto` can't do; `inert` takes the hidden part out of tab order.
//
// The two halves are sequenced so they don't fight: opening widens first and
// fades the content in once there's room for it; closing fades the content
// out first and then narrows.
function Fold({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      inert={!open}
      className={cn(
        "grid transition-[grid-template-columns,opacity] motion-reduce:transition-none",
        EASE,
        open
          ? "grid-cols-[1fr] opacity-100 [transition-duration:500ms,350ms] [transition-delay:0ms,150ms]"
          : "grid-cols-[0fr] opacity-0 [transition-duration:500ms,200ms] [transition-delay:80ms,0ms]"
      )}
    >
      <div className="min-w-0 overflow-hidden whitespace-nowrap">{children}</div>
    </div>
  );
}

// Jyo only operates within Tirupati, but anyone — a visitor outside it, or
// a Tirupati local exploring while there's little real content yet — can
// opt into a sandboxed demo session (see docs/demo-mode-plan.md). This stays
// on screen for the whole session so it's never mistaken for the real thing,
// with a countdown that auto-exits when the session ends (backend content
// expiry is independent and handled by the cleanup cron regardless of
// whether this fires).
//
// It sits on the left or right edge (bottom-right to start, above the tab
// bar on phones). Drag it anywhere and on release it glides to the nearer
// side, or the side it was thrown towards. After a few idle seconds it folds
// down to just the countdown; hover, tap or focus it to open it again.
export default function DemoIndicator() {
  const { user, stopDemo } = useAuth();
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [exiting, setExiting] = useState(false);

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

  // ─── Position ───────────────────────────────────────────────────────────
  // The indicator is anchored to a side (CSS left or right) so it folds
  // towards that edge. `top` is null until the first drag, when it starts
  // from its default bottom position. `shift` is a CSS `translate`: the live
  // drag offset, then the offset it glides back from after a drop.
  const ref = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState<"left" | "right">("right");
  const [top, setTop] = useState<number | null>(null);
  const [shift, setShift] = useState({ x: 0, y: 0 });
  const [settling, setSettling] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    // Where it actually was when grabbed, even mid-glide.
    base: { x: number; y: number };
    rect: DOMRect;
    active: boolean;
    // Last two samples, for the release velocity.
    last: { x: number; y: number; t: number };
    velocity: { x: number; y: number };
  } | null>(null);

  // ─── Collapse ───────────────────────────────────────────────────────────
  const [open, setOpen] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  // Fold away after a few quiet seconds; never while it's being used.
  useEffect(() => {
    if (!open || hovered || focused || dragging || exiting) return;
    const timer = setTimeout(() => setOpen(false), IDLE_MS);
    return () => clearTimeout(timer);
  }, [open, hovered, focused, dragging, exiting]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Presses on the button are clicks, never drags.
    if ((e.target as HTMLElement).closest("button")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const now = performance.now();

    // If it's still gliding to a side, catch it where it is right now rather
    // than letting it jump to the end of the glide.
    const [liveX = 0, liveY = 0] = getComputedStyle(e.currentTarget)
      .translate.split(" ")
      .map((v) => parseFloat(v) || 0);
    setSettling(false);
    setShift({ x: liveX, y: liveY });

    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      base: { x: liveX, y: liveY },
      rect: e.currentTarget.getBoundingClientRect(),
      active: false,
      last: { x: e.clientX, y: e.clientY, t: now },
      velocity: { x: 0, y: 0 },
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;

    const now = performance.now();
    const dt = now - d.last.t;
    if (dt > 0) {
      // Smoothed, so one jittery sample doesn't decide the throw.
      d.velocity = {
        x: d.velocity.x * 0.6 + ((e.clientX - d.last.x) / dt) * 0.4,
        y: d.velocity.y * 0.6 + ((e.clientY - d.last.y) / dt) * 0.4,
      };
    }
    d.last = { x: e.clientX, y: e.clientY, t: now };

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.active) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      d.active = true;
      setDragging(true);
    }
    // Follows the pointer exactly, kept fully on screen.
    setShift({
      x: d.base.x + clamp(dx, -d.rect.left, window.innerWidth - d.rect.right),
      y: d.base.y + clamp(dy, EDGE_PX - d.rect.top, bottomLimit() - d.rect.bottom),
    });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;

    // A tap (no drag) opens a folded indicator, and lets it finish any glide.
    if (!d.active) {
      setOpen(true);
      setSettling(true);
      setShift({ x: 0, y: 0 });
      return;
    }
    setDragging(false);

    // Held still before letting go: no throw.
    if (performance.now() - d.last.t > 100) d.velocity = { x: 0, y: 0 };

    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    // Pick the side the indicator is heading to: where it is now, carried a
    // little further by how fast it was moving when released.
    const projectedCenter = rect.left + rect.width / 2 + d.velocity.x * THROW_MS;
    const nextSide = projectedCenter < window.innerWidth / 2 ? "left" : "right";
    const nextTop = clamp(rect.top + d.velocity.y * (THROW_MS / 2), EDGE_PX, bottomLimit() - rect.height);
    const restingLeft = nextSide === "left" ? EDGE_PX : window.innerWidth - EDGE_PX - rect.width;

    // Re-anchor to the new side and offset it so nothing moves yet, then
    // release the offset on the next frame so it glides into place.
    setSide(nextSide);
    setTop(nextTop);
    setShift({ x: rect.left - restingLeft, y: rect.top - nextTop });
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setSettling(true);
        setShift({ x: 0, y: 0 });
      })
    );
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
    setSettling(true);
    setShift({ x: 0, y: 0 });
  };

  // If the window shrinks (rotation, resize), keep it on screen.
  const keepInView = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.bottom > bottomLimit() || rect.top < EDGE_PX) {
      setTop(clamp(rect.top, EDGE_PX, bottomLimit() - rect.height));
    }
  }, []);

  useEffect(() => {
    window.addEventListener("resize", keepInView);
    return () => window.removeEventListener("resize", keepInView);
  }, [keepInView]);

  if (!user?.isDemo) return null;

  const exit = async () => {
    setExiting(true);
    try {
      await stopDemo();
    } finally {
      setExiting(false);
    }
  };

  const time = remainingMs !== null ? formatRemaining(remainingMs) : null;

  return (
    <div
      ref={ref}
      role="region"
      aria-label={time ? `Demo mode, ends in ${time}` : "Demo mode"}
      // Folded, it can be reached with Tab; focusing it opens it.
      tabIndex={open ? undefined : 0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerEnter={(e) => {
        if (e.pointerType === "touch") return;
        setHovered(true);
        setOpen(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "touch") setHovered(false);
      }}
      // Only keyboard focus counts: a mouse or touch press also focuses it,
      // and that mustn't stop it from folding away again.
      onFocus={(e) => {
        if (!(e.target as HTMLElement).matches(":focus-visible")) return;
        setFocused(true);
        setOpen(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
      }}
      style={{
        translate: `${shift.x}px ${shift.y}px`,
        ...(top !== null && { top, bottom: "auto" }),
      }}
      className={cn(
        "fixed z-40 flex h-12 touch-none select-none items-center rounded-xl bg-lifted pr-1.5 pl-3.5 shadow-lift ring-1 ring-inset ring-fg/[0.08]",
        "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf",
        "motion-safe:animate-enter",
        side === "left" ? "left-4" : "right-4",
        top === null && "bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.25rem)] sm:bottom-6",
        settling && SETTLE,
        "motion-reduce:transition-none",
        dragging ? "cursor-grabbing" : "cursor-grab"
      )}
    >
      <Sparkles className="size-[18px] shrink-0 text-leaf" aria-hidden="true" />
      <Fold open={open}>
        <span className="pl-2 text-sm text-fg-muted">Ends in</span>
      </Fold>
      <span className="pl-1.5 text-sm font-medium tabular-nums text-fg">{time}</span>
      <Fold open={open}>
        <span className="block py-1 pr-0.5 pl-3">
          <Button variant="outline" size="sm" onClick={exit} loading={exiting}>
            {exiting ? "Ending…" : "Exit demo"}
          </Button>
        </span>
      </Fold>
      {/* Grows as the button folds away, so the folded pill gets even
          padding around the time without a jump. */}
      <Fold open={!open}>
        <span className="block w-2.5" />
      </Fold>
    </div>
  );
}
