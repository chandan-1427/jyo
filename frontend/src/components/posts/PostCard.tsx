import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Clock, UtensilsCrossed } from "lucide-react";
import type { FoodPost } from "@/types/api";
import { formatPickupTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Checkbox } from "../ui/Checkbox";

type Props = {
  post: FoodPost;
  // A line about where the post stands, under the title, e.g. on your own
  // posts: "Someone asked for this". `attention` marks the ones waiting on you.
  status?: { text: string; attention?: boolean };
  // A control in the photo's top-right corner, e.g. cancel on your request.
  // It sits beside the card's link, not in it (a button can't go inside a link).
  action?: ReactNode;
  // Lets the card be picked, for acting on several at once. Until `active`
  // (no selection yet), only a checkbox shows, on hover (always on touch
  // screens, which have none); ticking it is how picking starts. Once active,
  // a click anywhere on the card toggles it instead of opening it.
  selection?: { active: boolean; selected: boolean; onToggle: () => void };
};

const TAG = "rounded-md bg-canvas/85 px-2 py-1 text-xs font-medium backdrop-blur-sm";

// A larger invisible hit area around the small corner controls, closer to
// the 44px a finger needs.
const HIT_AREA = "after:absolute after:-inset-1.5";

// Starts at the card colour, so it meets the wave without a seam, and darkens
// slightly towards the bottom, but only halfway to the next step down, so the
// card never fades into the page. Hover shifts both ends up a step.
const BODY_FADE =
  "bg-linear-to-b from-lifted to-[color-mix(in_oklab,var(--color-lifted),var(--color-raised)_50%)] transition-colors group-hover:from-lifted-top group-hover:to-lifted";

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

// A small card for a dense grid (PostGrid: two columns on phones, up to five
// on desktop), for browsing by photo: the photo, the title, an optional status
// line and the pickup time. No description and no button: at these widths a
// button would squeeze the pickup time onto two lines, and the whole card is
// already the link (its hover shows it; the status line says what's needed).
//
// Nearly every post in the feed is open, so "Open" isn't tagged; only the
// states that change what you'd do are: someone already asked, or it's a demo.
// With a `status` line, that line says where the post stands instead.
export default function PostCard({ post, status, action, selection }: Props) {
  const requestedTag = !status && post.status === "pending_approval";

  return (
    // flex, so the link fills the grid row's height whether or not there's an action.
    <div className="group/card relative flex">
      <Link
        to={`/posts/${post.id}`}
        // A step lighter than the page (lifted, not raised) with a faint white
        // ring, so cards stand clear of the dark page without a heavy border.
        className="group flex flex-1 flex-col overflow-hidden rounded-2xl bg-lifted shadow-card ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-lifted-top focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
      >
        <div className="relative aspect-[3/2] rounded-t-2xl bg-raised">
          <CardPhoto key={post.photoUrl} src={post.photoUrl} />
          {/* Wavy edge where the photo meets the text, filled with the card's
              colour (and its hover colour); -bottom-px avoids a hairline seam. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 120 12"
            preserveAspectRatio="none"
            className="absolute inset-x-0 -bottom-px h-3 w-full fill-lifted transition-colors group-hover:fill-lifted-top"
          >
            <path d="M0 6 Q6 0 12 6 T24 6 T36 6 T48 6 T60 6 T72 6 T84 6 T96 6 T108 6 T120 6 V12 H0 Z" />
          </svg>
          {(requestedTag || post.isDemo) && (
            <div className="absolute top-2 left-2 flex gap-1.5">
              {requestedTag && <span className={cn(TAG, "text-fg")}>Requested</span>}
              {post.isDemo && <span className={cn(TAG, "text-leaf")}>Demo</span>}
            </div>
          )}
        </div>

        {/* Less padding on top: the wave already parts the photo from the text. */}
        <div className={cn("flex flex-1 flex-col px-3 pt-1.5 pb-3 sm:px-3.5 sm:pt-2 sm:pb-3.5", BODY_FADE)}>
          <h2 className="line-clamp-2 font-display text-[15px] font-semibold leading-snug text-balance sm:text-base">
            {post.title}
          </h2>
          {status && (
            <p
              className={cn(
                "mt-1 flex items-start gap-1.5 text-[13px] leading-snug sm:text-sm",
                status.attention ? "font-medium text-leaf" : "text-fg-muted"
              )}
            >
              {/* A small dot as well as the colour, so "needs you" isn't colour alone. */}
              {status.attention && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-leaf" aria-hidden="true" />}
              {status.text}
            </p>
          )}

          {/* A long window wraps to a second line rather than being cut off. */}
          <p className="mt-auto flex min-w-0 items-start gap-1.5 pt-2 text-[13px] text-fg tabular-nums sm:gap-2 sm:pt-3 sm:text-sm">
            <Clock className="mt-[3px] size-3.5 shrink-0 text-fg-muted sm:mt-0.5 sm:size-4" aria-hidden="true" />
            {formatPickupTime(post.pickupWindowStart, post.pickupWindowEnd)}
          </p>
        </div>
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
              "pointer-events-auto absolute top-2 right-2 grid size-9 place-items-center rounded-lg bg-canvas/85 backdrop-blur-sm",
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
        action && <div className="absolute top-2 right-2">{action}</div>
      )}
    </div>
  );
}
