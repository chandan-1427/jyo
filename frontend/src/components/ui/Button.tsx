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
