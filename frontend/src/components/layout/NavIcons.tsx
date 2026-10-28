import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Drawn for Jyo rather than taken from an icon set: a bowl of hot food for
// the feed, a serving cloche for posting, a stacked tiffin for your posts and
// an order slip for your requests. The selected tab's icon gets a heavier
// line and a soft fill, so it reads as chosen beyond its colour.
//
// Each also has a small pose for when it's selected: the steam rises, the
// cloche lid lifts, the tiffin handle rises, the slip tilts, the person's
// head lifts. Tabs are tapped constantly, so it's a 200ms nudge rather than
// a flourish, and a transition rather than a keyframe animation, so tapping
// away mid-way reverses it from wherever it got to. Off with reduced motion.
const POSE = "transition-[translate,rotate] duration-200 ease-out motion-reduce:transition-none";

function Icon({ active, children, className }: { active: boolean; children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.25 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn(
        // overflow-visible: a pose can lift a line just past the 24px box
        // (the tiffin handle does), which would otherwise be clipped.
        "size-6 overflow-visible [&_.fill]:fill-current [&_.fill]:transition-[fill-opacity] [&_.fill]:duration-200",
        active ? "[&_.fill]:[fill-opacity:0.3]" : "[&_.fill]:[fill-opacity:0]",
        className
      )}
    >
      {children}
    </svg>
  );
}

export function FeedIcon({ active }: { active: boolean }) {
  return (
    <Icon active={active}>
      <path className="fill" d="M4 12.5h16a8 8 0 0 1-16 0Z" />
      <g className={cn(POSE, active && "-translate-y-[1.5px]")}>
        <path d="M10 9.5c-.8-.75-.8-1.5 0-2.25s.8-1.5 0-2.25M14 9.5c-.8-.75-.8-1.5 0-2.25s.8-1.5 0-2.25" />
      </g>
    </Icon>
  );
}

export function PostFoodIcon({ active }: { active: boolean }) {
  return (
    <Icon active={active}>
      <g className={cn(POSE, active && "-translate-y-[1.5px]")}>
        <path className="fill" d="M4 16.5a8 8 0 0 1 16 0Z" />
        <path d="M12 8.5V6.25M10.75 6.25h2.5" />
      </g>
      <path d="M2.5 19.5h19" />
    </Icon>
  );
}

export function MyPostsIcon({ active }: { active: boolean }) {
  return (
    <Icon active={active}>
      <g className={cn(POSE, active && "-translate-y-[1.5px]")}>
        <path d="M8.5 7V5.5a3.5 3.5 0 0 1 7 0V7" />
      </g>
      <rect className="fill" x="5" y="7" width="14" height="14" rx="2.5" />
      <path d="M5 11.75h14M5 16.25h14" />
    </Icon>
  );
}

export function MyRequestsIcon({ active }: { active: boolean }) {
  return (
    <Icon active={active}>
      <g className={cn(POSE, "origin-center [transform-box:fill-box]", active && "-rotate-6")}>
        <path className="fill" d="M6 3.5h12v17l-2-1.25-2 1.25-2-1.25-2 1.25-2-1.25-2 1.25Z" />
        <path d="M9 8h6M9 11.5h6M9 15h3.5" />
      </g>
    </Icon>
  );
}

// The notifications bell in the top bar, drawn to match; "active" while its
// panel is open. Its pose is a small swing from the top. The unread dot is
// drawn on the bell (green, ringed in the page colour) so it swings with it
// rather than floating loose over it.
//
// Each time `ringKey` goes up (a notification arrived) the bell rings once:
// a short back-and-forth that settles. The key remounts the ringing group,
// which restarts the animation. A keyframe animation, since it's a one-off
// signal rather than a response to a tap; it never loops, and it's off with
// reduced motion. It's on its own group so it doesn't fight the pose.
export function BellIcon({
  active,
  dot,
  ringKey = 0,
  className,
}: {
  active: boolean;
  dot: boolean;
  ringKey?: number;
  className?: string;
}) {
  const fromTop = "origin-[12px_3.5px] [transform-box:view-box]";
  return (
    <Icon active={active} className={className}>
      <g key={ringKey} className={cn(fromTop, ringKey > 0 && "motion-safe:animate-bell-ring")}>
        <g className={cn(POSE, fromTop, active && "-rotate-12")}>
          <path className="fill" d="M6.25 16.5V11a5.75 5.75 0 0 1 11.5 0v5.5l1.5 2H4.75Z" />
          <path d="M12 5.25V3.5M10.25 20.75a1.9 1.9 0 0 0 3.5 0" />
          {dot && (
            <circle cx="17.25" cy="6" r="3.25" strokeWidth={1.5} className="fill-leaf stroke-canvas" />
          )}
        </g>
      </g>
    </Icon>
  );
}

// Without a photo: the familiar head-and-shoulders, so it reads as "you" at
// a glance, but outlined like the other tab icons rather than a solid grey
// silhouette. Its pose is the head lifting.
function PersonIcon({ active }: { active: boolean }) {
  return (
    <Icon active={active}>
      <g className={cn(POSE, active && "-translate-y-px")}>
        <circle className="fill" cx="12" cy="8" r="3.75" />
      </g>
      <path className="fill" d="M4.75 20.25c0-3.9 3.25-6.5 7.25-6.5s7.25 2.6 7.25 6.5Z" />
    </Icon>
  );
}

// Your photo when you've added one, with a ring marking it as the current
// tab (as the filled icons do for the others): a hairline like the tab bar's
// own edge, brighter so it reads. Otherwise the outlined person.
export function ProfileIcon({ src, active }: { src?: string | null; active: boolean }) {
  if (!src) return <PersonIcon active={active} />;
  return (
    <span
      className={cn(
        "grid size-7 place-items-center rounded-full ring-1 transition-[box-shadow] duration-200",
        active ? "ring-fg/30" : "ring-transparent"
      )}
    >
      <img src={src} alt="" className="size-[22px] rounded-full object-cover" />
    </span>
  );
}
