import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2, UtensilsCrossed, ChevronRight } from "lucide-react";
import { apiFetch } from "../lib/api";
import type { FoodPost } from "../types/api";

// ── Module level ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<FoodPost["status"], string> = {
  open:             "bg-emerald-50 text-emerald-600 border-emerald-100",
  pending_approval: "bg-amber-50 text-amber-600 border-amber-100",
  closed:           "bg-neutral-100 text-neutral-500 border-neutral-200",
  expired:          "bg-red-50 text-red-400 border-red-100",
};

const STATUS_LABELS: Record<FoodPost["status"], string> = {
  open:             "Open",
  pending_approval: "Pending",
  closed:           "Closed",
  expired:          "Expired",
};

// ─────────────────────────────────────────────────────────────────────────────

export default function MyPosts() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<FoodPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/posts/mine")
      .then((data) => setPosts(data.posts))
      .catch((err: unknown) => {
        if (err instanceof Error) setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 flex flex-col items-center gap-3 font-geist font-medium tracking-wide">
        <Loader2 className="w-5 h-5 text-neutral-300 animate-spin" />
        <p className="text-sm text-neutral-400">Loading your posts…</p>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 flex flex-col items-center gap-4 font-geist font-medium tracking-wide">
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

  // ── Page ────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-6 py-1 font-geist font-medium tracking-wide">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-sm text-neutral-400 mb-1">
            Your activity
          </p>
          <h1 className="font-geist font-semibold text-2xl text-neutral-900 tracking-tight">
            My Posts
          </h1>
        </div>
        <button
          onClick={() => navigate("/create")}
          className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
        >
          <Plus className="w-3.5 h-3.5" />
          Post Food
        </button>
      </div>

      {/* Empty state */}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 border border-neutral-100 rounded-xl bg-white">
          <UtensilsCrossed className="w-7 h-7 text-neutral-200" />
          <div className="text-center">
            <p className="text-sm font-medium text-neutral-600">No posts yet</p>
            <p className="text-sm text-neutral-400 mt-0.5">Share food with your community.</p>
          </div>
          <button
            onClick={() => navigate("/create")}
            className="cursor-pointer text-sm font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-600 transition-colors mt-1"
          >
            Post your first one
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {posts.map((post) => (
            <div
              key={post.id}
              onClick={() => navigate(`/posts/${post.id}`)}
              className="bg-white border border-neutral-200 rounded-xl px-4 py-3.5 flex items-center gap-4 cursor-pointer hover:border-neutral-200 hover:bg-neutral-50 transition-colors duration-150 group"
            >
              {/* Thumbnail */}
              {post.photoUrl ? (
                <img
                  src={post.photoUrl}
                  alt={post.title}
                  className="w-14 h-14 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                  <UtensilsCrossed className="w-5 h-5 text-neutral-300" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">{post.title}</p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {new Date(post.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>

              {/* Status badge */}
              <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium border shrink-0 ${STATUS_STYLES[post.status]}`}>
                {STATUS_LABELS[post.status]}
              </span>

              {/* Chevron */}
              <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-400 transition-colors shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}