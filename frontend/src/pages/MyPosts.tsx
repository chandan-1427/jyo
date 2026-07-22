import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2, UtensilsCrossed, ChevronRight, Trash2, AlertCircle } from "lucide-react";
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
      <div className="px-6 py-20 flex flex-col items-center gap-3 font-medium tracking-wide">
        <Loader2 className="w-5 h-5 text-subtle animate-spin" />
        <p className="text-sm text-subtle">Loading your posts…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-20 flex flex-col items-center gap-4 font-medium tracking-wide">
        <div className="flex items-start gap-2.5 rounded-lg border border-red-900/40 bg-red-950/30 px-3.5 py-3 max-w-sm w-full">
          <AlertCircle className="w-4 h-4 text-red-400 mt-px shrink-0" />
          <p className="text-sm text-red-400 leading-snug">{error}</p>
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
    <div className="px-6 py-8 font-medium tracking-wide">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-sm text-subtle mb-1">Your activity</p>
          <h1 className="font-semibold text-2xl text-foreground tracking-tight">My Posts</h1>
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
        <div className="flex flex-col items-center justify-center py-24 gap-3 border border-border rounded-xl bg-surface">
          <UtensilsCrossed className="w-7 h-7 text-subtle" />
          <div className="text-center">
            <p className="text-sm font-medium text-muted">No posts yet</p>
            <p className="text-sm text-subtle mt-0.5">Share food with your community.</p>
          </div>
          <button
            onClick={() => navigate("/create")}
            className="cursor-pointer text-sm font-medium text-foreground underline underline-offset-2 hover:text-muted transition-colors mt-1"
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
                className="bg-surface border border-border rounded-xl px-4 py-3.5 flex items-center gap-4 transition-colors duration-150 group"
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
                    <div className="w-14 h-14 rounded-lg bg-background flex items-center justify-center shrink-0">
                      <UtensilsCrossed className="w-5 h-5 text-subtle" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{post.title}</p>
                    <p className="text-xs text-subtle mt-0.5">{formatDate(post.createdAt)}</p>
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
                        className="cursor-pointer text-xs font-medium text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
                      >
                        {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Delete"}
                      </button>
                      <span className="text-border">|</span>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="cursor-pointer text-xs font-medium text-subtle hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmId(post.id); }}
                      className="cursor-pointer p-1 rounded-md text-muted hover:text-red-400 hover:bg-red-950/30 shrink-0"
                      title="Delete post"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )
                )}

                {/* Chevron */}
                <ChevronRight
                  className="w-4 h-4 text-subtle group-hover:text-muted transition-colors shrink-0 cursor-pointer"
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