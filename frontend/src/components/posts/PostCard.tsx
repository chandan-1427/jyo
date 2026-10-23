import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight, Clock, UtensilsCrossed } from "lucide-react";
import type { FoodPost } from "@/types/api";
import { formatPickupTime } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { buttonClasses } from "../ui/buttonStyles";
import { cn } from "@/lib/utils";
import { Checkbox } from "../ui/Checkbox";

type Props = {
  post: FoodPost;
  // A line about where the post stands, shown instead of the description,
  // e.g. on your own posts: "Someone asked for this". `attention` marks the
  // ones waiting on you.
  status?: { text: string; attention?: boolean };
  // The button's label; by default "Request" or "View" for someone browsing.
  cta?: string;
  // A control in the photo's top-right corner, e.g. delete on your own post.
  // It sits beside the card's link, not in it (a button can't go inside a link).
  action?: ReactNode;
  // Lets the card be picked, for acting on several at once. Until `active`
  // (no selection yet), only a checkbox shows, on hover (always on touch
  // screens, which have none); ticking it is how picking starts. Once active,
  // a click anywhere on the card toggles it instead of opening it.
  selection?: { active: boolean; selected: boolean; onToggle: () => void };
  // On phones, a short row with the photo beside the text instead of a tall
  // card, for lists scanned for where each post stands rather than browsed.
  compact?: boolean;
};

const TAG = "rounded-md bg-canvas/85 px-2 py-1 text-xs font-medium backdrop-blur-sm";

// A larger invisible hit area around the small corner controls, closer to
// the 44px a finger needs.
const HIT_AREA = "after:absolute after:-inset-1.5";

// Starts at the card colour, so it meets the wave without a seam, and darkens
// slightly towards the page colour at the bottom. Hover shifts both ends up a step.
const BODY_FADE =
  "bg-linear-to-b from-raised to-[color-mix(in_oklab,var(--color-raised),var(--color-canvas)_60%)] transition-colors group-hover:from-lifted group-hover:to-raised";

// Same curve and length as the button's corner morph, so the roll eases in
// and out instead of snapping.
const ROLL = "transition-transform duration-300 ease-[cubic-bezier(0.45,0,0.25,1)] motion-reduce:transition-none";

// Shimmers until the photo has fully arrived, then fades it in whole rather
// than letting it paint in strips. A photo already in the browser's cache is
// complete by the time the ref runs, so it shows at once with no shimmer.
function CardPhoto({ src }: { src: string | null }) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");

  if (!src || state === "failed") {
    return (
      <div className="grid size-full place-items-center text-fg-subtle">
        <UtensilsCrossed className="size-8 transition-colors group-hover:text-fg-muted" aria-hidden="true" />
      </div>
    );
  }

  const loaded = state === "loaded";
  return (
    <>
      {!loaded && <span aria-hidden="true" className="shimmer absolute inset-0" />}
      <img
        ref={(img) => {
          if (img?.complete && img.naturalWidth > 0) setState("loaded");
        }}
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={() => setState("loaded")}
        onError={() => setState("failed")}
        // Absolute, so a tall photo can't stretch the 3:2 box (an
        // aspect-ratio box still grows to fit in-flow content).
        className={cn(
          "absolute inset-0 size-full rounded-[inherit] object-cover outline-1 -outline-offset-1 outline-white/10 transition-[opacity,filter] duration-200 ease-out group-hover:brightness-110",
          !loaded && "opacity-0"
        )}
      />
    </>
  );
}

// Nearly every post in the feed is open, so "Open" isn't shown; only the
// states that change what you'd do are: someone already asked, or it's a demo.
// With a `status` line, that line says where the post stands instead.
export default function PostCard({ post, status, cta: ctaLabel, action, selection, compact }: Props) {
  const { user } = useAuth();
  // Short, to share a row with the pickup time. Only an open post that
  // isn't your own can be requested; anything else is just a look.
  const cta = ctaLabel ?? (post.status === "open" && post.posterId !== user?.id ? "Request" : "View");
  const requestedTag = !status && post.status === "pending_approval";
  const corner = Boolean(selection || action);

  return (
    // flex, so the link fills the grid row's height whether or not there's an action.
    <div className="group/card relative flex">
      <Link
        to={`/posts/${post.id}`}
        className={cn(
          "group flex flex-1 flex-col overflow-hidden rounded-2xl bg-raised shadow-card ring-1 ring-inset ring-fg/[0.06] transition-colors hover:bg-lifted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf",
          compact && "max-sm:flex-row max-sm:gap-3 max-sm:p-2.5"
        )}
      >
        {/* As a row, the photo's corners are the card's minus its padding
            (16 - 10 = 6px), so the two curves stay concentric. */}
        <div className={cn("relative aspect-[3/2] rounded-t-2xl bg-lifted", compact && "max-sm:aspect-auto max-sm:size-20 max-sm:shrink-0 max-sm:overflow-hidden max-sm:rounded-md")}>
          <CardPhoto key={post.photoUrl} src={post.photoUrl} />
          {/* Wavy edge where the photo meets the text, filled with the card's
              colour (and its hover colour); -bottom-px avoids a hairline seam. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 120 12"
            preserveAspectRatio="none"
            className={cn("absolute inset-x-0 -bottom-px h-3 w-full fill-raised transition-colors group-hover:fill-lifted", compact && "max-sm:hidden")}
          >
            <path d="M0 6 Q6 0 12 6 T24 6 T36 6 T48 6 T60 6 T72 6 T84 6 T96 6 T108 6 T120 6 V12 H0 Z" />
          </svg>
          {(requestedTag || post.isDemo) && (
            <div className={cn("absolute top-3 left-3 flex gap-1.5", compact && "max-sm:top-1 max-sm:left-1")}>
              {requestedTag && <span className={cn(TAG, "text-fg", compact && "max-sm:rounded-sm max-sm:px-1.5 max-sm:py-0.5 max-sm:text-[11px]")}>Requested</span>}
              {post.isDemo && <span className={cn(TAG, "text-leaf", compact && "max-sm:rounded-sm max-sm:px-1.5 max-sm:py-0.5 max-sm:text-[11px]")}>Demo</span>}
            </div>
          )}
        </div>

        <div className={cn("flex flex-1 flex-col p-4", BODY_FADE, compact && "max-sm:min-w-0 max-sm:bg-none max-sm:p-0 max-sm:pr-1.5")}>
          <h2
            className={cn(
              "line-clamp-2 font-display text-lg font-semibold leading-snug text-balance",
              compact && "max-sm:line-clamp-1 max-sm:text-base",
              compact && corner && "max-sm:pr-9"
            )}
          >
            {post.title}
          </h2>
          {status ? (
            <p className={cn("mt-1.5 flex items-center gap-2 text-sm", compact && "max-sm:mt-0.5", status.attention ? "font-medium text-leaf" : "text-fg-muted")}>
              {/* A small dot as well as the colour, so "needs you" isn't colour alone. */}
              {status.attention && <span className="size-2 shrink-0 rounded-full bg-leaf" aria-hidden="true" />}
              {status.text}
            </p>
          ) : (
            post.description && (
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-pretty text-fg-muted">{post.description}</p>
            )
          )}

          <div className={cn("mt-auto flex items-center justify-between gap-3 pt-4", compact && "max-sm:pt-1")}>
            {/* On a narrow card a long window wraps to two lines rather than
                squeezing the button. */}
            <p className="flex min-w-0 items-start gap-2 text-sm text-fg tabular-nums">
              <Clock className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
              {formatPickupTime(post.pickupWindowStart, post.pickupWindowEnd)}
            </p>

            {/* Looks like a button but is part of the card's link, so the whole
                card stays one big target. Secondary, so a grid of cards isn't a
                wall of bright green competing with the page's Post food button. */}
            <span aria-hidden="true" className={buttonClasses({ variant: "secondary", size: "sm", className: cn("shrink-0", compact && "max-sm:hidden") })}>
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
        {/* A row has no room for the button beside a long pickup window, and
            its status line already says what's needed. Left out when a corner
            control is there, which it would sit just under. */}
        {compact && !corner && (
          <ChevronRight className="hidden size-4 shrink-0 self-center text-fg-subtle max-sm:block" aria-hidden="true" />
        )}
      </Link>
      {selection ? (
        // The same elements in both modes, so switching fades rather than
        // swaps. A label over the whole card toggles the box, but only lets
        // clicks through once selecting; until then the card still opens and
        // only the box itself (shown on hover) can be ticked.
        <label
          className={cn(
            "absolute inset-0 rounded-2xl ring-leaf transition-[box-shadow] duration-200 ease-out motion-reduce:transition-none",
            selection.active ? "cursor-pointer" : "pointer-events-none",
            selection.active && selection.selected ? "ring-2" : "ring-0"
          )}
        >
          <span
            className={cn(
              "pointer-events-auto absolute top-3 right-3 grid size-9 place-items-center rounded-lg bg-canvas/85 backdrop-blur-sm",
              HIT_AREA,
              "transition-[opacity,scale] duration-200 ease-out motion-reduce:transition-none",
              selection.active
                ? "opacity-100"
                : "scale-90 opacity-0 group-hover/card:scale-100 group-hover/card:opacity-100 has-[:focus-visible]:scale-100 has-[:focus-visible]:opacity-100 [@media(hover:none)]:scale-100 [@media(hover:none)]:opacity-100"
            )}
          >
            <Checkbox
              checked={selection.active && selection.selected}
              onChange={selection.onToggle}
              aria-label={`Select "${post.title}"`}
            />
          </span>
        </label>
      ) : (
        action && <div className="absolute top-3 right-3">{action}</div>
      )}
    </div>
  );
}
