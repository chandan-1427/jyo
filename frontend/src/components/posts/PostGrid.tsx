import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Columns come from a minimum card width rather than breakpoints, so a card
// is never squeezed narrow enough to cut off the pickup time. Compact rows
// (PostCard's `compact`) sit closer together on phones.
const grid = (compact?: boolean) =>
  cn("grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-5", compact && "max-sm:gap-3");

export function PostGrid({ children, compact }: { children: ReactNode; compact?: boolean }) {
  return <div className={grid(compact)}>{children}</div>;
}

// Same shape as a PostCard, so nothing jumps when the real posts arrive.
function PostCardSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div className={cn("shimmer relative rounded-2xl bg-raised shadow-card ring-1 ring-inset ring-fg/[0.06]", compact && "max-sm:flex max-sm:gap-3 max-sm:p-2.5")}>
      <div className={cn("aspect-[3/2] bg-lifted", compact && "max-sm:aspect-auto max-sm:size-20 max-sm:shrink-0 max-sm:rounded-md")} />
      <div className={cn("p-4", compact && "max-sm:flex max-sm:flex-1 max-sm:flex-col max-sm:p-0 max-sm:pr-1.5")}>
        <div className={cn("h-5 w-3/4 rounded bg-lifted", compact && "max-sm:mt-0.5")} />
        <div className={cn("mt-2.5 h-4 w-full rounded bg-lifted", compact && "max-sm:mt-2 max-sm:w-2/3")} />
        <div className={cn("mt-6 flex items-center justify-between gap-3", compact && "max-sm:mt-auto")}>
          <div className="h-4 w-1/2 rounded bg-lifted" />
          <div className={cn("h-8 w-24 rounded-lg bg-lifted", compact && "max-sm:hidden")} />
        </div>
      </div>
    </div>
  );
}

export function PostGridSkeleton({ count = 8, compact }: { count?: number; compact?: boolean }) {
  return (
    <div className={grid(compact)} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <PostCardSkeleton key={i} compact={compact} />
      ))}
    </div>
  );
}
