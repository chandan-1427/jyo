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

  // On mount — get location then fetch posts
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

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!coords) return;
    const interval = setInterval(() => fetchPosts(coords), 60_000);
    return () => clearInterval(interval);
  }, [coords, fetchPosts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
        Detecting your location...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <p className="text-gray-500 text-sm">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-orange-500 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">Nearby Food</h1>
        <button
          onClick={() => coords && fetchPosts(coords)}
          className="text-sm text-orange-500 hover:underline"
        >
          Refresh
        </button>
      </div>

      {/* Empty state */}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
          <p className="text-2xl">🍽️</p>
          <p className="text-gray-500 text-sm">No food posts nearby right now.</p>
          <p className="text-gray-400 text-xs">Check back soon or post your own!</p>
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