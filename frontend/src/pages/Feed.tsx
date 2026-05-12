import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "../lib/api";
import { getCurrentLocation, type Coords } from "../lib/location";
import type { FoodPost } from "../types/api";
import PostCard from "../components/PostCard";

export default function Feed() {
  const [posts, setPosts] = useState<FoodPost[]>([]);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(true);
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
    const interval = setInterval(() => fetchPosts(coords), 60_000);
    return () => clearInterval(interval);
  }, [coords, fetchPosts]);

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 flex flex-col items-center gap-3 font-work">
        <div className="w-5 h-5 rounded-full border-2 border-neutral-200 border-t-neutral-500 animate-spin" />
        <p className="text-sm text-neutral-400">Detecting your location…</p>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 flex flex-col items-center gap-4 font-work">
        <p className="text-sm text-neutral-500 text-center max-w-xs">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="cursor-pointer text-sm font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-600 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── Feed ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-6 py-1 font-work">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm text-neutral-400 mb-1">
            Within 10 km · Tirupati
          </p>
          <h1 className="font-geist font-semibold text-2xl text-neutral-900 tracking-tight">
            Nearby Food
          </h1>
        </div>
        <button
          onClick={() => coords && fetchPosts(coords)}
          className="cursor-pointer text-sm text-neutral-400 hover:text-neutral-800 transition-colors duration-150"
        >
          Refresh
        </button>
      </div>

      {/* Empty state */}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-2 border border-neutral-100 rounded-xl bg-white">
          <p className="text-2xl">🍽️</p>
          <p className="text-sm font-medium text-neutral-600 mt-1">No food posts nearby right now.</p>
          <p className="text-sm text-neutral-400">Check back soon or post your own!</p>
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