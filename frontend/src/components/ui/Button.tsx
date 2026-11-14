import type { ButtonHTMLAttributes, MouseEventHandler, PointerEventHandler, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { playTypingSound } from "@/lib/typingSounds";
import { cn } from "@/lib/utils";
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
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    to?: never;
    loading?: boolean;
    loadingLabel?: ReactNode;
  };

type AsLink = CommonProps & Omit<LinkProps, keyof CommonProps>;

export type ButtonProps = AsButton | AsLink;

const FACE =
  "col-start-1 row-start-1 inline-flex items-center justify-center gap-2 transition-opacity duration-150 ease-out motion-reduce:transition-none";

type PressHandlers<T> = { onPointerDown?: PointerEventHandler<T>; onClick?: MouseEventHandler<T> };

// Sounds on pointer down, as a real button clicks going down, and on a
// keyboard press, which is a click with detail 0. Chrome still sends
// pointer events to disabled buttons, hence the check.
function withPressSound<T extends HTMLElement>({ onPointerDown, onClick }: PressHandlers<T>): PressHandlers<T> {
  return {
    onPointerDown: (event) => {
      const disabled = event.currentTarget instanceof HTMLButtonElement && event.currentTarget.disabled;
      if (event.button === 0 && !disabled) playTypingSound("button");
      onPointerDown?.(event);
    },
    onClick: (event) => {
      if (event.detail === 0) playTypingSound("button");
      onClick?.(event);
    },
  };
}

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

  // Both faces share one grid cell, so the button is always as wide as the
  // wider one. Swapping them made the label jump sideways mid-click.
  const faces = (loading: boolean, loadingLabel: ReactNode) => (
    <span className="grid">
      <span
        aria-hidden={loading || undefined}
        className={cn(FACE, loading && "opacity-0")}
      >
        {content(iconLeft)}
      </span>
      <span aria-hidden={!loading || undefined} className={cn(FACE, !loading && "opacity-0")}>
        <Loader2 className={cn("size-4", loading && "animate-spin")} aria-hidden="true" />
        <span>{loadingLabel ?? children}</span>
      </span>
    </span>
  );

  if (rest.to !== undefined) {
    const link = rest as Omit<AsLink, keyof CommonProps>;
    return (
      <Link {...link} {...withPressSound(link)} className={classes}>
        {content(iconLeft)}
      </Link>
    );
  }

  const { loading, loadingLabel, disabled, type = "button", ...button } = rest as Omit<AsButton, keyof CommonProps>;
  const canLoad = loading !== undefined || loadingLabel !== undefined;
  return (
    <button
      {...button}
      {...withPressSound(button)}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
    >
      {canLoad ? faces(Boolean(loading), loadingLabel) : content(iconLeft)}
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
      {...withPressSound({})}
      className={buttonClasses({ size: "lg", className: "shrink-0 max-sm:w-11 max-sm:gap-0 max-sm:px-0" })}
    >
      {icon}
      <span className="max-sm:sr-only">{children}</span>
    </Link>
  );
}
