import type { ReactNode } from "react";

// Columns come from a minimum card width rather than breakpoints, so a card
// is never squeezed narrow enough to cut off the pickup time.
const GRID = "grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-5";

export function PostGrid({ children }: { children: ReactNode }) {
  return <div className={GRID}>{children}</div>;
}

// Same shape as a PostCard, so nothing jumps when the real posts arrive.
function PostCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-raised shadow-card ring-1 ring-inset ring-fg/[0.06] motion-safe:animate-pulse">
      <div className="aspect-[3/2] bg-lifted" />
      <div className="p-4">
        <div className="h-5 w-3/4 rounded bg-lifted" />
        <div className="mt-2.5 h-4 w-full rounded bg-lifted" />
        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="h-4 w-1/2 rounded bg-lifted" />
          <div className="h-8 w-24 rounded-lg bg-lifted" />
        </div>
      </div>
    </div>
  );
}

export function PostGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={GRID} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  );
}
