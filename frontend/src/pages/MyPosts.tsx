import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2, UtensilsCrossed, ChevronRight, Trash2 } from "lucide-react";
import { apiFetch } from "../lib/api";
import type { FoodPost } from "../types/api";
import { formatDate } from "../lib/format";
import { LinkButton } from "../components/ui/LinkButton";
import { StatusBadge } from "../components/ui/StatusBadge";

export default function MyPosts() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<FoodPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/posts/mine")
      .then((data) => setPosts(data.posts))
      .catch((err: unknown) => {
        if (err instanceof Error) setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (postId: string) => {
    setDeletingId(postId);
    setConfirmId(null);
    try {
      await apiFetch(`/posts/${postId}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 flex flex-col items-center gap-3 font-medium tracking-wide">
        <Loader2 className="w-5 h-5 text-neutral-300 animate-spin" />
        <p className="text-sm text-neutral-400">Loading your posts…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 flex flex-col items-center gap-4 font-medium tracking-wide">
        <p className="text-sm text-neutral-500 text-center max-w-xs">{error}</p>
        <LinkButton
          as="button"
          label="Try again"
          onClick={() => window.location.reload()}
          className="text-sm font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-600 bg-transparent hover:bg-transparent shadow-none px-0 py-0"
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-1 font-medium tracking-wide">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-sm text-neutral-400 mb-1">Your activity</p>
          <h1 className="font-semibold text-2xl text-neutral-900 tracking-tight">My Posts</h1>
        </div>
        <LinkButton
          as="button"
          label="Post Food"
          onClick={() => navigate("/create")}
          icon={<Plus className="w-3.5 h-3.5" />}
          className="px-4 py-2"
        />
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
          {posts.map((post) => {
            const isDeletable = post.status !== "closed" && post.status !== "completed";
            const isConfirming = confirmId === post.id;
            const isDeleting = deletingId === post.id;

            return (
              <div
                key={post.id}
                className="bg-white border border-neutral-200 rounded-xl px-4 py-3.5 flex items-center gap-4 transition-colors duration-150 group"
              >
                {/* Thumbnail */}
                <div
                  className="cursor-pointer flex items-center gap-4 flex-1 min-w-0"
                  onClick={() => !isConfirming && navigate(`/posts/${post.id}`)}
                >
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
                    <p className="text-xs text-neutral-400 mt-0.5">{formatDate(post.createdAt)}</p>
                  </div>
                </div>

                {/* Status badge */}
                <StatusBadge status={post.status} />

                {/* Delete / Confirm */}
                {isDeletable && (
                  isConfirming ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleDelete(post.id)}
                        disabled={isDeleting}
                        className="cursor-pointer text-xs font-medium text-red-500 hover:text-red-700 transition-colors disabled:opacity-40"
                      >
                        {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Delete"}
                      </button>
                      <span className="text-neutral-200">|</span>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="cursor-pointer text-xs font-medium text-neutral-400 hover:text-neutral-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmId(post.id); }}
                      className="cursor-pointer p-1 rounded-md text-neutral-500 hover:text-red-400 hover:bg-red-50 shrink-0"
                      title="Delete post"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )
                )}

                {/* Chevron */}
                <ChevronRight
                  className="w-4 h-4 text-neutral-300 group-hover:text-neutral-400 transition-colors shrink-0 cursor-pointer"
                  onClick={() => !isConfirming && navigate(`/posts/${post.id}`)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}