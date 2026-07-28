import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, HandPlatter, X, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";

type MyRequest = {
  id: string;
  postId: string;
  postTitle: string;
  pickerName: string;
  etaMinutes: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  createdAt: string;
};

export default function MyRequests() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<{ requests: MyRequest[] }>({
    queryKey: ["requests", "mine"],
    queryFn: () => apiFetch("/requests/mine"),
  });
  const requests = data?.requests ?? [];

  const cancelMutation = useMutation({
    mutationFn: (requestId: string) => apiFetch(`/requests/${requestId}/cancel`, { method: "PUT" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["requests", "mine"] }),
  });

  if (isLoading) {
    return (
      <div className="px-6 py-20 flex flex-col items-center gap-3 font-medium tracking-wide">
        <Loader2 className="w-5 h-5 text-subtle animate-spin" />
        <p className="text-sm text-subtle">Loading your requests…</p>
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
      <div className="mb-8">
        <p className="text-sm text-subtle mb-1">Your activity</p>
        <h1 className="font-semibold text-2xl text-foreground tracking-tight">My Requests</h1>
      </div>

      {/* Cancel error — surfaced once, above the list, not a native alert() */}
      {cancelMutation.error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-900/40 bg-red-950/30 px-3.5 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 mt-px shrink-0" />
          <p className="text-sm text-red-400 leading-snug">{cancelMutation.error.message}</p>
        </div>
      )}

      {/* Empty state */}
      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 border border-border rounded-xl bg-surface">
          <HandPlatter className="w-7 h-7 text-subtle" />
          <div className="text-center">
            <p className="text-sm font-medium text-muted">No requests yet</p>
            <p className="text-sm text-subtle mt-0.5">Find food near you and send a request.</p>
          </div>
          <button
            onClick={() => navigate("/feed")}
            className="cursor-pointer text-sm font-medium text-foreground underline underline-offset-2 hover:text-muted transition-colors mt-1"
          >
            Browse nearby food
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2.5 hover:border-border-strong transition-colors duration-150 group"
            >
              {/* Info */}
              <div
                className="cursor-pointer flex items-start justify-between gap-2"
                onClick={() => navigate(`/posts/${req.postId}`)}
              >
                <h2 className="font-semibold text-foreground text-sm leading-snug tracking-tight truncate group-hover:text-muted transition-colors">
                  {req.postTitle}
                </h2>
                <StatusBadge status={req.status} />
              </div>

              <p className="text-xs text-subtle">{formatDate(req.createdAt)}</p>

              {/* Cancel */}
              {req.status === "pending" && (
                <div className="mt-auto pt-2.5 border-t border-border flex items-center justify-end">
                  <button
                    onClick={() => cancelMutation.mutate(req.id)}
                    disabled={cancelMutation.isPending && cancelMutation.variables === req.id}
                    className="cursor-pointer flex items-center gap-1.5 text-xs font-medium text-subtle hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    {cancelMutation.isPending && cancelMutation.variables === req.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <X className="w-3.5 h-3.5" />
                    }
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}