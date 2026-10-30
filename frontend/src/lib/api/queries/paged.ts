import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/api";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

type PagedResponse<F extends string, T> = Record<F, T[]> & {
  nextCursor: string | null;
  // How many match the search under each filter, for the filter menu.
  counts: Record<string, number>;
  // How many there are at all, search aside: no results vs nothing yet.
  total: number;
};

// A list the server pages (GET /posts/mine, /requests/mine), filtered and
// searched on the server, a page of 20 at a time; LoadMore fetches the next
// as the end comes into view. `key` is the query key prefix the rest of the
// app invalidates (["posts", "mine"]), so live updates refresh every loaded
// page. The search is sent once typing pauses. While a new filter or search
// loads, the previous results stay up (isPlaceholderData) instead of the
// page flashing back to skeletons.
export function usePagedList<F extends string, T>({
  key,
  path,
  field,
  filter,
  search,
}: {
  key: readonly unknown[];
  path: string;
  field: F;
  filter: string;
  search: string;
}) {
  const searchTerm = useDebouncedValue(search.trim(), 250);

  const query = useInfiniteQuery({
    queryKey: [...key, filter, searchTerm],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ status: filter });
      if (searchTerm) params.set("search", searchTerm);
      if (pageParam) params.set("cursor", pageParam);
      return apiFetch(`${path}?${params}`) as Promise<PagedResponse<F, T>>;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: keepPreviousData,
  });

  const firstPage = query.data?.pages[0];
  return {
    ...query,
    items: query.data?.pages.flatMap((page) => page[field]) ?? [],
    counts: firstPage?.counts ?? {},
    total: firstPage?.total ?? 0,
    // The search the results are for (not what's mid-typing in the box).
    searchTerm,
  };
}
