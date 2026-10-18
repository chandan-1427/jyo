import { useRef, type KeyboardEvent } from "react";
import { cn, preventDoubleClickSelection } from "@/lib/utils";

interface SegmentedControlProps<T extends string> {
  // Names the group for screen readers, e.g. "Show".
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

// A row of mutually exclusive options, e.g. a list filter. The same height as
// a text field, so it lines up beside a search box. Works as a radio group:
// one Tab stop, arrow keys move between options and choose them. When the
// options don't fit (a phone, or many of them), the row scrolls sideways
// rather than squashing or overflowing them, and the chosen one is kept in view.
export function SegmentedControl<T extends string>({ label, options, value, onChange, className }: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
    refs.current[next]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onMouseDown={preventDoubleClickSelection}
      className={cn(
        "flex h-11 max-w-full items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-xl bg-raised p-1 ring-1 ring-inset ring-fg/[0.08]",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {options.map((option, i) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={(e) => {
              onChange(option.value);
              e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
            }}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "h-full flex-auto shrink-0 cursor-pointer whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-leaf",
              checked ? "bg-lifted text-fg" : "text-fg-muted hover:text-fg"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
