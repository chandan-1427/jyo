import { useState, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Check, CheckCircle2, Clock, ExternalLink, MapPin, Maximize2, Navigation, Pencil, Plus, Timer, Trash2,
  UserRound, UtensilsCrossed, X,
} from "lucide-react";
import { apiFetch } from "@/lib/api/api";
import { useMarkPostNotificationsRead } from "@/lib/api/queries/notifications";
import { formatPickupWindow } from "@/lib/format";
import { useV2Theme } from "@/lib/theme";
import type { FoodPost, PickupRequest } from "@/types/api";
import RequestModal from "@/components/posts/RequestModal";
import { EditPostDialog } from "@/components/posts/EditPostDialog";
import { DeletePostDialog } from "@/components/posts/DeletePostDialog";
import { Button } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { ImageViewer } from "@/components/ui/ImageViewer";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";

type PostDetailData = {
  post: FoodPost & { pickupLat: number | null; pickupLng: number | null };
  isPoster: boolean;
  isApprovedPicker: boolean;
  pendingRequest: PickupRequest | null;
  // The viewer's own latest request on this post, if they've made one.
  myRequest: { id: string; status: PickupRequest["status"]; etaMinutes: number } | null;
};

type Post = PostDetailData["post"];

// "Open" is the normal state, so it gets no tag; the rest change what you can do.
const STATUS_TAG: Partial<Record<FoodPost["status"], string>> = {
  pending_approval: "Requested",
  closed: "Claimed",
  completed: "Collected",
  expired: "Ended",
};

const TAG = "rounded-md bg-lifted px-2 py-1 text-xs font-medium";

function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-raised p-5 shadow-card ring-1 ring-inset ring-fg/[0.06]">
      {children}
    </section>
  );
}

// One fact about the post: an icon, a quiet label, and the value under it.
function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-fg-subtle [&>svg]:size-[18px]" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm text-fg-subtle">{label}</p>
        <p className="mt-0.5 text-fg">{children}</p>
      </div>
    </div>
  );
}

function FindFoodButton() {
  return (
    <Button to="/feed" variant="secondary" fullWidth iconLeft={<MapPin className="size-4" aria-hidden="true" />}>
      Find other food
    </Button>
  );
}

function MapsButton({ lat, lng }: { lat: number; lng: number }) {
  return (
    <a
      href={`https://www.google.com/maps?q=${lat},${lng}`}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClasses({ size: "lg", fullWidth: true })}
    >
      <Navigation className="size-4" aria-hidden="true" />
      Open in Google Maps
      <ExternalLink className="size-3.5 opacity-70" aria-hidden="true" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

function VisitorPanel({
  post,
  myRequest,
  onRequest,
}: {
  post: Post;
  myRequest: PostDetailData["myRequest"];
  onRequest: () => void;
}) {
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState(false);
  const { status } = post;

  // Their own request is still waiting: say so (not "someone has already
  // asked"), and let them take it back.
  if (myRequest?.status === "pending" && status === "pending_approval") {
    return (
      <Panel>
        <Notice>You asked for this. Waiting for their answer; you'll get a notification either way.</Notice>
        <Button variant="outline" fullWidth onClick={() => setCancelling(true)} iconLeft={<X className="size-4" aria-hidden="true" />}>
          Cancel request
        </Button>
        {cancelling && (
          <ConfirmDialog
            title="Cancel your request?"
            description="They won't see your request any more, and others can ask for it. You can ask again while it's still open."
            confirmLabel="Cancel request"
            busyLabel="Cancelling…"
            tone="danger"
            onConfirm={async () => {
              await apiFetch(`/requests/${myRequest.id}/cancel`, { method: "PUT" });
              queryClient.invalidateQueries({ queryKey: ["posts", post.id] });
              queryClient.invalidateQueries({ queryKey: ["requests", "mine"] });
            }}
            onClose={() => setCancelling(false)}
          />
        )}
      </Panel>
    );
  }

  if (status === "open") {
    return (
      <Panel>
        {/* Asking again after a "no" is allowed, but they should know. */}
        {myRequest?.status === "rejected" && <Notice>They declined your last request for this.</Notice>}
        <Button size="lg" fullWidth onClick={onRequest}>
          Request pickup
        </Button>
        <p className="text-sm leading-relaxed text-fg-muted">
          You'll send your name, a selfie and how soon you can get there. Once the person sharing approves,
          you'll see the exact pickup spot.
        </p>
      </Panel>
    );
  }

  const message =
    status === "pending_approval"
      ? "Someone has already asked for this. If the person sharing declines, it will open up again."
      : status === "expired"
        ? "The pickup time for this has ended."
        : "Someone else is picking this up.";

  return (
    <Panel>
      <Notice>{message}</Notice>
      <FindFoodButton />
    </Panel>
  );
}

function PickerPanel({ post }: { post: Post }) {
  if (post.status === "completed") {
    return (
      <Panel>
        <Notice tone="success">You picked this up. Thanks for making sure it didn't go to waste.</Notice>
        <FindFoodButton />
      </Panel>
    );
  }

  if (post.status === "expired") {
    return (
      <Panel>
        <Notice>The pickup time ended before this was marked as collected.</Notice>
        <FindFoodButton />
      </Panel>
    );
  }

  return (
    <Panel>
      <Notice tone="success">Your request was approved. Head over during the pickup time.</Notice>
      {post.pickupLat != null && post.pickupLng != null && <MapsButton lat={post.pickupLat} lng={post.pickupLng} />}
    </Panel>
  );
}

function PosterPanel({ post, pendingRequest }: { post: Post; pendingRequest: PickupRequest | null }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [viewingSelfie, setViewingSelfie] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["posts", post.id] });
    queryClient.invalidateQueries({ queryKey: ["posts", "mine"] });
  };
  const approve = useMutation({
    mutationFn: (requestId: string) => apiFetch(`/requests/${requestId}/approve`, { method: "PUT" }),
    onSuccess: refresh,
  });
  const decline = useMutation({
    mutationFn: (requestId: string) => apiFetch(`/requests/${requestId}/reject`, { method: "PUT" }),
    onSuccess: refresh,
  });
  const complete = useMutation({
    mutationFn: () => apiFetch(`/posts/${post.id}/complete`, { method: "PUT" }),
    onSuccess: refresh,
  });

  const busy = approve.isPending || decline.isPending || complete.isPending;
  const error = approve.error?.message || decline.error?.message || complete.error?.message;
  // Shown right above the buttons that caused it.
  const errorNotice = error && <Notice tone="error">{error}</Notice>;

  // Editing and deleting are only offered while nobody has asked for the
  // post (the API enforces the same); an expired post can still be deleted.
  const manageDialogs = (
    <>
      {editing && <EditPostDialog post={post} onClose={() => setEditing(false)} />}
      {deleting && (
        <DeletePostDialog
          postIds={[post.id]}
          onClose={() => setDeleting(false)}
          // Replace, so Back doesn't return to a post that no longer exists.
          onDeleted={() => navigate("/my-posts", { replace: true })}
        />
      )}
    </>
  );
  const deleteButton = (
    <Button variant="dangerSolid" onClick={() => setDeleting(true)} iconLeft={<Trash2 className="size-4" aria-hidden="true" />}>
      Delete
    </Button>
  );

  if (post.status === "open") {
    return (
      <Panel>
        <Notice>No one has asked for this yet. You'll get a notification when someone does.</Notice>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => setEditing(true)} iconLeft={<Pencil className="size-4" aria-hidden="true" />}>
            Edit
          </Button>
          {deleteButton}
        </div>
        <p className="text-sm text-fg-subtle">You can edit or delete this until someone asks for it.</p>
        {manageDialogs}
      </Panel>
    );
  }

  if (post.status === "pending_approval" && pendingRequest) {
    return (
      <Panel>
        <h2 className="font-display text-lg font-semibold">Someone wants to pick this up</h2>

        <div className="flex items-center gap-4">
          {pendingRequest.selfieUrl ? (
            // The expand badge is always shown, not just on hover, so it reads
            // as "tap to enlarge" on phones too.
            <button
              type="button"
              onClick={() => setViewingSelfie(true)}
              aria-label={`View ${pendingRequest.pickerName}'s photo`}
              className="group relative size-20 shrink-0 cursor-zoom-in overflow-hidden rounded-xl bg-lifted ring-1 ring-inset ring-fg/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
            >
              <img
                src={pendingRequest.selfieUrl}
                alt=""
                className="size-full object-cover"
              />
              <span className="absolute right-1 bottom-1 grid size-6 place-items-center rounded-md bg-canvas/80 text-fg backdrop-blur-sm transition-colors group-hover:bg-canvas">
                <Maximize2 className="size-3.5" aria-hidden="true" />
              </span>
            </button>
          ) : (
            <span className="grid size-20 shrink-0 place-items-center rounded-xl bg-lifted text-fg-subtle">
              <UserRound className="size-6" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium">{pendingRequest.pickerName}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-fg-muted">
              <Timer className="size-4 shrink-0" aria-hidden="true" />
              Can get there in about {pendingRequest.etaMinutes} min
            </p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-fg-muted">
          Approving shares your exact pickup spot with them. Declining opens the post to others again. While
          they wait for your answer, the post can't be edited or deleted.
        </p>

        {errorNotice}

        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => approve.mutate(pendingRequest.id)}
            loading={approve.isPending}
            disabled={busy}
            iconLeft={<Check className="size-4" aria-hidden="true" />}
          >
            {approve.isPending ? "Approving…" : "Approve"}
          </Button>
          <Button
            variant="outline"
            onClick={() => decline.mutate(pendingRequest.id)}
            loading={decline.isPending}
            disabled={busy}
            iconLeft={<X className="size-4" aria-hidden="true" />}
          >
            {decline.isPending ? "Declining…" : "Decline"}
          </Button>
        </div>

        {viewingSelfie && pendingRequest.selfieUrl && (
          <Dialog title={pendingRequest.pickerName} onClose={() => setViewingSelfie(false)}>
            {/* Portrait, since selfies usually are; on the page colour so the
                frame stands out from the dialog's own surface. */}
            <ImageViewer
              src={pendingRequest.selfieUrl}
              alt={`Selfie of ${pendingRequest.pickerName}`}
              className="aspect-[3/4] max-h-[70vh] bg-canvas"
            />
          </Dialog>
        )}
      </Panel>
    );
  }

  if (post.status === "closed") {
    return (
      <Panel>
        <p className="leading-relaxed text-fg-muted">
          You approved a pickup. Once the food has been collected, mark it here. That also hides your pickup spot
          again.
        </p>
        {errorNotice}
        <Button
          size="lg"
          fullWidth
          onClick={() => complete.mutate()}
          loading={complete.isPending}
          iconLeft={<CheckCircle2 className="size-4" aria-hidden="true" />}
        >
          {complete.isPending ? "Saving…" : "Mark as collected"}
        </Button>
      </Panel>
    );
  }

  const ended = post.status === "expired";
  return (
    <Panel>
      <Notice tone={ended ? "info" : "success"}>
        {ended
          ? "The pickup time ended before anyone collected this. If you still have the food, post it again."
          : "Collected. Thanks for sharing. Your pickup spot is hidden again."}
      </Notice>
      {ended ? (
        <div className="grid grid-cols-2 gap-3">
          <Button to="/create" variant="secondary" iconLeft={<Plus className="size-4" aria-hidden="true" />}>
            Post food
          </Button>
          {deleteButton}
        </div>
      ) : (
        <Button to="/create" variant="secondary" fullWidth iconLeft={<Plus className="size-4" aria-hidden="true" />}>
          Post food
        </Button>
      )}
      {manageDialogs}
    </Panel>
  );
}


// Who can see the exact pickup spot right now, from this viewer's side. It's
// only ever shared between the poster and the approved picker while the
// pickup is on (see posts.ts); null where there's nothing useful to say.
function pickupSpotText(status: FoodPost["status"], isPoster: boolean, isApprovedPicker: boolean) {
  const waiting = status === "open" || status === "pending_approval";
  if (isPoster) {
    if (waiting) return "Shared only with the person you approve";
    if (status === "closed") return "Shared with the person you approved";
    if (status === "completed") return "Hidden again";
    return null;
  }
  if (isApprovedPicker) return status === "closed" ? "Shared with you" : null;
  return waiting ? "Shown once your request is approved" : null;
}

// Same layout as the loaded page, so nothing jumps when it arrives.
function DetailSkeleton() {
  return (
    <div className="grid gap-8 motion-safe:animate-pulse md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12" aria-hidden="true">
      <div className="aspect-[4/3] rounded-2xl bg-raised" />
      <div className="flex flex-col gap-4">
        <div className="h-9 w-3/4 rounded-lg bg-raised" />
        <div className="h-4 w-full rounded bg-raised" />
        <div className="h-4 w-2/3 rounded bg-raised" />
        <div className="mt-4 h-36 rounded-2xl bg-raised" />
      </div>
    </div>
  );
}

export default function PostDetail() {
  useV2Theme();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [requesting, setRequesting] = useState(false);

  const { data, isPending, error } = useQuery<PostDetailData>({
    queryKey: ["posts", id],
    queryFn: () => apiFetch(`/posts/${id}`),
    enabled: !!id,
  });
  // Once the post is actually on screen, not while it's still loading.
  useMarkPostNotificationsRead(data ? id : undefined);

  // A post opened from a shared link has no page behind it in the app, and
  // going back would leave Jyo altogether; the feed is the sensible parent.
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/feed"));

  const back = (
    <button
      type="button"
      onClick={goBack}
      className="mb-6 inline-flex cursor-pointer items-center gap-1.5 rounded-md text-sm font-medium text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Back
    </button>
  );

  if (isPending) {
    return (
      <div className="text-fg">
        {back}
        <DetailSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-fg">
        {back}
        <EmptyState
          icon={<UtensilsCrossed />}
          title="We couldn't open this post"
          actions={<Button to="/feed">Back to the feed</Button>}
        >
          <p>{error?.message === "Post not found" ? "It may have been deleted, or the link is wrong." : error?.message}</p>
        </EmptyState>
      </div>
    );
  }

  const { post, isPoster, isApprovedPicker, pendingRequest } = data;
  const statusTag = STATUS_TAG[post.status];
  const spot = pickupSpotText(post.status, isPoster, isApprovedPicker);

  return (
    <div className="text-fg">
      {back}

      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
        <ImageViewer src={post.photoUrl} alt={post.title} placeholder={<UtensilsCrossed />} className="shadow-card" />

        <div className="flex flex-col gap-6">
          <header>
            {(statusTag || post.isDemo) && (
              <div className="mb-3 flex gap-1.5">
                {statusTag && <span className={`${TAG} text-fg`}>{statusTag}</span>}
                {post.isDemo && <span className={`${TAG} text-leaf`}>Demo</span>}
              </div>
            )}
            <h1 className="font-display text-3xl font-semibold leading-tight text-balance sm:text-4xl">{post.title}</h1>
            {post.description && (
              <p className="mt-3 leading-relaxed text-pretty whitespace-pre-line text-fg-muted">{post.description}</p>
            )}
          </header>

          <div className="flex flex-col gap-4">
            <Fact icon={<Clock />} label="Pickup time">
              <span className="tabular-nums">{formatPickupWindow(post.pickupWindowStart, post.pickupWindowEnd)}</span>
            </Fact>
            {spot && (
              <Fact icon={<MapPin />} label="Pickup spot">
                {spot}
              </Fact>
            )}
            {post.posterName && !isPoster && (
              <Fact icon={<UserRound />} label="Shared by">
                {post.posterName}
              </Fact>
            )}
          </div>

          {isPoster ? (
            <PosterPanel post={post} pendingRequest={pendingRequest} />
          ) : isApprovedPicker ? (
            <PickerPanel post={post} />
          ) : (
            <VisitorPanel post={post} myRequest={data.myRequest} onRequest={() => setRequesting(true)} />
          )}
        </div>
      </div>

      {requesting && (
        <RequestModal
          postId={post.id}
          onClose={() => setRequesting(false)}
          onSuccess={() => {
            setRequesting(false);
            queryClient.invalidateQueries({ queryKey: ["posts", post.id] });
          }}
        />
      )}
    </div>
  );
}
