import { useEffect, useId, useRef, type ReactNode } from "react";
import { useLenis } from "lenis/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  // Width on larger screens: md for short messages and small forms, lg for
  // longer forms. Phones always get a full-width sheet.
  size?: "md" | "lg";
  className?: string;
}

const WIDTHS = { md: "sm:max-w-md", lg: "sm:max-w-xl" };

// A native <dialog> opened as a modal: the browser traps focus inside it,
// makes the page behind inert, and closes it on Escape. Rendered only while
// open, so the content inside starts fresh each time.
//
// Phones get a sheet that slides up from the bottom, within thumb reach;
// wider screens get a centred panel that scales up from 0.9 with a fade
// [08]. The page behind is dimmed and slightly blurred so it reads as out of
// play [06]. Entry is a transition from @starting-style; closing unmounts it
// at once, with no exit animation.
export function Dialog({ title, onClose, children, size = "md", className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const lenis = useLenis();

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  // Lenis drives page scrolling, so it would keep scrolling the page under
  // the dialog; pause it while open.
  useEffect(() => {
    lenis?.stop();
    return () => lenis?.start();
  }, [lenis]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // A click on the dialog element itself can only be on the backdrop,
      // since the inner panel covers the whole box.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={cn(
        "m-0 mt-auto max-h-[90dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-2xl bg-raised text-fg shadow-lift ring-1 ring-inset ring-fg/[0.06] [--field-bg:var(--color-canvas)]",
        "sm:m-auto sm:w-[calc(100%-2rem)] sm:rounded-2xl",
        WIDTHS[size],
        "backdrop:bg-black/60 backdrop:backdrop-blur-[2px]",
        "transition-[opacity,translate,scale] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        "starting:translate-y-full sm:starting:translate-y-0 sm:starting:scale-90 sm:starting:opacity-0",
        className
      )}
    >
      <div className="p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id={titleId} className="font-display text-xl font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 grid size-9 cursor-pointer place-items-center rounded-lg text-fg-muted transition-colors hover:bg-lifted hover:text-fg focus-visible:outline-2 focus-visible:outline-leaf"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
