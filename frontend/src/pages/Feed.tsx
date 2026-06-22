import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { getCurrentLocation, type Coords } from "../lib/location";
import type { FoodPost } from "../types/api";
import PostCard from "../components/PostCard";
import { MapPin, RefreshCw, Loader2, UtensilsCrossed } from "lucide-react";

export default function Feed() {
  const [posts, setPosts] = useState<FoodPost[]>([]);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchPosts = useCallback(async (c: Coords) => {
    try {
      const data = await apiFetch(`/posts?lat=${c.lat}&lng=${c.lng}`);
      setPosts(data.posts);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    }
  }, []);

  useEffect(() => {
    getCurrentLocation()
      .then((c) => {
        setCoords(c);
        return fetchPosts(c);
      })
      .catch((err: unknown) => {
        if (err instanceof Error) setError(err.message);
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
      <div className="max-w-4xl mx-auto px-4 py-24 flex flex-col items-center gap-3 font-medium tracking-wide">
        <Loader2 className="w-5 h-5 text-neutral-400 animate-spin" />
        <p className="text-sm text-neutral-400">Detecting your location…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 flex flex-col items-center gap-4  font-medium tracking-wide">
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 max-w-sm w-full">
          <span className="mt-px text-red-500 text-sm shrink-0">!</span>
          <p className="text-sm text-red-600 leading-snug">{error}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="cursor-pointer text-sm font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-600 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8  font-medium tracking-wide">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin className="w-3.5 h-3.5 text-neutral-400" />
            <p className="text-sm text-neutral-400">Within 20 km · Tirupati</p>
          </div>
          <h1 className=" font-semibold text-2xl text-neutral-900 tracking-tight">
            Nearby Food
          </h1>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="cursor-pointer flex items-center gap-1.5 text-sm font-medium text-neutral-400 hover:text-neutral-700 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed mt-1"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Empty state */}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 border border-neutral-100 rounded-xl bg-white">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-neutral-100">
            <UtensilsCrossed className="w-5 h-5 text-neutral-400" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-medium text-neutral-700">No food posts nearby right now</p>
            <p className="text-sm text-neutral-400">Check back soon or post your own!</p>
          </div>
          <Link
            to="/create"
            className="mt-1 text-sm font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-600 transition-colors"
          >
            Post food
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}