import type { ReactNode } from "react";

// Set columns that step up with the screen: 2 on phones, 3, 4, then 5 from
// 1280px, where each card is still about 225px wide.
const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5";

export function PostGrid({ children }: { children: ReactNode }) {
  return <div className={GRID}>{children}</div>;
}

// Same shape as a PostCard, so nothing jumps when the real posts arrive.
function PostCardSkeleton() {
  return (
    <div className="shimmer relative rounded-2xl bg-lifted shadow-card ring-1 ring-inset ring-white/[0.08]">
      <div className="aspect-[3/2] bg-raised" />
      <div className="px-3 pt-1.5 pb-3 sm:px-3.5 sm:pt-2 sm:pb-3.5">
        <div className="h-4 w-3/4 rounded bg-lifted-top" />
        <div className="mt-3 h-3.5 w-2/3 rounded bg-lifted-top sm:mt-4 sm:h-4 sm:w-1/2" />
      </div>
    </div>
  );
}

export function PostGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className={GRID} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  );
}
