import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import type { FoodPost, PickupRequest } from "../types/api";
import RequestModal from "../components/RequestModal";

type PostDetailData = {
  post: FoodPost & {
    pickupLat: number | null;
    pickupLng: number | null;
  };
  isPoster: boolean;
  isApprovedPicker: boolean;
  pendingRequest: PickupRequest | null;
};

function formatWindow(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${e.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function MapsLink({ lat, lng }: { lat: number; lng: number }) {
  const url = `https://www.google.com/maps?q=${lat},${lng}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 bg-orange-50 text-orange-500 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-100 transition"
    >
      📍 Open in Google Maps
    </a>
  );
}

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<PostDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const fetchPost = async () => {
    try {
      const res = await apiFetch(`/posts/${id}`);
      setData(res);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPost();
  }, [id]);

  const handleApprove = async (requestId: string) => {
    setActionError("");
    setActionLoading(true);
    try {
      await apiFetch(`/requests/${requestId}/approve`, { method: "PUT" });
      await fetchPost(); // refresh
    } catch (err: unknown) {
      if (err instanceof Error) setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (requestId: string) => {
    setActionError("");
    setActionLoading(true);
    try {
      await apiFetch(`/requests/${requestId}/reject`, { method: "PUT" });
      await fetchPost(); // refresh
    } catch (err: unknown) {
      if (err instanceof Error) setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
        Loading...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-gray-500 text-sm">{error || "Post not found"}</p>
        <button
          onClick={() => navigate("/feed")}
          className="text-sm text-orange-500 hover:underline"
        >
          Back to Feed
        </button>
      </div>
    );
  }

  const { post, isPoster, isApprovedPicker, pendingRequest } = data;

  return (
    <div className="max-w-lg mx-auto">

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-400 hover:text-orange-400 transition mb-4 flex items-center gap-1"
      >
        ← Back
      </button>

      {/* Photo */}
      {post.photoUrl ? (
        <img
          src={post.photoUrl}
          alt={post.title}
          className="w-full h-56 object-cover rounded-2xl"
        />
      ) : (
        <div className="w-full h-56 bg-orange-50 rounded-2xl flex items-center justify-center text-5xl">
          🍱
        </div>
      )}

      {/* Post info */}
      <div className="mt-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">{post.title}</h1>
          <StatusBadge status={post.status} />
        </div>

        {post.description && (
          <p className="text-gray-500 text-sm mt-2">{post.description}</p>
        )}

        <div className="mt-4 flex flex-col gap-2 text-sm text-gray-400">
          <span>Posted by <span className="text-gray-600 font-medium">{post.posterName}</span></span>
          <span>🕐 Pickup window: {formatWindow(post.pickupWindowStart, post.pickupWindowEnd)}</span>
        </div>

        {/* Location — only for poster and approved picker */}
        {(isPoster || isApprovedPicker) && post.pickupLat && post.pickupLng && (
          <div className="mt-4">
            <MapsLink lat={post.pickupLat} lng={post.pickupLng} />
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 mt-6 pt-6">

        {/* POSTER VIEW */}
        {isPoster && (
          <PosterView
            post={post}
            pendingRequest={pendingRequest}
            actionLoading={actionLoading}
            actionError={actionError}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}

        {/* APPROVED PICKER VIEW */}
        {isApprovedPicker && (
          <div className="bg-green-50 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
            ✅ Your request was approved. Head to the location above to pick up the food.
          </div>
        )}

        {/* VISITOR VIEW */}
        {!isPoster && !isApprovedPicker && (
          <VisitorView
            status={post.status}
            onRequest={() => setShowModal(true)}
          />
        )}
      </div>

      {/* Request Modal */}
      {showModal && (
        <RequestModal
          postId={post.id}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            fetchPost();
          }}
        />
      )}
    </div>
  );
}

// --- Sub components ---

function StatusBadge({ status }: { status: FoodPost["status"] }) {
  const map = {
    open: "bg-green-50 text-green-600",
    pending_approval: "bg-yellow-50 text-yellow-600",
    closed: "bg-gray-100 text-gray-500",
    expired: "bg-red-50 text-red-400",
  };
  const label = {
    open: "Open",
    pending_approval: "Pending",
    closed: "Closed",
    expired: "Expired",
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${map[status]}`}>
      {label[status]}
    </span>
  );
}

function PosterView({
  post,
  pendingRequest,
  actionLoading,
  actionError,
  onApprove,
  onReject,
}: {
  post: PostDetailData["post"];
  pendingRequest: PickupRequest | null;
  actionLoading: boolean;
  actionError: string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (post.status === "open") {
    return (
      <p className="text-sm text-gray-400 text-center py-4">
        No one has requested this food yet.
      </p>
    );
  }

  if (post.status === "pending_approval" && pendingRequest) {
    return (
      <div className="flex flex-col gap-4">
        <h3 className="font-semibold text-gray-700">Someone wants to pick this up</h3>

        {/* Requester info */}
        <div className="bg-orange-50 rounded-xl p-4 flex gap-4 items-start">
          {pendingRequest.selfieUrl && (
            <img
              src={pendingRequest.selfieUrl}
              alt="Picker selfie"
              className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
            />
          )}
          <div className="flex flex-col gap-1">
            <p className="font-medium text-gray-800">{pendingRequest.pickerName}</p>
            <p className="text-sm text-gray-500">
              ETA: {pendingRequest.etaMinutes} minutes
            </p>
          </div>
        </div>

        {actionError && (
          <p className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-lg">
            {actionError}
          </p>
        )}

        {/* Approve / Reject */}
        <div className="flex gap-3">
          <button
            onClick={() => onApprove(pendingRequest.id)}
            disabled={actionLoading}
            className="flex-1 bg-orange-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-50"
          >
            {actionLoading ? "..." : "Approve"}
          </button>
          <button
            onClick={() => onReject(pendingRequest.id)}
            disabled={actionLoading}
            className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-50 transition disabled:opacity-50"
          >
            {actionLoading ? "..." : "Reject"}
          </button>
        </div>
      </div>
    );
  }

  if (post.status === "closed") {
    return (
      <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-500">
        ✅ This post has been fulfilled. Someone is on their way.
      </div>
    );
  }

  if (post.status === "expired") {
    return (
      <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-400">
        ⏰ This post has expired. Create a new post if the food is still available.
      </div>
    );
  }

  return null;
}

function VisitorView({
  status,
  onRequest,
}: {
  status: FoodPost["status"];
  onRequest: () => void;
}) {
  if (status === "open") {
    return (
      <button
        onClick={onRequest}
        className="w-full bg-orange-500 text-white rounded-xl py-3 text-sm font-semibold hover:bg-orange-600 transition"
      >
        I'll pick it up
      </button>
    );
  }

  if (status === "pending_approval") {
    return (
      <div className="bg-yellow-50 rounded-xl px-4 py-3 text-sm text-yellow-700">
        ⏳ Someone has already requested this food. Check back if it becomes available again.
      </div>
    );
  }

  if (status === "closed") {
    return (
      <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-500">
        This food has already been claimed.
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-400">
        This post has expired.
      </div>
    );
  }

  return null;
}