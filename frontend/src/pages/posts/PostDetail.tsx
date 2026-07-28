import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, MapPin, Clock, Loader2, AlertCircle, X,
  CheckCircle2, UtensilsCrossed, ExternalLink, TimerOff, Ban,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { FoodPost, PickupRequest } from "@/types/api";
import RequestModal from "@/components/posts/RequestModal";
import { formatPickupWindow } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LinkButton } from "@/components/ui/LinkButton";

type PostDetailData = {
  post: FoodPost & { pickupLat: number | null; pickupLng: number | null };
  isPoster: boolean;
  isApprovedPicker: boolean;
  pendingRequest: PickupRequest | null;
};

function MapsLink({ lat, lng }: { lat: number; lng: number }) {
  return (
    <a
      href={`https://www.google.com/maps?q=${lat},${lng}`}
      target="_blank"
      rel="noopener noreferrer"
      className="w-fit inline-flex items-center gap-2 border border-border text-muted hover:border-border-strong hover:text-foreground bg-surface px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150"
    >
      <MapPin className="w-4 h-4" />
      Open in Google Maps
      <ExternalLink className="w-3.5 h-3.5 text-subtle" />
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
    success: "bg-emerald-950/30 border-emerald-900/40 text-emerald-400",
    // Terracotta, not amber — amber was the old accent value verbatim. Safe to
    // rely on a mere 21° hue shift here only because Callout always renders an
    // Icon alongside, so colour is never the sole carrier of meaning.
    warning: "bg-warning/10 border-warning/30 text-warning",
    muted:   "bg-surface border-border text-subtle",
    danger:  "bg-red-950/30 border-red-900/40 text-red-400",
  };
  return (
    <div className={`flex items-start gap-2.5 border rounded-lg px-4 py-3 text-sm ${styles[variant]}`}>
      <Icon className="w-4 h-4 mt-px shrink-0" />
      <p className="leading-snug">{children}</p>
    </div>
  );
}

function NextSteps() {
  return (
    <div className="flex gap-3">
      <Link
        to="/feed"
        className="flex-1 text-center cursor-pointer border border-border text-muted hover:border-border-strong hover:bg-surface rounded-lg py-2.5 text-sm font-medium transition-colors duration-150"
      >
        Browse Feed
      </Link>
      <LinkButton as="link" to="/create" label="Post Food" className="flex-1" />
    </div>
  );
}

function ApprovedPickerView({ status }: { status: FoodPost["status"] }) {
  if (status === "completed") {
    return (
      <>
        <InfoBanner variant="success" icon={CheckCircle2}>
          You collected this food. Thanks for helping reduce waste!
        </InfoBanner>
        <NextSteps />
      </>
    );
  }

  if (status === "expired") {
    return (
      <>
        <InfoBanner variant="danger" icon={TimerOff}>
          The pickup window expired before this was marked collected.
        </InfoBanner>
        <NextSteps />
      </>
    );
  }

  return (
    <InfoBanner variant="success" icon={CheckCircle2}>
      Your request was approved. Head to the location to collect the food.
    </InfoBanner>
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
  // Hook lifted to the top level, unconditional — fixes a Rules-of-Hooks
  // violation that previously called useState() inside an `if` block.
  const [lightbox, setLightbox] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {/* actionError now renders regardless of which status branch is
          active below — previously only visible during pending_approval,
          silently swallowing errors from the "complete" action. */}
      {actionError && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-900/40 bg-red-950/30 px-3.5 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 mt-px shrink-0" />
          <p className="text-sm text-red-400 leading-snug">{actionError}</p>
        </div>
      )}

      {post.status === "open" && (
        <div className="bg-surface border border-border rounded-xl px-5 py-6 flex flex-col items-center text-center gap-2">
          <Clock className="w-5 h-5 text-subtle" />
          <p className="text-sm text-subtle">No one has requested this food yet.</p>
        </div>
      )}

      {post.status === "pending_approval" && pendingRequest && (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] font-medium text-muted">
            Someone wants to pick this up
          </p>

          {/* Requester card */}
          <div className="bg-surface border border-border rounded-xl p-4 flex gap-4 items-start">
            {pendingRequest.selfieUrl ? (
              <img
                src={pendingRequest.selfieUrl}
                alt="Picker selfie"
                className="w-16 h-16 rounded-lg object-cover shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setLightbox(true)}
                title="Click to view"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-background flex items-center justify-center shrink-0">
                <UtensilsCrossed className="w-5 h-5 text-subtle" />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">{pendingRequest.pickerName}</p>
              <p className="text-sm text-subtle flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Estimated arrival: {pendingRequest.etaMinutes} min
              </p>
              {pendingRequest.selfieUrl && (
                <button
                  type="button"
                  onClick={() => setLightbox(true)}
                  className="cursor-pointer text-xs text-subtle hover:text-foreground underline underline-offset-2 transition-colors text-left mt-0.5"
                >
                  View photo
                </button>
              )}
            </div>
          </div>

          {/* Lightbox */}
          {lightbox && (
            <div
              className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4"
              onClick={() => setLightbox(false)}
            >
              <div className="relative max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
                <img
                  src={pendingRequest.selfieUrl!}
                  alt="Picker selfie"
                  className="w-full rounded-xl object-cover"
                />
                <button
                  type="button"
                  onClick={() => setLightbox(false)}
                  className="cursor-pointer absolute top-2.5 right-2.5 bg-surface border border-border rounded-full p-1.5 text-muted hover:text-foreground transition-colors shadow-sm"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <LinkButton
              as="button"
              label="Approve"
              loading={actionLoading}
              loadingLabel="Approving…"
              disabled={actionLoading}
              onClick={() => onApprove(pendingRequest.id)}
              className="flex-1"
            />
            <button
              onClick={() => onReject(pendingRequest.id)}
              disabled={actionLoading}
              className="flex-1 cursor-pointer border border-border text-muted hover:border-border-strong hover:bg-surface rounded-lg py-2.5 text-sm font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {actionLoading ? "Rejecting…" : "Reject"}
            </button>
          </div>
        </div>
      )}

      {post.status === "closed" && (
        <div className="flex flex-col gap-3">
          <InfoBanner variant="warning" icon={Clock}>
            Pickup approved. Waiting for the picker to arrive.
          </InfoBanner>
          <button
            onClick={onComplete}
            disabled={actionLoading}
            className="cursor-pointer w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 ease-out disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
            {actionLoading ? "Updating…" : "Food has been collected — Click here to stop sharing location"}
          </button>
        </div>
      )}

      {post.status === "completed" && (
        <>
          <InfoBanner variant="success" icon={CheckCircle2}>
            Food successfully shared. Location is no longer visible.
          </InfoBanner>
          <NextSteps />
        </>
      )}

      {post.status === "expired" && (
        <>
          <InfoBanner variant="danger" icon={TimerOff}>
            This post has expired. Create a new post if the food is still available.
          </InfoBanner>
          <NextSteps />
        </>
      )}
    </div>
  );
}

function VisitorView({ status, onRequest }: { status: FoodPost["status"]; onRequest: () => void }) {
  if (status === "open") {
    return (
      <div className="bg-surface border border-border rounded-xl px-5 py-6 flex flex-col items-center text-center gap-3">
        <div className="w-11 h-11 rounded-full bg-accent/10 flex items-center justify-center">
          <UtensilsCrossed className="w-5 h-5 text-accent" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Interested in this food?</p>
          <p className="text-sm text-subtle mt-0.5">
            Send a request and the poster will review it before you head over.
          </p>
        </div>
        <LinkButton
          as="button"
          label="I'll pick it up"
          onClick={onRequest}
          className="w-full mt-1"
        />
      </div>
    );
  }

  if (status === "pending_approval") {
    return (
      <div className="flex flex-col gap-4">
        <InfoBanner variant="warning" icon={Clock}>
          Someone has already requested this food. Check back if it becomes available again.
        </InfoBanner>
        <NextSteps />
      </div>
    );
  }

  if (status === "closed") {
    return (
      <div className="flex flex-col gap-4">
        <InfoBanner variant="muted" icon={Ban}>This food has already been claimed.</InfoBanner>
        <NextSteps />
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="flex flex-col gap-4">
        <InfoBanner variant="danger" icon={TimerOff}>This post has expired.</InfoBanner>
        <NextSteps />
      </div>
    );
  }

  return null;
}

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);

  const { data, isPending: loading, error } = useQuery<PostDetailData>({
    queryKey: ["posts", id],
    queryFn: () => apiFetch(`/posts/${id}`),
    enabled: !!id,
  });

  const invalidatePost = () => {
    queryClient.invalidateQueries({ queryKey: ["posts", id] });
    queryClient.invalidateQueries({ queryKey: ["posts", "mine"] });
  };

  const approveMutation = useMutation({
    mutationFn: (requestId: string) => apiFetch(`/requests/${requestId}/approve`, { method: "PUT" }),
    onSuccess: invalidatePost,
  });

  const rejectMutation = useMutation({
    mutationFn: (requestId: string) => apiFetch(`/requests/${requestId}/reject`, { method: "PUT" }),
    onSuccess: invalidatePost,
  });

  const completeMutation = useMutation({
    mutationFn: () => apiFetch(`/posts/${id}/complete`, { method: "PUT" }),
    onSuccess: invalidatePost,
  });

  const actionLoading = approveMutation.isPending || rejectMutation.isPending || completeMutation.isPending;
  const actionError =
    approveMutation.error?.message || rejectMutation.error?.message || completeMutation.error?.message || "";

  const handleApprove = (requestId: string) => approveMutation.mutate(requestId);
  const handleReject = (requestId: string) => rejectMutation.mutate(requestId);
  const handleComplete = () => completeMutation.mutate();

  if (loading) {
    return (
      <div className="px-6 py-20 flex flex-col items-center gap-3 font-medium tracking-wide">
        <Loader2 className="w-5 h-5 text-subtle animate-spin" />
        <p className="text-sm text-subtle">Loading post…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-6 py-20 flex flex-col items-center gap-4 font-medium tracking-wide">
        <div className="flex items-start gap-2.5 rounded-lg border border-red-900/40 bg-red-950/30 px-3.5 py-3 max-w-sm w-full">
          <AlertCircle className="w-4 h-4 text-red-400 mt-px shrink-0" />
          <p className="text-sm text-red-400 leading-snug">{error?.message || "Post not found."}</p>
        </div>
        <button
          onClick={() => navigate("/feed")}
          className="cursor-pointer text-sm font-medium text-foreground underline underline-offset-2 hover:text-muted transition-colors"
        >
          Back to Feed
        </button>
      </div>
    );
  }

  const { post, isPoster, isApprovedPicker, pendingRequest } = data;

  return (
    <div className="px-6 py-8 font-medium tracking-wide">

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="cursor-pointer flex items-center gap-1.5 text-sm text-subtle hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </button>

      <div className="grid md:grid-cols-[3fr_2fr] gap-6 lg:gap-8 items-start">

        {/* Left — photo + post info, stays in view while acting on the right */}
        <div className="flex flex-col gap-6 md:sticky md:top-20">

          {post.photoUrl ? (
            <img src={post.photoUrl} alt={post.title} className="w-full h-72 object-cover rounded-xl" />
          ) : (
            <div className="w-full h-72 bg-surface rounded-xl flex items-center justify-center">
              <UtensilsCrossed className="w-10 h-10 text-subtle" />
            </div>
          )}

          <div className="bg-surface border border-border rounded-xl px-5 py-5 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-semibold text-xl text-foreground tracking-tight leading-tight">
                {post.title}
              </h1>
              <StatusBadge status={post.status} />
            </div>

            {post.description && (
              <p className="text-sm leading-relaxed text-muted">{post.description}</p>
            )}

            <div className="border-t border-border" />

            <div className="flex flex-col gap-2.5 text-sm text-muted">
              <div className="flex items-center gap-2">
                <span className="text-subtle">Posted by</span>
                <span className="font-medium text-foreground">{post.posterName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-subtle shrink-0" />
                <span>Pickup window: {formatPickupWindow(post.pickupWindowStart, post.pickupWindowEnd)}</span>
              </div>
            </div>

            {(isPoster || isApprovedPicker) && post.pickupLat && post.pickupLng && (
              <MapsLink lat={post.pickupLat} lng={post.pickupLng} />
            )}
          </div>
        </div>

        {/* Right — actions */}
        <div className="flex flex-col gap-4">
          {isApprovedPicker && <ApprovedPickerView status={post.status} />}

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
          onSuccess={() => { setShowModal(false); invalidatePost(); }}
        />
      )}
    </div>
  );
}