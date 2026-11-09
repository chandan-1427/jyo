import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { EllipsisVertical } from "lucide-react";
import { useAnchoredPopover } from "@/lib/useAnchoredPopover";
import { cn } from "@/lib/utils";

export type MenuAction = { label: string; icon: ReactNode; onSelect: () => void; danger?: boolean };

// A row's ⋮ menu. Built on the Popover API like SelectMenu: the browser opens
// it in the top layer and closes it on Escape or a click outside, and nothing
// locks the page's scrolling, so opening it never shifts the layout (a
// scroll-locking menu hides the scrollbar and moves everything sideways).
export function ActionMenu({ label, actions }: { label: string; actions: MenuAction[] }) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const { placement } = useAnchoredPopover(
    triggerRef,
    menuRef,
    (isOpen) => {
      if (isOpen) itemRefs.current[0]?.focus();
    },
    "end"
  );

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    itemRefs.current[(index + step + actions.length) % actions.length]?.focus();
  };

  if (!actions.length) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        popoverTarget={id}
        aria-haspopup="menu"
        aria-label={label}
        className="relative grid size-9 cursor-pointer place-items-center rounded-lg text-fg-subtle transition-colors after:absolute after:-inset-1 hover:bg-fg/5 hover:text-fg focus-visible:outline-2 focus-visible:outline-leaf"
      >
        <EllipsisVertical className="size-4" aria-hidden="true" />
      </button>
      <div
        ref={menuRef}
        id={id}
        popover="auto"
        role="menu"
        aria-label={label}
        style={{ inset: "auto" }}
        className={cn(
          "fixed m-0 min-w-52 rounded-2xl bg-raised p-1.5 text-fg shadow-lift ring-1 ring-inset ring-fg/[0.08]",
          "transition-[opacity,scale] duration-150 ease-out motion-reduce:transition-none starting:scale-95 starting:opacity-0",
          placement === "below" ? "origin-top" : "origin-bottom"
        )}
      >
        {actions.map((action, i) => (
          <button
            key={action.label}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            type="button"
            role="menuitem"
            onKeyDown={(e) => onKeyDown(e, i)}
            onClick={() => {
              menuRef.current?.hidePopover();
              action.onSelect();
            }}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm outline-none transition-colors [&>svg]:size-4 [&>svg]:shrink-0",
              action.danger ? "text-danger hover:bg-danger/10 focus-visible:bg-danger/10" : "hover:bg-fg/5 focus-visible:bg-fg/5"
            )}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>
    </>
  );
}
