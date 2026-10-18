import { cn } from "@/lib/utils";

export type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "dangerSolid";
export type Size = "sm" | "md" | "lg";

// The press and the fade run at 150ms ease-out so a click feels immediate;
// the corner change runs at 300ms ease-in-out so it reads as a smooth morph.
// All are transitions, so a release mid-way reverses from where it is. Hover
// and press dim the button rather than brighten it, and the press scales from
// the centre. Focus uses an outline, which appears at once.
const BASE =
  "group inline-flex origin-center cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap font-medium tracking-[-0.01em] " +
  // `scale`, not `transform`: Tailwind v4's scale utilities set the standalone
  // CSS `scale` property, so a transition on `transform` alone would snap.
  "[transition-property:scale,opacity,color,border-radius] [transition-duration:150ms,150ms,150ms,300ms] " +
  "[transition-timing-function:ease-out,ease-out,ease-out,cubic-bezier(0.45,0,0.25,1)] " +
  "hover:opacity-85 active:scale-[0.97] active:opacity-75 " +
  // Corners tighten on hover and tighten further on press.
  "hover:rounded-sm active:rounded-xs " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf " +
  "disabled:pointer-events-none disabled:opacity-50";

// Depth from solid colour only: a hard ledge in a darker shade sits under the
// button, like the side of a key. It stays put through hover and press; the
// press scale carries the feedback. Each variant sets --ledge.
const DEPTH = "shadow-[0_2px_0_var(--ledge)]";

// lg is 44px, the smallest comfortable touch target, so it's the size for
// main actions on phones. Smaller sizes are for secondary spots.
const SIZES: Record<Size, string> = {
  sm: "h-8 rounded-lg px-3 text-[13px]",
  md: "h-10 rounded-lg px-4 text-sm",
  lg: "h-11 rounded-xl px-5 text-[15px]",
};

// A slight top-to-bottom gradient, lighter at the top, in a single hue. No
// glows or shine. The ledge colour sits between the face and the page, so the
// step reads on any of the v2 surfaces. Ghost has no surface, so it gets no
// ledge; its hover shows a quiet fill.
const VARIANTS: Record<Variant, string> = {
  primary: cn(DEPTH, "bg-linear-to-b from-cta-top to-cta text-canvas [--ledge:var(--color-cta-deep)]"),
  secondary: cn(DEPTH, "bg-linear-to-b from-lifted-top to-lifted text-fg [--ledge:var(--color-raised)]"),
  // Outlined, no fill or ledge: for the quieter half of a pair (Cancel).
  outline: "text-fg ring-1 ring-inset ring-fg/15 hover:bg-fg/5 hover:opacity-100",
  ghost: "text-fg-muted hover:bg-raised hover:text-fg hover:opacity-100",
  // Outlined in red rather than filled: destructive actions (Log out) should
  // be findable without being the loudest thing on screen.
  danger: "text-danger ring-1 ring-inset ring-danger/50 hover:bg-danger/10 hover:opacity-100",
  // Solid red with the same ledge as primary and secondary, for removing
  // something the person made (Delete post).
  dangerSolid: cn(
    DEPTH,
    "bg-linear-to-b from-danger-solid-top to-danger-solid text-white [--ledge:var(--color-danger-solid-deep)]"
  ),
};

// The button look for an element that isn't itself interactive, such as the
// call to action inside a card that is already one big link (a real button
// or link can't be nested inside another link).
export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
}: { variant?: Variant; size?: Size; fullWidth?: boolean; className?: string } = {}) {
  return cn(BASE, SIZES[size], VARIANTS[variant], fullWidth && "w-full", className);
}
