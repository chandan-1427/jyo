import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Drawn for Jyo rather than taken from an icon set: a bowl of hot food for
// the feed, a serving cloche for posting, a stacked tiffin for your posts and
// an order slip for your requests. The selected tab's icon gets a heavier
// line and a soft fill, so it reads as chosen beyond its colour.
function Icon({ active, children }: { active: boolean; children: ReactNode }) {
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
        "size-6 [&_.fill]:fill-current [&_.fill]:transition-[fill-opacity] [&_.fill]:duration-200",
        active ? "[&_.fill]:[fill-opacity:0.3]" : "[&_.fill]:[fill-opacity:0]"
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
      <path d="M10 9.5c-.8-.75-.8-1.5 0-2.25s.8-1.5 0-2.25M14 9.5c-.8-.75-.8-1.5 0-2.25s.8-1.5 0-2.25" />
    </Icon>
  );
}

export function PostFoodIcon({ active }: { active: boolean }) {
  return (
    <Icon active={active}>
      <path className="fill" d="M4 16.5a8 8 0 0 1 16 0Z" />
      <path d="M2.5 19.5h19M12 8.5V6.25M10.75 6.25h2.5" />
    </Icon>
  );
}

export function MyPostsIcon({ active }: { active: boolean }) {
  return (
    <Icon active={active}>
      <path d="M8.5 7V5.5a3.5 3.5 0 0 1 7 0V7" />
      <rect className="fill" x="5" y="7" width="14" height="14" rx="2.5" />
      <path d="M5 11.75h14M5 16.25h14" />
    </Icon>
  );
}

export function MyRequestsIcon({ active }: { active: boolean }) {
  return (
    <Icon active={active}>
      <path className="fill" d="M6 3.5h12v17l-2-1.25-2 1.25-2-1.25-2 1.25-2-1.25-2 1.25Z" />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" />
    </Icon>
  );
}

// Your photo, or a plain head-and-shoulders figure when you haven't added one.
// A ring marks it as the current tab, as the filled icons do for the others.
export function ProfileIcon({ src, active }: { src?: string | null; active: boolean }) {
  const clip = useId();
  return (
    <span
      className={cn(
        "grid size-7 place-items-center rounded-full ring-[1.5px] transition-[box-shadow] duration-200",
        active ? "ring-white" : "ring-transparent"
      )}
    >
      {src ? (
        <img src={src} alt="" className="size-[22px] rounded-full object-cover" />
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[22px]">
          <clipPath id={clip}>
            <circle cx="12" cy="12" r="12" />
          </clipPath>
          <g clipPath={`url(#${clip})`}>
            <rect width="24" height="24" className="fill-fg-subtle" />
            <circle cx="12" cy="9.5" r="4.25" className="fill-fg" />
            <ellipse cx="12" cy="22.5" rx="8.5" ry="6.5" className="fill-fg" />
          </g>
        </svg>
      )}
    </span>
  );
}
