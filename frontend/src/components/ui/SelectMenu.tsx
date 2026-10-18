import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnchoredPopover } from "@/lib/useAnchoredPopover";

interface SelectMenuProps<T extends string> {
  // Names the menu for screen readers, e.g. "Show requests".
  label: string;
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  // Small icon at the start of the button, e.g. a filter icon.
  icon?: ReactNode;
  className?: string;
}

// A dropdown for picking one of several options, e.g. a list filter with too
// many choices for a row of buttons. The button matches a text field, so it
// lines up beside a search box. The menu opens in the top layer and keeps
// itself on screen (useAnchoredPopover); Escape or a click outside closes
// it. Arrow keys, Home and End move through the options.
export function SelectMenu<T extends string>({ label, options, value, onChange, icon, className }: SelectMenuProps<T>) {
  const id = useId();
  const menuId = `${id}-menu`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = options.find((o) => o.value === value) ?? options[0];

  // Opening makes the menu at least as wide as its button, and puts focus on
  // the chosen option so the arrow keys start there.
  const { open, placement } = useAnchoredPopover(triggerRef, menuRef, (isOpen) => {
    if (!isOpen) return;
    if (menuRef.current && triggerRef.current) menuRef.current.style.minWidth = `${triggerRef.current.offsetWidth}px`;
    optionRefs.current[options.indexOf(current)]?.focus();
  });

  const choose = (next: T) => {
    onChange(next);
    menuRef.current?.hidePopover();
    triggerRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const focused = optionRefs.current.indexOf(document.activeElement as HTMLButtonElement);
    const last = options.length - 1;
    const target =
      e.key === "ArrowDown" ? Math.min(focused + 1, last)
      : e.key === "ArrowUp" ? Math.max(focused - 1, 0)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (target === null) return;
    e.preventDefault();
    optionRefs.current[target]?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        popoverTarget={menuId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current.label}`}
        className={cn(
          "flex h-11 cursor-pointer items-center gap-2.5 rounded-xl bg-[var(--field-bg,var(--color-raised))] pr-3 pl-4 text-left text-base text-fg outline-none ring-1 ring-inset ring-fg/[0.08] transition-colors hover:bg-lifted",
          "focus-visible:ring-2 focus-visible:ring-leaf",
          open && "ring-2 ring-leaf",
          className
        )}
      >
        {icon && <span className="flex shrink-0 text-fg-subtle [&>svg]:size-[18px]" aria-hidden="true">{icon}</span>}
        <span className="min-w-0 flex-1 truncate">{current.label}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-fg-subtle transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      <div
        ref={menuRef}
        id={menuId}
        popover="auto"
        role="listbox"
        aria-label={label}
        onKeyDown={onKeyDown}
        // Positioned by useAnchoredPopover; the UA's centring is undone.
        style={{ inset: "auto" }}
        className={cn(
          "fixed m-0 w-max max-w-[calc(100vw-1rem)] rounded-2xl bg-raised p-1.5 text-fg shadow-lift ring-1 ring-inset ring-fg/[0.08]",
          "transition-[opacity,scale] duration-150 ease-out motion-reduce:transition-none starting:scale-95 starting:opacity-0",
          placement === "below" ? "origin-top" : "origin-bottom"
        )}
      >
        {options.map((option, i) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              ref={(el) => {
                optionRefs.current[i] = el;
              }}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => choose(option.value)}
              className={cn(
                "flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors outline-none hover:bg-lifted focus-visible:bg-lifted",
                selected ? "font-medium text-fg" : "text-fg-muted hover:text-fg"
              )}
            >
              <Check className={cn("size-4 shrink-0 text-leaf", !selected && "invisible")} aria-hidden="true" />
              <span className="flex-1">{option.label}</span>
              {option.count !== undefined && (
                <span className="pl-4 text-fg-subtle tabular-nums">{option.count}</span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
