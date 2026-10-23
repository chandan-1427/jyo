import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { buttonClasses, type Size, type Variant } from "./buttonStyles";

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
  const classes = buttonClasses({ variant, size, fullWidth, className });

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

// A page's main action at the end of a toolbar row, as tall as the search
// and filter beside it. On phones only the icon shows, in a 44px square, so
// the row fits on one line; the label stays for screen readers.
export function ToolbarButton({ to, icon, children }: { to: string; icon: ReactNode; children: string }) {
  return (
    <Link
      to={to}
      className={buttonClasses({ size: "lg", className: "shrink-0 max-sm:w-11 max-sm:gap-0 max-sm:px-0" })}
    >
      {icon}
      <span className="max-sm:sr-only">{children}</span>
    </Link>
  );
}
