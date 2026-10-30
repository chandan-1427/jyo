import { useState } from "react";
import { ListFilter, Plus, RotateCw, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useV2Theme } from "@/lib/theme";
import { usePagedList } from "@/lib/api/queries/paged";
import { cn } from "@/lib/utils";
import type { FoodPost } from "@/types/api";
import PostCard from "@/components/posts/PostCard";
import { TiffinIllustration } from "@/components/posts/TiffinIllustration";
import { EmptyPlateIllustration } from "@/components/posts/EmptyPlateIllustration";
import { DeletePostDialog } from "@/components/posts/DeletePostDialog";
import { LoadMore } from "@/components/posts/LoadMore";
import { PostGrid, PostGridSkeleton } from "@/components/posts/PostGrid";
import { Button, ToolbarButton } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSection } from "@/components/ui/ListSection";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { SearchField } from "@/components/ui/TextField";

type Status = FoodPost["status"];
type Filter = "all" | "active" | "collected" | "ended";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "collected", label: "Collected" },
  { value: "ended", label: "Ended" },
];

// Shown when a filter has nothing in it (without a search narrowing it).
const NOTHING_IN: Record<Exclude<Filter, "all">, string> = {
  active: "No active posts right now",
  collected: "Nothing collected yet",
  ended: "No posts have ended without a pickup",
};

// What an active post's state means to the person who posted it. Only a
// waiting request needs them, so only that one is marked for attention.
const ACTIVE: Partial<Record<Status, { text: string; attention?: boolean }>> = {
  pending_approval: { text: "Someone asked for this", attention: true },
  closed: { text: "Approved, waiting for pickup" },
  open: { text: "No requests yet" },
};

const postFoodButton = (
  <Button to="/create" iconLeft={<Plus className="size-4" aria-hidden="true" />}>
    Post food
  </Button>
);

export default function MyPosts() {
  useV2Theme();
  // Opens on Active: what still needs you (answering requests, confirming
  // pickups) matters more than posts that have already ended.
  const [filter, setFilter] = useState<Filter>("active");
  const [searchText, setSearchText] = useState("");
  // The picked posts waiting on the delete confirmation.
  const [confirming, setConfirming] = useState<string[] | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  // Filtered, searched and ordered on the server (what needs you first),
  // a page at a time.
  const list = usePagedList<"posts", FoodPost>({
    key: ["posts", "mine"],
    path: "/posts/mine",
    field: "posts",
    filter,
    search: searchText,
  });
  const posts = list.items;
  const searching = list.searchTerm.length > 0;

  // Only ended posts can be picked, on the Ended filter; "Select all" takes
  // the ones loaded so far. Only ids still showing count, so a post that's
  // gone (deleted, or filtered out by the search) is never deleted unseen.
  const ended = filter === "ended" ? posts : [];
  const selected = ended.filter((p) => picked.has(p.id)).map((p) => p.id);
  const allSelected = ended.length > 0 && selected.length === ended.length;

  const stopSelecting = () => {
    setSelecting(false);
    setPicked(new Set());
  };
  // Picking turns select mode on; un-picking the last one turns it back off,
  // so the heading returns to its plain "Select" button.
  const setPicks = (next: Set<string>) => {
    if (next.size === 0) stopSelecting();
    else {
      setPicked(next);
      setSelecting(true);
    }
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicks(next);
  };
  const changeFilter = (next: Filter) => {
    stopSelecting();
    setFilter(next);
  };

  // How each card describes itself. In "All" there are no section titles, so
  // past posts say what they are; under their own section, that would repeat
  // the title, so they say when they were posted instead.
  const statusOf = (post: FoodPost) => {
    if (ACTIVE[post.status]) return ACTIVE[post.status]!;
    if (filter === "all") return { text: post.status === "completed" ? "Collected" : "Ended without a pickup" };
    return { text: `Posted ${formatDate(post.createdAt)}` };
  };

  const card = (post: FoodPost) => (
    <PostCard
      key={post.id}
      post={post}
      status={statusOf(post)}
      // Ended posts can be picked for deleting, on the Ended filter: ticking a
      // card's box (shown on hover) starts selecting, with it picked.
      selection={
        filter === "ended"
          ? { active: selecting, selected: picked.has(post.id), onToggle: () => toggle(post.id) }
          : undefined
      }
    />
  );

  const swapIn = "col-start-1 row-start-1 flex items-center gap-2 transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none";
  // On phones it takes its own line under the heading: "Select all" at the
  // start, the buttons at the end.
  const endedActions = (
    <div className="grid justify-items-end max-sm:w-full max-sm:justify-items-stretch">
      <div inert={!selecting} className={cn(swapIn, "max-sm:justify-end", selecting ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-3 opacity-0")}>
        <Checkbox
          label="Select all"
          checked={allSelected}
          indeterminate={selected.length > 0 && !allSelected}
          onChange={() => setPicks(allSelected ? new Set() : new Set(ended.map((p) => p.id)))}
          className="mr-2 max-sm:mr-auto"
        />
        <Button size="sm" variant="ghost" onClick={stopSelecting}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="dangerSolid"
          disabled={selected.length === 0}
          onClick={() => setConfirming(selected)}
          iconLeft={<Trash2 className="size-4" aria-hidden="true" />}
          // Wide enough for "Delete (99)" with same-width digits, so the count
          // changing (or appearing) doesn't shift the buttons beside it.
          className="w-32 tabular-nums"
        >
          Delete{selected.length > 0 && ` (${selected.length})`}
        </Button>
      </div>
      {/* The other way in, besides ticking a card's hover checkbox. */}
      <div inert={selecting} className={cn(swapIn, "max-sm:justify-end", selecting ? "pointer-events-none -translate-x-3 opacity-0" : "translate-x-0 opacity-100")}>
        <Button size="sm" variant="secondary" onClick={() => setSelecting(true)}>
          Select
        </Button>
      </div>
    </div>
  );

  const nothingHere =
    posts.length === 0 &&
    (searching ? (
      <EmptyState
        art={<EmptyPlateIllustration className="-mt-2 mb-1 w-36 sm:w-44" />}
        title={`Nothing matches "${list.searchTerm}"`}
        actions={
          <Button variant="secondary" onClick={() => setSearchText("")}>
            Clear search
          </Button>
        }
      >
        <p>Search looks in your posts' titles and descriptions.</p>
      </EmptyState>
    ) : (
      filter !== "all" && (
        <EmptyState
          art={<EmptyPlateIllustration className="-mt-2 mb-1 w-36 sm:w-44" />}
          title={NOTHING_IN[filter]}
          actions={
            <Button variant="secondary" onClick={() => changeFilter("all")}>
              Show all posts
            </Button>
          }
        />
      )
    ));

  // The grid, the next page loading under it, and a dimmed look while a new
  // filter or search replaces what's showing.
  const grid = (
    <div className={cn("transition-opacity duration-150", list.isPlaceholderData && "opacity-60")}>
      <PostGrid>{posts.map(card)}</PostGrid>
      <LoadMore
        hasNextPage={list.hasNextPage}
        isFetchingNextPage={list.isFetchingNextPage}
        failed={list.isFetchNextPageError}
        fetchNextPage={list.fetchNextPage}
        label="Loading more posts"
      />
    </div>
  );

  return (
    <div className="fill-screen text-fg">
      {/* No visible title: the nav already says which page this is. Screen
          readers still get one to land on. */}
      <h1 className="sr-only">My posts</h1>
      {list.total > 0 && (
        // One line, all 44px tall, at the right on wider screens. On phones
        // the filter and Post food shrink to icons so the search keeps room.
        <div className="mb-6 flex items-center gap-2 sm:justify-end">
          <SearchField
            label="Search your posts"
            placeholder="Search your posts"
            value={searchText}
            onChange={setSearchText}
            className="min-w-0 flex-1 sm:w-72 sm:flex-none"
          />
          {/* Each option shows how many posts it has (of those matching the search). */}
          <SelectMenu
            label="Show posts"
            icon={<ListFilter />}
            options={FILTERS.map((f) => ({ ...f, count: list.counts[f.value] ?? 0 }))}
            value={filter}
            onChange={changeFilter}
            compact
            className="shrink-0 sm:w-48"
          />
          <ToolbarButton to="/create" icon={<Plus className="size-4" aria-hidden="true" />}>
            Post food
          </ToolbarButton>
        </div>
      )}

      {list.isPending ? (
        <PostGridSkeleton />
      ) : list.error && !list.data ? (
        <EmptyState
          icon={<RotateCw />}
          title="We couldn't load your posts"
          actions={<Button onClick={() => list.refetch()}>Try again</Button>}
        >
          <p>{list.error.message}</p>
        </EmptyState>
      ) : list.total === 0 ? (
        <EmptyState
          art={<TiffinIllustration className="-mt-2 mb-1 w-36 sm:w-44" />}
          title="You haven't shared any food yet"
          actions={postFoodButton}
        >
          <p>Cooked too much? Post it here and someone nearby can pick it up.</p>
        </EmptyState>
      ) : nothingHere ? (
        nothingHere
      ) : filter === "all" ? (
        // Everything in one grid, in the same order the sections use.
        grid
      ) : (
        <ListSection
          title={{ active: "Active", collected: "Collected", ended: "Ended without a pickup" }[filter]}
          actions={filter === "ended" && endedActions}
        >
          {grid}
        </ListSection>
      )}

      {confirming && (
        <DeletePostDialog
          postIds={confirming}
          description={
            confirming.length > 1
              ? "They're removed from your posts for good. This can't be undone."
              : "It's removed from your posts for good. This can't be undone."
          }
          onClose={() => setConfirming(null)}
          onDeleted={stopSelecting}
        />
      )}
    </div>
  );
}
