import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  iconLeft?: ReactNode;
  // Nudges right on hover, so an arrow here reads as "go".
  iconRight?: ReactNode;
  className?: string;
  children: ReactNode;
}

type AsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & { to?: never; loading?: boolean };
type AsLink = CommonProps & Omit<LinkProps, keyof CommonProps>;

export type ButtonProps = AsButton | AsLink;

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
  ghost: "text-fg-muted hover:bg-raised hover:text-fg hover:opacity-100",
  danger: cn(DEPTH, "bg-danger/15 text-danger [--ledge:rgb(239_124_142/0.3)]"),
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  iconLeft,
  iconRight,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = cn(BASE, SIZES[size], VARIANTS[variant], fullWidth && "w-full", className);

  const content = (lead: ReactNode) => (
    <>
      {lead}
      <span>{children}</span>
      {iconRight && (
        <span className="transition-transform duration-200 ease-out group-hover:translate-x-0.5">{iconRight}</span>
      )}
    </>
  );

  if (rest.to !== undefined) {
    return (
      <Link {...(rest as Omit<AsLink, keyof CommonProps>)} className={classes}>
        {content(iconLeft)}
      </Link>
    );
  }

  const { loading, disabled, type = "button", ...button } = rest as Omit<AsButton, keyof CommonProps>;
  return (
    <button {...button} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={classes}>
      {content(loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : iconLeft)}
    </button>
  );
}
