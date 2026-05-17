import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, MapPin, Clock, Loader2, AlertCircle,
  CheckCircle2, UtensilsCrossed, ExternalLink, TimerOff, Ban,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import type { FoodPost, PickupRequest } from "../types/api";
import RequestModal from "../components/RequestModal";
import { formatPickupWindow } from "../lib/format";

// ── Types ─────────────────────────────────────────────────────────────────────

type PostDetailData = {
  post: FoodPost & { pickupLat: number | null; pickupLng: number | null };
  isPoster: boolean;
  isApprovedPicker: boolean;
  pendingRequest: PickupRequest | null;
};

// ── Module-level helpers ──────────────────────────────────────────────────────

const STATUS_STYLES: Record<FoodPost["status"], string> = {
  open:             "bg-emerald-50 text-emerald-600 border-emerald-100",
  pending_approval: "bg-amber-50 text-amber-600 border-amber-100",
  closed:           "bg-neutral-100 text-neutral-500 border-neutral-200",
  expired:          "bg-red-50 text-red-400 border-red-100",
  completed:        "bg-blue-50 text-blue-600 border-blue-100",
};

const STATUS_LABELS: Record<FoodPost["status"], string> = {
  open:             "Open",
  pending_approval: "Pending",
  closed:           "Closed",
  expired:          "Expired",
  completed:        "Completed",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FoodPost["status"] }) {
  return (
    <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium border shrink-0 ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function MapsLink({ lat, lng }: { lat: number; lng: number }) {
  return (
    <a
      href={`https://www.google.com/maps?q=${lat},${lng}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 border border-neutral-200 text-neutral-700 hover:border-neutral-400 hover:text-neutral-900 bg-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150"
    >
      <MapPin className="w-4 h-4" />
      Open in Google Maps
      <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
    </a>
  );
}

function InfoBanner({
  variant,
  icon: Icon,
  children,
}: {
  variant: "success" | "warning" | "muted" | "danger";
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  const styles = {
    success: "bg-emerald-50 border-emerald-100 text-emerald-700",
    warning: "bg-amber-50 border-amber-100 text-amber-700",
    muted:   "bg-neutral-50 border-neutral-100 text-neutral-500",
    danger:  "bg-red-50 border-red-100 text-red-500",
  };
  return (
    <div className={`flex items-start gap-2.5 border rounded-lg px-4 py-3 text-sm ${styles[variant]}`}>
      <Icon className="w-4 h-4 mt-px shrink-0" />
      <p className="leading-snug">{children}</p>
    </div>
  );
}

function PosterView({
  post, pendingRequest, actionLoading, actionError, onApprove, onReject, onComplete,
}: {
  post: PostDetailData["post"];
  pendingRequest: PickupRequest | null;
  actionLoading: boolean;
  actionError: string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onComplete: () => void;
}) {
  if (post.status === "open") {
    return (
      <p className="text-sm text-neutral-400 text-center py-4">
        No one has requested this food yet.
      </p>
    );
  }

  if (post.status === "pending_approval" && pendingRequest) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[13px] font-medium text-neutral-700">
          Someone wants to pick this up
        </p>

        {/* Requester card */}
        <div className="bg-white border border-neutral-100 rounded-xl p-4 flex gap-4 items-start">
          {pendingRequest.selfieUrl ? (
            <img
              src={pendingRequest.selfieUrl}
              alt="Picker selfie"
              className="w-16 h-16 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-5 h-5 text-neutral-300" />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-neutral-900">{pendingRequest.pickerName}</p>
            <p className="text-sm text-neutral-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Estimated Arrival Time for picker: {pendingRequest.etaMinutes} min
            </p>
          </div>
        </div>

        {actionError && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
            <AlertCircle className="w-4 h-4 text-red-500 mt-px shrink-0" />
            <p className="text-sm text-red-600 leading-snug">{actionError}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => onApprove(pendingRequest.id)}
            disabled={actionLoading}
            className="flex-1 bg-neutral-900 hover:bg-neutral-700 text-white rounded-lg py-2.5 text-sm font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Approve
          </button>
          <button
            onClick={() => onReject(pendingRequest.id)}
            disabled={actionLoading}
            className="flex-1 border border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50 rounded-lg py-2.5 text-sm font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Reject
          </button>
        </div>
      </div>
    );
  }

  if (post.status === "closed") {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2.5">
          <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-px" />
          <p className="text-sm text-amber-800 leading-snug">
            Pickup approved. Waiting for the picker to arrive.
          </p>
        </div>
        <button
          onClick={onComplete}
          className="cursor-pointer w-full flex items-center justify-center gap-2 rounded-lg border border-[#2D6A4F]/30 bg-[#2D6A4F]/5 px-4 py-2.5 text-sm font-medium text-[#2D6A4F] hover:bg-[#2D6A4F]/10 transition-colors duration-150"
        >
          <CheckCircle2 className="w-4 h-4" />
          Food has been collected — Stop sharing location
        </button>
      </div>
    );
  }

  if (post.status === "completed") {
    return (
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3 flex items-start gap-2.5">
        <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-px" />
        <p className="text-sm text-[#2D6A4F] leading-snug">
          Food successfully shared. Location is no longer visible.
        </p>
      </div>
    );
  }

  if (post.status === "expired") {
    return <InfoBanner variant="danger" icon={TimerOff}>This post has expired. Create a new post if the food is still available.</InfoBanner>;
  }

  return null;
}

function VisitorView({ status, onRequest }: { status: FoodPost["status"]; onRequest: () => void }) {
  if (status === "open") {
    return (
      <button
        onClick={onRequest}
        className="w-full bg-neutral-900 hover:bg-neutral-700 text-white rounded-lg py-2.5 text-sm font-medium transition-colors duration-150"
      >
        I'll pick it up
      </button>
    );
  }

  if (status === "pending_approval") {
    return <InfoBanner variant="warning" icon={Clock}>Someone has already requested this food. Check back if it becomes available again.</InfoBanner>;
  }

  if (status === "closed") {
    return <InfoBanner variant="muted" icon={Ban}>This food has already been claimed.</InfoBanner>;
  }

  if (status === "expired") {
    return <InfoBanner variant="danger" icon={TimerOff}>This post has expired.</InfoBanner>;
  }

  return null;
}

// ── Page ──────────────────────────────────────────────────────────────────────

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

  useEffect(() => { fetchPost(); }, [id]);

  const handleApprove = async (requestId: string) => {
    setActionError("");
    setActionLoading(true);
    try {
      await apiFetch(`/requests/${requestId}/approve`, { method: "PUT" });
      await fetchPost();
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
      await fetchPost();
    } catch (err: unknown) {
      if (err instanceof Error) setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    setActionLoading(true);
    try {
      await apiFetch(`/posts/${post.id}/complete`, { method: "PUT" });
      await fetchPost();
    } catch (err: unknown) {
      if (err instanceof Error) setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 flex flex-col items-center gap-3 font-geist font-medium tracking-wide">
        <Loader2 className="w-5 h-5 text-neutral-300 animate-spin" />
        <p className="text-sm text-neutral-400">Loading post…</p>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────

  if (error || !data) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 flex flex-col items-center gap-4 font-geist font-medium tracking-wide">
        <p className="text-sm text-neutral-500 text-center">{error || "Post not found."}</p>
        <button
          onClick={() => navigate("/feed")}
          className="text-sm font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-600 transition-colors"
        >
          Back to Feed
        </button>
      </div>
    );
  }

  const { post, isPoster, isApprovedPicker, pendingRequest } = data;

  return (
    <div className="max-w-5xl mx-auto px-6 py-1 font-geist font-medium tracking-wide">

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="cursor-pointer flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-700 transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </button>

      <div className="max-w-lg flex flex-col gap-6">

        {/* Photo */}
        {post.photoUrl ? (
          <img
            src={post.photoUrl}
            alt={post.title}
            className="w-full h-60 object-cover rounded-xl"
          />
        ) : (
          <div className="w-full h-60 bg-neutral-100 rounded-xl flex items-center justify-center">
            <UtensilsCrossed className="w-10 h-10 text-neutral-300" />
          </div>
        )}

        {/* Post info */}
        <div className="bg-white border border-neutral-300 rounded-xl px-5 py-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-geist font-semibold text-xl text-neutral-900 tracking-tight leading-tight">
              {post.title}
            </h1>
            <StatusBadge status={post.status} />
          </div>

          {post.description && (
            <p className="text-sm leading-relaxed text-neutral-500">{post.description}</p>
          )}

          <div className="border-t border-neutral-300" />

          <div className="flex flex-col gap-2.5 text-sm text-neutral-500">
            <div className="flex items-center gap-2">
              <span className="text-neutral-400">Posted by</span>
              <span className="font-medium text-neutral-700">{post.posterName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span>Pickup window: {formatPickupWindow(post.pickupWindowStart, post.pickupWindowEnd)}</span>
            </div>
          </div>

          {/* Maps link — poster and approved picker only */}
          {(isPoster || isApprovedPicker) && post.pickupLat && post.pickupLng && (
            <MapsLink lat={post.pickupLat} lng={post.pickupLng} />
          )}
        </div>

        {/* Action section */}
        <div className="flex flex-col gap-4">

          {/* Approved picker banner */}
          {isApprovedPicker && (
            <InfoBanner variant="success" icon={CheckCircle2}>
              Your request was approved. Head to the location above to collect the food.
            </InfoBanner>
          )}

          {isPoster && (
            <PosterView
              post={post}
              pendingRequest={pendingRequest}
              actionLoading={actionLoading}
              actionError={actionError}
              onApprove={handleApprove}
              onReject={handleReject}
              onComplete={handleComplete}
            />
          )}

          {!isPoster && !isApprovedPicker && (
            <VisitorView status={post.status} onRequest={() => setShowModal(true)} />
          )}
        </div>
      </div>

      {showModal && (
        <RequestModal
          postId={post.id}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchPost(); }}
        />
      )}
    </div>
  );
}