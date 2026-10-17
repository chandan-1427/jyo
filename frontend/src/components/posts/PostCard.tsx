import { Link } from "react-router-dom";
import { ArrowRight, Clock, UtensilsCrossed } from "lucide-react";
import type { FoodPost } from "@/types/api";
import { formatPickupTime } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { buttonClasses } from "../ui/buttonStyles";

type Props = {
  post: FoodPost;
};

const TAG = "rounded-md bg-canvas/85 px-2 py-1 text-xs font-medium backdrop-blur-sm";

// Starts at the card colour, so it meets the wave without a seam, and darkens
// slightly towards the page colour at the bottom. Hover shifts both ends up a step.
const BODY_FADE =
  "bg-linear-to-b from-raised to-[color-mix(in_oklab,var(--color-raised),var(--color-canvas)_60%)] transition-colors group-hover:from-lifted group-hover:to-raised";

// Same curve and length as the button's corner morph, so the roll eases in
// and out instead of snapping.
const ROLL = "transition-transform duration-300 ease-[cubic-bezier(0.45,0,0.25,1)] motion-reduce:transition-none";

// Nearly every post in the feed is open, so "Open" isn't shown; only the
// states that change what you'd do are: someone already asked, or it's a demo.
export default function PostCard({ post }: Props) {
  const { user } = useAuth();
  // Short, to share a row with the pickup time. Only an open post that
  // isn't your own can be requested; anything else is just a look.
  const cta = post.status === "open" && post.posterId !== user?.id ? "Request" : "View";

  return (
    <Link
      to={`/posts/${post.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-raised shadow-card ring-1 ring-inset ring-fg/[0.06] transition-colors hover:bg-lifted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
    >
      <div className="relative aspect-[3/2] bg-lifted">
        {post.photoUrl ? (
          <img
            src={post.photoUrl}
            alt=""
            loading="lazy"
            // Absolute, so a tall photo can't stretch the 3:2 box (an
            // aspect-ratio box still grows to fit in-flow content).
            className="absolute inset-0 size-full rounded-t-2xl object-cover outline-1 -outline-offset-1 outline-white/10 transition-[filter] group-hover:brightness-110"
          />
        ) : (
          <div className="grid size-full place-items-center text-fg-subtle">
            <UtensilsCrossed className="size-8 transition-colors group-hover:text-fg-muted" aria-hidden="true" />
          </div>
        )}
        {/* Wavy edge where the photo meets the text, filled with the card's
            colour (and its hover colour); -bottom-px avoids a hairline seam. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 120 12"
          preserveAspectRatio="none"
          className="absolute inset-x-0 -bottom-px h-3 w-full fill-raised transition-colors group-hover:fill-lifted"
        >
          <path d="M0 6 Q6 0 12 6 T24 6 T36 6 T48 6 T60 6 T72 6 T84 6 T96 6 T108 6 T120 6 V12 H0 Z" />
        </svg>
        {(post.status === "pending_approval" || post.isDemo) && (
          <div className="absolute top-3 left-3 flex gap-1.5">
            {post.status === "pending_approval" && <span className={`${TAG} text-fg`}>Requested</span>}
            {post.isDemo && <span className={`${TAG} text-leaf`}>Demo</span>}
          </div>
        )}
      </div>

      <div className={`flex flex-1 flex-col p-4 ${BODY_FADE}`}>
        <h2 className="line-clamp-2 font-display text-lg font-semibold leading-snug text-balance">{post.title}</h2>
        {post.description && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-pretty text-fg-muted">{post.description}</p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          {/* On a narrow card a long window wraps to two lines rather than
              squeezing the button. */}
          <p className="flex min-w-0 items-start gap-2 text-sm text-fg tabular-nums">
            <Clock className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
            {formatPickupTime(post.pickupWindowStart, post.pickupWindowEnd)}
          </p>

          {/* Looks like a button but is part of the card's link, so the whole
              card stays one big target. Secondary, so a grid of cards isn't a
              wall of bright green competing with the page's Post food button. */}
          <span aria-hidden="true" className={buttonClasses({ variant: "secondary", size: "sm", className: "shrink-0" })}>
            {/* On card hover the label rolls up out of a one-line window and
                the arrow rolls in from below; leaving reverses it. Transitions,
                so a quick pass over the card turns back from wherever it got to. */}
            <span className="relative block h-5 overflow-hidden leading-5">
              <span className={`block ${ROLL} group-hover:-translate-y-full`}>{cta}</span>
              <span className={`absolute inset-0 grid translate-y-full place-items-center ${ROLL} group-hover:translate-y-0`}>
                <ArrowRight className="size-4" />
              </span>
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}
