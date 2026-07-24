import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, HandPlatter, ChevronRight, X, AlertCircle } from "lucide-react";
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
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchRequests = () => {
    apiFetch("/requests/mine")
      .then((data) => setRequests(data.requests))
      .catch((err: unknown) => {
        if (err instanceof Error) setError(err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleCancel = async (requestId: string) => {
    setCancelError("");
    setCancellingId(requestId);
    try {
      await apiFetch(`/requests/${requestId}/cancel`, { method: "PUT" });
      fetchRequests();
    } catch (err: unknown) {
      if (err instanceof Error) setCancelError(err.message);
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
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
      <div className="mb-8">
        <p className="text-sm text-subtle mb-1">Your activity</p>
        <h1 className="font-semibold text-2xl text-foreground tracking-tight">My Requests</h1>
      </div>

      {/* Cancel error — surfaced once, above the list, not a native alert() */}
      {cancelError && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-900/40 bg-red-950/30 px-3.5 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 mt-px shrink-0" />
          <p className="text-sm text-red-400 leading-snug">{cancelError}</p>
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
        <div className="flex flex-col gap-2">
          {requests.map((req) => (
            <div
              key={req.id}
              className="bg-surface border border-border rounded-xl px-4 py-3.5 flex items-center gap-4 group"
            >
              {/* Info */}
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => navigate(`/posts/${req.postId}`)}
              >
                <p className="text-sm font-medium text-foreground truncate group-hover:text-muted transition-colors">
                  {req.postTitle}
                </p>
                <p className="text-xs text-subtle mt-0.5">{formatDate(req.createdAt)}</p>
              </div>

              {/* Status + cancel */}
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={req.status} />

                {req.status === "pending" && (
                  <button
                    onClick={() => handleCancel(req.id)}
                    disabled={cancellingId === req.id}
                    title="Cancel request"
                    className="cursor-pointer w-6 h-6 flex items-center justify-center rounded-full text-subtle hover:text-red-400 hover:bg-red-950/30 transition-colors disabled:opacity-40"
                  >
                    {cancellingId === req.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <X className="w-3.5 h-3.5" />
                    }
                  </button>
                )}
              </div>

              {/* Chevron */}
              <ChevronRight
                className="w-4 h-4 text-subtle group-hover:text-muted transition-colors shrink-0 cursor-pointer"
                onClick={() => navigate(`/posts/${req.postId}`)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}