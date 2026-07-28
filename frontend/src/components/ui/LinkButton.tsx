import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BaseProps {
  label: string;
  className?: string;
  /**
   * `primary` — solid cream fill. At most ONE per screen: the single action we
   * most want taken. Its scarcity is what makes it read as primary.
   * `secondary` — outlined. Equal size and weight to primary, so it stays a
   * real choice rather than a dismissed one; only the fill differs.
   *
   * `secondary` exists because Home.tsx had this exact outlined button
   * hand-written inline twice, character for character.
   */
  variant?: "primary" | "secondary";
}

interface ButtonProps extends BaseProps {
  as?: "button";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

interface LinkProps extends BaseProps {
  as: "link";
  to: string;
  exact?: boolean;
}

type Props = ButtonProps | LinkProps;

// Geometry and motion are shared by both variants, so the two are the same
// physical object and only their surface differs. Identical padding is what
// keeps a secondary CTA from reading as a demotion.
const baseStyles =
  "inline-flex items-center justify-center gap-2 text-sm font-semibold tracking-tight px-6 py-2.5 rounded-lg cursor-pointer active:scale-[0.97] transition-all duration-150 ease-out";

const VARIANTS = {
  // Previously an arbitrary-value fill of #F2F0EC with #1B1A19 label text — the
  // latter a copy-paste of the old --color-background, which is exactly how it
  // went stale. Now tokenised. (Old class names are described, not quoted:
  // Tailwind v4 scans comments, so quoting them re-emits dead CSS.)
  // `hover:bg-white` is kept intentionally: it brightens PAST foreground, so
  // the hover still reads as a lift rather than a colour change.
  primary:
    "bg-foreground text-background hover:bg-white shadow-sm hover:shadow-md",

  // Border thickens rather than the fill appearing, so hover costs no layout
  // shift and the button never competes with primary for attention.
  secondary:
    "border border-border text-muted hover:text-foreground hover:border-border-strong",
} as const;

export function LinkButton(props: Props) {
  const { label, className, variant = "primary" } = props;

  if (props.as === "link") {
    return (
      <Link
        to={props.to}
        className={cn(baseStyles, VARIANTS[variant], className)}
      >
        {label}
      </Link>
    );
  }

  return (
    <button
      type={props.type ?? "button"}
      disabled={props.disabled}
      onClick={props.onClick}
      className={cn(
        baseStyles,
        VARIANTS[variant],
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
        className
      )}
    >
      {props.icon && props.icon}
      {props.loading ? props.loadingLabel ?? "Loading…" : label}
    </button>
  );
}