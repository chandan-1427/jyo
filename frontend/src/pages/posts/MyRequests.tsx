import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListFilter, MapPin, RotateCw, X } from "lucide-react";
import { apiFetch } from "@/lib/api/api";
import { formatDate } from "@/lib/format";
import { useV2Theme } from "@/lib/theme";
import { useSearch } from "@/lib/useSearch";
import type { FoodPost, MyRequest } from "@/types/api";
import PostCard from "@/components/posts/PostCard";
import { FindFoodIllustration } from "@/components/posts/FindFoodIllustration";
import { EmptySlipIllustration } from "@/components/posts/EmptySlipIllustration";
import { PostGrid, PostGridSkeleton } from "@/components/posts/PostGrid";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSection } from "@/components/ui/ListSection";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { SearchField } from "@/components/ui/TextField";

// A request's stages, from the picker's side.
type Group = "waiting" | "approved" | "collected" | "declined" | "cancelled";
type Filter = "all" | Group;

const GROUPS: Group[] = ["approved", "waiting", "collected", "declined", "cancelled"];

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "waiting", label: "Waiting" },
  { value: "approved", label: "Approved" },
  { value: "collected", label: "Collected" },
  { value: "declined", label: "Declined" },
  { value: "cancelled", label: "Cancelled" },
];

const TITLES: Record<Group, string> = {
  waiting: "Waiting for an answer",
  approved: "Approved",
  collected: "Collected",
  declined: "Declined",
  cancelled: "Cancelled",
};

// Shown when a filter has nothing in it (without a search narrowing it).
const NOTHING_IN: Record<Group, string> = {
  waiting: "Nothing waiting for an answer",
  approved: "No approved pickups right now",
  collected: "Nothing collected yet",
  declined: "None of your requests were declined",
  cancelled: "You haven't cancelled any requests",
};

// Where a request stands, from the picker's side, and what its card's button
// leads to. An approved pickup is the one thing waiting on them, so only
// that is marked for attention.
function describe(r: MyRequest): { group: Group; text: string; cta?: string; attention?: boolean } {
  if (r.status === "pending") return { group: "waiting", text: "Waiting for their answer" };
  if (r.status === "approved") {
    if (r.postStatus === "completed") return { group: "collected", text: "Collected" };
    return { group: "approved", text: "Approved, go pick it up", cta: "Pick up", attention: true };
  }
  if (r.status === "cancelled") return { group: "cancelled", text: "You cancelled" };
  // The expiry job also marks a waiting request declined when time runs out;
  // the card says which it was.
  return { group: "declined", text: r.postStatus === "expired" ? "Ran out of time before an answer" : "Declined" };
}

// Groups in GROUPS order; within the two live ones, soonest-ending first.
// The rest keep the server's newest-first order.
function byPickupEnd(a: MyRequest, b: MyRequest) {
  return new Date(a.pickupWindowEnd).getTime() - new Date(b.pickupWindowEnd).getTime();
}

// The request's post in the shape PostCard takes. posterId isn't sent (and
// isn't needed, since the button label is always given).
const asPost = (r: MyRequest): FoodPost => ({
  id: r.postId,
  posterId: "",
  title: r.postTitle,
  description: r.postDescription,
  photoUrl: r.postPhotoUrl,
  pickupWindowStart: r.pickupWindowStart,
  pickupWindowEnd: r.pickupWindowEnd,
  status: r.postStatus,
  isDemo: r.isDemo,
  createdAt: r.createdAt,
});

const findFoodButton = (
  <Button to="/feed" iconLeft={<MapPin className="size-4" aria-hidden="true" />}>
    Find food
  </Button>
);

export default function MyRequests() {
  useV2Theme();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [cancelling, setCancelling] = useState<MyRequest | null>(null);

  const { data, isPending, error, refetch } = useQuery<{ requests: MyRequest[] }>({
    queryKey: ["requests", "mine"],
    queryFn: () => apiFetch("/requests/mine"),
  });
  const requests = data?.requests ?? [];
  const count = (group: Group) => requests.filter((r) => describe(r).group === group).length;
  const ready = requests.filter((r) => describe(r).attention).length;

  // Only what matches the search (everything when it's empty).
  const search = useSearch(requests, (r) => `${r.postTitle} ${r.postDescription ?? ""}`);
  const shown = search.results;
  const inGroup = (group: Group) => {
    const list = shown.filter((r) => describe(r).group === group);
    return group === "approved" || group === "waiting" ? list.sort(byPickupEnd) : list;
  };
  const inFilter = filter === "all" ? GROUPS.flatMap(inGroup) : inGroup(filter);

  const subtitle = isPending
    ? "Loading your requests…"
    : ready > 0
      ? `${ready} ${ready === 1 ? "pickup is" : "pickups are"} ready for you`
      : // Only the groups that exist: "2 waiting, 1 collected", not "0 declined".
        (["waiting", "collected", "declined", "cancelled"] as const)
          .filter((g) => count(g) > 0)
          .map((g) => `${count(g)} ${g}`)
          .join(", ");

  // In "All" every card says where it stands. Under its own heading that
  // would mostly repeat the heading, so a finished request says when it was
  // made instead; a declined one keeps its reason (declined, or out of time).
  const statusOf = (r: MyRequest) => {
    const d = describe(r);
    if (filter === "all" || d.group === "waiting" || d.group === "approved" || d.group === "declined") return d;
    return { text: `Requested ${formatDate(r.createdAt)}` };
  };

  const card = (r: MyRequest) => (
    <PostCard
      key={r.id}
      post={asPost(r)}
      status={statusOf(r)}
      cta={describe(r).cta ?? "View"}
      // A request still waiting can be taken back from its card.
      action={
        r.status === "pending" && (
          <button
            type="button"
            onClick={() => setCancelling(r)}
            aria-label={`Cancel your request for "${r.postTitle}"`}
            className="grid size-9 cursor-pointer place-items-center rounded-lg bg-canvas/85 text-fg-muted ring-1 ring-inset ring-fg/[0.08] backdrop-blur-sm transition-colors hover:text-danger focus-visible:outline-2 focus-visible:outline-leaf"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )
      }
    />
  );

  const nothingHere =
    inFilter.length === 0 &&
    (search.searching ? (
      <EmptyState
        art={<EmptySlipIllustration className="-mt-2 mb-1 w-36 sm:w-44" />}
        title={`Nothing matches "${search.query.trim()}"`}
        actions={
          <Button variant="secondary" onClick={() => search.setQuery("")}>
            Clear search
          </Button>
        }
      >
        <p>Search looks in the titles and descriptions of the food you asked for.</p>
      </EmptyState>
    ) : (
      filter !== "all" && (
        <EmptyState
          art={<EmptySlipIllustration className="-mt-2 mb-1 w-36 sm:w-44" />}
          title={NOTHING_IN[filter]}
          actions={
            <Button variant="secondary" onClick={() => setFilter("all")}>
              Show all requests
            </Button>
          }
        />
      )
    ));

  return (
    <div className="text-fg">
      <PageHeader
        title="My requests"
        subtitle={subtitle}
        actions={
          requests.length > 0 && (
            <>
              {/* Full width on phones, where the actions sit under the title. */}
              <SearchField
                label="Search your requests"
                placeholder="Search your requests"
                value={search.query}
                onChange={search.setQuery}
                className="w-full sm:w-72"
              />
              {/* Six stages are too many for a row of buttons. Each shows how
                  many requests it has (of those matching the search). */}
              <SelectMenu
                label="Show requests"
                icon={<ListFilter />}
                options={FILTERS.map((f) => ({
                  ...f,
                  count: f.value === "all" ? shown.length : shown.filter((r) => describe(r).group === f.value).length,
                }))}
                value={filter}
                onChange={setFilter}
                className="w-full sm:w-48"
              />
              {findFoodButton}
            </>
          )
        }
      />

      {isPending ? (
        <PostGridSkeleton count={4} />
      ) : error ? (
        <EmptyState
          icon={<RotateCw />}
          title="We couldn't load your requests"
          actions={<Button onClick={() => refetch()}>Try again</Button>}
        >
          <p>{error.message}</p>
        </EmptyState>
      ) : requests.length === 0 ? (
        <EmptyState
          art={<FindFoodIllustration className="-mt-2 mb-1 w-36 sm:w-44" />}
          title="You haven't asked for any food yet"
          actions={findFoodButton}
        >
          <p>Find something nearby, send a request, and it shows up here.</p>
        </EmptyState>
      ) : nothingHere ? (
        nothingHere
      ) : filter === "all" ? (
        // Everything in one grid, in the same order the groups use.
        <PostGrid>{inFilter.map(card)}</PostGrid>
      ) : (
        <ListSection title={TITLES[filter]}>
          <PostGrid>{inFilter.map(card)}</PostGrid>
        </ListSection>
      )}

      {cancelling && (
        <ConfirmDialog
          title="Cancel your request?"
          description={`They won't see your request for "${cancelling.postTitle}" any more, and others can ask for it. You can ask again while it's still open.`}
          confirmLabel="Cancel request"
          busyLabel="Cancelling…"
          tone="danger"
          onConfirm={async () => {
            await apiFetch(`/requests/${cancelling.id}/cancel`, { method: "PUT" });
            queryClient.invalidateQueries({ queryKey: ["requests", "mine"] });
            queryClient.invalidateQueries({ queryKey: ["posts"] });
          }}
          onClose={() => setCancelling(null)}
        />
      )}
    </div>
  );
}
