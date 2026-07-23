import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { getCurrentLocation, type Coords } from "@/lib/location";
import type { FoodPost } from "@/types/api";
import PostCard from "@/components/PostCard";
import { MapPin, RefreshCw, Loader2, UtensilsCrossed, AlertCircle } from "lucide-react";

export default function Feed() {
  const [posts, setPosts] = useState<FoodPost[]>([]);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [fetchError, setFetchError] = useState("");

  const fetchPosts = useCallback(async (c: Coords) => {
    try {
      const data = await apiFetch(`/posts?lat=${c.lat}&lng=${c.lng}`);
      setPosts(data.posts);
      setFetchError("");
    } catch (err: unknown) {
      if (err instanceof Error) setFetchError(err.message);
    }
  }, []);

  useEffect(() => {
    getCurrentLocation()
      .then((c) => {
        setCoords(c);
        return fetchPosts(c);
      })
      .catch((err: unknown) => {
        if (err instanceof Error) setLocationError(err.message);
      })
      .finally(() => setLoading(false));
  }, [fetchPosts]);

  useEffect(() => {
    if (!coords) return;
    const interval = setInterval(() => fetchPosts(coords), 15_000);
    return () => clearInterval(interval);
  }, [coords, fetchPosts]);

  const handleRefresh = async () => {
    if (!coords || refreshing) return;
    setRefreshing(true);
    await fetchPosts(coords);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="px-4 py-24 flex flex-col items-center gap-3 font-medium tracking-wide">
        <Loader2 className="w-5 h-5 text-subtle animate-spin" />
        <p className="text-sm text-subtle">Detecting your location…</p>
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

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="cursor-pointer flex items-center gap-1.5 text-sm font-medium text-subtle hover:text-foreground transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed mt-1"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Soft error — a refresh failed, but we still show whatever posts we already have */}
      {fetchError && (
        <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-red-900/40 bg-red-950/30 px-3.5 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 mt-px shrink-0" />
          <p className="text-sm text-red-400 leading-snug">{fetchError}</p>
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