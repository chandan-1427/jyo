import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { getCurrentLocation, type Coords } from "@/lib/location";
import { isWithinTirupati } from "@/lib/geofence";
import { useAuth } from "@/context/AuthContext";
import type { FoodPost } from "@/types/api";
import PostCard from "@/components/posts/PostCard";
import OutOfRegionCard from "@/components/posts/OutOfRegionCard";
import { MapPin, RefreshCw, Loader2, UtensilsCrossed, AlertCircle, Sparkles } from "lucide-react";

export default function Feed() {
  const { user, startDemo } = useAuth();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState("");
  const [startingDemo, setStartingDemo] = useState(false);

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
    isFetching: refreshing,
    refetch,
  } = useQuery<{ posts: FoodPost[] }>({
    queryKey: ["posts", "feed", coords?.lat, coords?.lng],
    queryFn: () => apiFetch(`/posts?lat=${coords!.lat}&lng=${coords!.lng}`),
    enabled: !!coords && !outOfRegion,
    refetchInterval: 15_000,
  });
  const posts = data?.posts ?? [];

  const handleRefresh = () => refetch();

  const handleStartDemo = async () => {
    setStartingDemo(true);
    try {
      await startDemo();
    } finally {
      setStartingDemo(false);
    }
  };

  // A disabled query (no coords yet, e.g. geolocation failed) reports
  // isPending: true forever in TanStack Query — gating on !!coords too
  // stops that from masking the locationError branch below forever.
  if (locating || (!!coords && postsLoading && !outOfRegion)) {
    return (
      <div className="px-4 py-24 flex flex-col items-center gap-3 font-medium tracking-wide">
        <Loader2 className="w-5 h-5 text-subtle animate-spin" />
        <p className="text-sm text-subtle">
          {locating ? "Detecting your location…" : "Loading nearby food…"}
        </p>
      </div>
    );
  }

  // Fatal: no location, nothing to show at all
  if (locationError) {
    return (
      <div className="px-4 py-24 flex flex-col items-center gap-4 font-medium tracking-wide">
        <div className="flex items-start gap-2.5 rounded-lg border border-red-900/40 bg-red-950/30 px-3.5 py-3 max-w-sm w-full">
          <AlertCircle className="w-4 h-4 text-red-400 mt-px shrink-0" />
          <p className="text-sm text-red-400 leading-snug">{locationError}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="cursor-pointer text-sm font-medium text-foreground underline underline-offset-2 hover:text-muted transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (outOfRegion) {
    return (
      <div className="px-4 py-8 font-medium tracking-wide">
        <div className="mb-6">
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin className="w-3.5 h-3.5 text-subtle" />
            <p className="text-sm text-subtle">Outside service area</p>
          </div>
          <h1 className="font-semibold text-2xl text-foreground tracking-tight">Nearby Food</h1>
        </div>
        <OutOfRegionCard />
      </div>
    );
  }

  return (
    <div className="px-4 py-8 font-medium tracking-wide">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin className="w-3.5 h-3.5 text-subtle" />
            <p className="text-sm text-subtle">Within 20 km · Tirupati</p>
          </div>
          <h1 className="font-semibold text-2xl text-foreground tracking-tight">
            Nearby Food
          </h1>
        </div>

        <div className="flex items-center gap-4 mt-1">
          {!user?.isDemo && (
            <button
              onClick={handleStartDemo}
              disabled={startingDemo}
              className="cursor-pointer flex items-center gap-1.5 text-sm font-medium text-accent hover:text-foreground transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {startingDemo ? "Starting…" : "Explore as Demo"}
            </button>
          )}

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="cursor-pointer flex items-center gap-1.5 text-sm font-medium text-subtle hover:text-foreground transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Soft error — a refresh failed, but we still show whatever posts we already have */}
      {fetchError && (
        <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-red-900/40 bg-red-950/30 px-3.5 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 mt-px shrink-0" />
          <p className="text-sm text-red-400 leading-snug">{fetchError.message}</p>
        </div>
      )}

      {/* Empty state */}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 border border-border rounded-xl bg-surface">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-background">
            <UtensilsCrossed className="w-5 h-5 text-subtle" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-medium text-muted">No food posts nearby right now</p>
            <p className="text-sm text-subtle">Check back soon or post your own!</p>
          </div>
          <Link
            to="/create"
            className="mt-1 text-sm font-medium text-foreground underline underline-offset-2 hover:text-muted transition-colors"
          >
            Post food
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}