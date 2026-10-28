import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  // An illustration shown instead of the icon, for an empty page with room
  // for a bit of character (e.g. no posts yet).
  art?: ReactNode;
  title: string;
  children?: ReactNode;
  // Buttons for the next step.
  actions?: ReactNode;
  className?: string;
}

// A page-level "nothing here" or "can't continue" panel, always with a way forward.
// Frosted glass like the phone tab bar: the same tint, blur and hairline edge,
// a highlight along the top and the same soft lift. Without backdrop-filter
// support it falls back to a near-solid fill.
export function EmptyState({ icon, art, title, children, actions, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl bg-canvas/70 px-6 py-20 text-center ring-1 ring-inset ring-fg/[0.08] backdrop-blur-lg backdrop-saturate-150",
        "shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_24px_48px_-12px_rgb(0_0_0/0.6),0_4px_12px_rgb(0_0_0/0.35)]",
        "supports-[not(backdrop-filter:blur(0))]:bg-canvas/95",
        className
      )}
    >
      {/* Without a drawing, a bare line icon, large and thin-stroked like the
          drawings, rather than an icon in a tinted tile. */}
      {art ?? (
        <div className="flex text-fg-subtle [&>svg]:size-10 [&>svg]:stroke-[1.5]" aria-hidden="true">
          {icon}
        </div>
      )}
      <h2 className="mt-5 font-display text-xl font-semibold">{title}</h2>
      {children && <div className="mt-2 max-w-md leading-relaxed text-fg-muted">{children}</div>}
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  );
}
