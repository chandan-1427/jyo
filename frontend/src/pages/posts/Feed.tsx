import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPinOff, Plus, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api/api";
import { getCurrentLocation, type Coords } from "@/lib/location/location";
import { isWithinTirupati } from "@/lib/location/geofence";
import { useV2Theme } from "@/lib/theme";
import { useAuth } from "@/context/AuthContext";
import type { FoodPost } from "@/types/api";
import PostCard from "@/components/posts/PostCard";
import OutOfRegionCard from "@/components/posts/OutOfRegionCard";
import { FeedIllustration } from "@/components/posts/FeedIllustration";
import { EmptyPlateIllustration } from "@/components/posts/EmptyPlateIllustration";
import { PostGrid, PostGridSkeleton } from "@/components/posts/PostGrid";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";

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

  // No visible title: the nav already says this is the feed. Screen readers
  // still get one to land on.
  const heading = <h1 className="sr-only">Food near you</h1>;

  // A disabled query (no coords yet, e.g. geolocation failed) reports
  // isPending: true forever in TanStack Query — gating on !!coords too
  // stops that from masking the locationError branch below forever.
  if (locating || (!!coords && postsLoading && !outOfRegion)) {
    return (
      <div className="relative isolate text-fg">
        <FeedIllustration />
        {heading}
        <PostGridSkeleton />
      </div>
    );
  }

  if (locationError) {
    return (
      <div className="relative isolate text-fg">
        <FeedIllustration />
        {heading}
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
        {heading}
        <OutOfRegionCard />
      </div>
    );
  }

  return (
    <div className="relative isolate text-fg">
      <FeedIllustration />
      {heading}
      <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
        {demoButton}
        <Button to="/create" iconLeft={<Plus className="size-4" aria-hidden="true" />}>
          Post food
        </Button>
      </div>

      {/* A failed update keeps showing the posts already loaded. */}
      {fetchError && <Notice tone="error" className="mb-6">{fetchError.message}</Notice>}
      {demoError && <Notice tone="error" className="mb-6">{demoError}</Notice>}

      {posts.length === 0 ? (
        <EmptyState
          art={<EmptyPlateIllustration className="-mt-2 mb-1 w-36 sm:w-44" />}
          title="No food near you right now"
        >
          <p>New posts show up here on their own. You can also share food yourself.</p>
        </EmptyState>
      ) : (
        <PostGrid>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </PostGrid>
      )}
    </div>
  );
}
