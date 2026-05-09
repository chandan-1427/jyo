import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

type MyRequest = {
  id: string;
  postId: string;
  postTitle: string;
  pickerName: string;
  etaMinutes: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  createdAt: string;
};

const statusStyles: Record<MyRequest["status"], string> = {
  pending: "bg-yellow-50 text-yellow-600",
  approved: "bg-green-50 text-green-600",
  rejected: "bg-red-50 text-red-400",
  cancelled: "bg-gray-100 text-gray-400",
};

const statusLabels: Record<MyRequest["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export default function MyRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchRequests = () => {
    apiFetch("/requests/mine")
      .then((data) => setRequests(data.requests))
      .catch((err: unknown) => {
        if (err instanceof Error) setError(err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleCancel = async (requestId: string) => {
    setCancellingId(requestId);
    try {
      await apiFetch(`/requests/${requestId}/cancel`, { method: "PUT" });
      fetchRequests();
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-6">My Requests</h1>

      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
          <p className="text-2xl">🙋</p>
          <p className="text-gray-500 text-sm">You haven't requested any food yet.</p>
          <button
            onClick={() => navigate("/feed")}
            className="text-orange-500 text-sm hover:underline mt-1"
          >
            Browse nearby food
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((req) => (
            <div
              key={req.id}
              className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4"
            >
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p
                  onClick={() => navigate(`/posts/${req.postId}`)}
                  className="font-medium text-gray-800 truncate cursor-pointer hover:text-orange-500 transition"
                >
                  {req.postTitle}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(req.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Status badge */}
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[req.status]}`}>
                  {statusLabels[req.status]}
                </span>

                {/* Cancel button — only for pending */}
                {req.status === "pending" && (
                  <button
                    onClick={() => handleCancel(req.id)}
                    disabled={cancellingId === req.id}
                    className="text-xs text-red-400 hover:text-red-500 transition disabled:opacity-50"
                  >
                    {cancellingId === req.id ? "..." : "Cancel"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}