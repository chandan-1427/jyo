import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, UtensilsCrossed, Trash2, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { FoodPost } from "@/types/api";
import { formatDate } from "@/lib/format";
import { LinkButton } from "@/components/ui/LinkButton";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default function MyPosts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<{ posts: FoodPost[] }>({
    queryKey: ["posts", "mine"],
    queryFn: () => apiFetch("/posts/mine"),
  });
  const posts = data?.posts ?? [];

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => apiFetch(`/posts/${postId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts", "mine"] }),
  });

  const handleDelete = (postId: string) => {
    setConfirmId(null);
    deleteMutation.mutate(postId);
  };

  if (isLoading) {
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
          <p className="text-sm text-red-400 leading-snug">{error.message}</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((post) => {
            const isDeletable = post.status !== "closed" && post.status !== "completed";
            const isConfirming = confirmId === post.id;
            const isDeleting = deleteMutation.isPending && deleteMutation.variables === post.id;

            return (
              <div
                key={post.id}
                className="bg-surface border border-border rounded-xl overflow-hidden hover:border-neutral-600 transition-colors duration-150 flex flex-col group"
              >
                {/* Thumbnail */}
                <div
                  className="cursor-pointer"
                  onClick={() => !isConfirming && navigate(`/posts/${post.id}`)}
                >
                  {post.photoUrl ? (
                    <img
                      src={post.photoUrl}
                      alt={post.title}
                      className="w-full h-36 object-cover"
                    />
                  ) : (
                    <div className="w-full h-36 bg-background flex items-center justify-center">
                      <UtensilsCrossed className="w-7 h-7 text-subtle" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 flex flex-col gap-2.5 flex-1">
                  <div
                    className="cursor-pointer flex items-start justify-between gap-2"
                    onClick={() => !isConfirming && navigate(`/posts/${post.id}`)}
                  >
                    <h2 className="font-semibold text-foreground text-sm leading-snug tracking-tight truncate">
                      {post.title}
                    </h2>
                    <StatusBadge status={post.status} />
                  </div>

                  <p className="text-xs text-subtle">{formatDate(post.createdAt)}</p>

                  {/* Delete / Confirm */}
                  {isDeletable && (
                    <div className="mt-auto pt-2.5 border-t border-border flex items-center justify-end">
                      {isConfirming ? (
                        <div className="flex items-center gap-2">
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
                          onClick={() => setConfirmId(post.id)}
                          className="cursor-pointer flex items-center gap-1.5 text-xs font-medium text-subtle hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}