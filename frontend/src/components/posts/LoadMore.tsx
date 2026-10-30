import { useEffect, useRef } from "react";
import { PostGridSkeleton } from "./PostGrid";
import { Button } from "../ui/Button";

type Props = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  failed: boolean;
  fetchNextPage: () => unknown;
  // For screen readers while it loads, e.g. "Loading more posts".
  label: string;
};

// Sits after a paged grid and loads the next page once it's within 600px of
// the screen, so scrolling never meets the end before more arrives; skeleton
// cards stand in meanwhile. Observing again after each load means a short
// page that leaves it in view keeps loading. If a page fails, a button to
// retry takes over instead of retrying on every scroll.
export function LoadMore({ hasNextPage, isFetchingNextPage, failed, fetchNextPage, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasNextPage || isFetchingNextPage || failed) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) fetchNextPage();
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, failed, fetchNextPage]);

  if (!hasNextPage) return null;

  return (
    <div ref={ref} className="mt-3 sm:mt-4">
      {/* Always present, so the message is announced when it appears. */}
      <span role="status" className="sr-only">
        {isFetchingNextPage ? label : ""}
      </span>
      {failed ? (
        <div className="flex justify-center py-4">
          <Button variant="secondary" onClick={() => fetchNextPage()}>
            Couldn't load more. Try again
          </Button>
        </div>
      ) : (
        isFetchingNextPage && <PostGridSkeleton count={5} />
      )}
    </div>
  );
}
