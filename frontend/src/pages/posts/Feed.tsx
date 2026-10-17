import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, MapPinOff, Plus, RefreshCw, Sparkles, UtensilsCrossed } from "lucide-react";
import { apiFetch } from "@/lib/api/api";
import { getCurrentLocation, type Coords } from "@/lib/location/location";
import { isWithinTirupati } from "@/lib/location/geofence";
import { useV2Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import type { FoodPost } from "@/types/api";
import PostCard from "@/components/posts/PostCard";
import OutOfRegionCard from "@/components/posts/OutOfRegionCard";
import { FeedIllustration } from "@/components/posts/FeedIllustration";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";

// Columns come from a minimum card width rather than breakpoints, so a card
// is never squeezed narrow enough to cut off the pickup time.
const GRID = "grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-5";

// Same shape as a PostCard, so nothing jumps when the real posts arrive.
function CardSkeleton() {
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

function Header({ subtitle, actions }: { subtitle: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Food near you</h1>
        <p className="mt-1.5 flex items-center gap-1.5 text-fg-muted">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          {subtitle}
        </p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export default function Feed() {
  useV2Theme();
  const { user, startDemo } = useAuth();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState("");
  const [startingDemo, setStartingDemo] = useState(false);
  const [demoError, setDemoError] = useState("");

  useEffect(() => {
    getCurrentLocation()
      .then(setCoords)
      .catch((err: unknown) => {
        if (err instanceof Error) setLocationError(err.message);
      })
      .finally(() => setLocating(false));
  }, []);

  // Out-of-region visitors get the demo gate instead of an empty feed —
  // once user.isDemo is true (from either this gate or the header's
  // "Explore as Demo" button) the real geolocation no longer matters, since
  // the backend's own geofence bypass takes over. See docs/demo-mode-plan.md.
  const outOfRegion = !!coords && !user?.isDemo && !isWithinTirupati(coords.lat, coords.lng);

  const {
    data,
    error: fetchError,
    isPending: postsLoading,
    refetch,
  } = useQuery<{ posts: FoodPost[] }>({
    queryKey: ["posts", "feed", coords?.lat, coords?.lng],
    queryFn: () => apiFetch(`/posts?lat=${coords!.lat}&lng=${coords!.lng}`),
    enabled: !!coords && !outOfRegion,
    // The server pushes a "feed" event whenever a post changes (see
    // Navbar.tsx), so this is only a backstop for a connection that died
    // without the browser noticing.
    refetchInterval: 5 * 60_000,
  });
  const posts = data?.posts ?? [];

  // Tracked separately from the query's isFetching, which is also true for
  // pushed and background refetches; the button should only spin when the
  // person asked for a refresh.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleStartDemo = async () => {
    setStartingDemo(true);
    setDemoError("");
    try {
      await startDemo();
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : "Couldn't start the demo. Please try again.");
    } finally {
      setStartingDemo(false);
    }
  };

  const demoButton = !user?.isDemo && (
    <Button
      variant="secondary"
      onClick={handleStartDemo}
      loading={startingDemo}
      iconLeft={<Sparkles className="size-4 text-leaf" aria-hidden="true" />}
    >
      {startingDemo ? "Starting…" : "Try the demo"}
    </Button>
  );

  // A disabled query (no coords yet, e.g. geolocation failed) reports
  // isPending: true forever in TanStack Query — gating on !!coords too
  // stops that from masking the locationError branch below forever.
  if (locating || (!!coords && postsLoading && !outOfRegion)) {
    return (
      <div className="relative isolate text-fg">
        <FeedIllustration />
        <Header subtitle={locating ? "Finding your location…" : "Looking for food near you…"} />
        <div className={GRID} aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (locationError) {
    return (
      <div className="relative isolate text-fg">
        <FeedIllustration />
        <Header subtitle="Location needed" />
        <EmptyState
          icon={<MapPinOff />}
          title="We couldn't find your location"
          actions={<Button onClick={() => window.location.reload()}>Try again</Button>}
        >
          <p>{locationError}</p>
          <p className="mt-2">Jyo shows food within 20 km of you, so it needs your location.</p>
        </EmptyState>
      </div>
    );
  }

  if (outOfRegion) {
    return (
      <div className="relative isolate text-fg">
        <FeedIllustration />
        <Header subtitle="Outside the service area" />
        <OutOfRegionCard />
      </div>
    );
  }

  return (
    <div className="relative isolate text-fg">
      <FeedIllustration />
      <Header
        subtitle={`${posts.length} ${posts.length === 1 ? "post" : "posts"} within 20 km`}
        actions={
          <>
            <Button to="/create" iconLeft={<Plus className="size-4" aria-hidden="true" />}>
              Post food
            </Button>
            {demoButton}
            <Button
              variant="secondary"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh"
              className="size-10 px-0"
            >
              <RefreshCw className={cn("size-4", refreshing && "motion-safe:animate-spin")} aria-hidden="true" />
            </Button>
          </>
        }
      />

      {/* A failed refresh keeps showing the posts already loaded. */}
      {fetchError && <Notice tone="error" className="mb-6">{fetchError.message}</Notice>}
      {demoError && <Notice tone="error" className="mb-6">{demoError}</Notice>}

      {posts.length === 0 ? (
        <EmptyState icon={<UtensilsCrossed />} title="No food near you right now">
          <p>New posts show up here on their own. You can also share food yourself.</p>
        </EmptyState>
      ) : (
        <div className={GRID}>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
