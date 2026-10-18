import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Calendar, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { cn, preventDoubleClickSelection } from "@/lib/utils";
import { useAnchoredPopover } from "@/lib/useAnchoredPopover";
import { FieldFrame } from "./TextField";
import { Button } from "./Button";

// Values are local "YYYY-MM-DDTHH:mm" strings, the same as a
// <input type="datetime-local">, so forms can swap one for the other.

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MINUTE_STEP = 5;

const pad = (n: number) => String(n).padStart(2, "0");
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());

function parse(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "Today, 7:00 pm", "Tomorrow, 9:30 am", "Wed 21 Oct, 1:00 pm".
function formatLabel(d: Date): string {
  const now = new Date();
  const day = sameDay(d, now)
    ? "Today"
    : sameDay(d, addDays(now, 1))
      ? "Tomorrow"
      : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  return `${day}, ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}`;
}

// The next time on the minute step, so a fresh pick starts somewhere sensible.
function nextStep(from: Date): Date {
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil((d.getMinutes() + 1) / MINUTE_STEP) * MINUTE_STEP);
  return d;
}

// Six weeks from the Sunday on or before the 1st, so every month has the
// same height and the panel doesn't jump when paging months.
function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

// A number that steps up and down with buttons or the arrow keys.
function Stepper({
  label,
  display,
  onStep,
}: {
  label: string;
  display: string;
  onStep: (direction: 1 | -1) => void;
}) {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      onStep(e.key === "ArrowUp" ? 1 : -1);
    }
  };
  const step = "grid size-7 cursor-pointer place-items-center rounded-lg text-fg-muted transition-colors hover:bg-lifted hover:text-fg";

  return (
    <div onMouseDown={preventDoubleClickSelection} className="flex items-center gap-0.5 rounded-xl bg-canvas p-0.5 ring-1 ring-inset ring-fg/[0.08]">
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => onStep(-1)} className={step}>
        <Minus className="size-3.5" />
      </button>
      <span
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuetext={display}
        onKeyDown={onKeyDown}
        className="w-6 rounded-md text-center font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-leaf"
      >
        {display}
      </span>
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => onStep(1)} className={step}>
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

interface DateTimeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  // Called when the panel closes, so a form can mark the field as touched.
  onBlur?: () => void;
  // The earliest and latest times that can be picked ("YYYY-MM-DDTHH:mm").
  // Days outside them are disabled, and a time outside them is moved to the
  // nearest allowed slot.
  min?: string;
  max?: string;
  error?: string;
  hint?: string;
  labelAside?: ReactNode;
  className?: string;
}

// A date-and-time field in the app's own style. The panel opens in the
// browser's top layer (the Popover API), so no scrolling container or dialog
// can clip it, and it closes on Escape or a click outside. It positions
// itself against the field and keeps itself on screen (useAnchoredPopover).
export function DateTimeField({ label, value, onChange, onBlur, min, max, error, hint, labelAside, className }: DateTimeFieldProps) {
  const id = useId();
  const panelId = `${id}-panel`;
  const messageId = `${id}-message`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const selected = parse(value);
  const minDay = parse(min ?? "");
  const [month, setMonth] = useState(() => startOfDay(selected ?? minDay ?? new Date()));
  const [focusDay, setFocusDay] = useState(() => startOfDay(selected ?? minDay ?? new Date()));

  // Opening shows the chosen day's month (or the earliest allowed one);
  // closing marks the field touched.
  const { open, placement } = useAnchoredPopover(triggerRef, panelRef, (isOpen) => {
    if (isOpen) {
      const start = startOfDay(parse(value) ?? parse(min ?? "") ?? new Date());
      setMonth(start);
      setFocusDay(start);
    } else {
      onBlur?.();
    }
  });

  // Keyboard focus follows the focused day, including into a new month.
  useEffect(() => {
    if (!open) return;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay.getTime()}"]`)?.focus();
  }, [open, focusDay]);

  const maxDay = parse(max ?? "");
  const isDisabled = (day: Date) =>
    (!!minDay && day < startOfDay(minDay)) || (!!maxDay && day > startOfDay(maxDay));

  // Every change goes through here, so nothing outside min/max is ever set:
  // too early moves up to the first slot at or after min, too late moves
  // down to the last slot at or before max.
  const commit = (d: Date) => {
    let next = d;
    if (minDay && next < minDay) next = nextStep(new Date(minDay.getTime() - 60_000));
    if (maxDay && next > maxDay) {
      next = new Date(maxDay);
      next.setMinutes(Math.floor(next.getMinutes() / MINUTE_STEP) * MINUTE_STEP, 0, 0);
    }
    onChange(toValue(next));
  };

  const pickDay = (day: Date) => {
    if (isDisabled(day)) return;
    const time = selected ?? nextStep(new Date());
    commit(new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes()));
    setFocusDay(startOfDay(day));
  };

  // Time changes keep the chosen day (or start from today's next slot).
  const base = selected ?? nextStep(new Date());
  const setTime = (hours: number, minutes: number) => {
    const d = new Date(base);
    d.setHours(hours, minutes, 0, 0);
    commit(d);
  };
  const hour12 = base.getHours() % 12 || 12;
  const pm = base.getHours() >= 12;
  const stepHour = (dir: 1 | -1) => setTime((base.getHours() + dir + 24) % 24, base.getMinutes());
  const stepMinute = (dir: 1 | -1) => {
    // Snaps an off-step minute (e.g. 07) to the step first.
    const snapped = dir > 0
      ? Math.floor(base.getMinutes() / MINUTE_STEP) * MINUTE_STEP + MINUTE_STEP
      : Math.ceil(base.getMinutes() / MINUTE_STEP) * MINUTE_STEP - MINUTE_STEP;
    setTime(base.getHours(), (snapped + 60) % 60);
  };

  const onGridKeyDown = (e: KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const by = moves[e.key];
    if (by === undefined) return;
    e.preventDefault();
    const next = addDays(focusDay, by);
    // Disabled days can't take focus, so the keys stop at the allowed range.
    if (isDisabled(next)) return;
    setFocusDay(next);
    if (next.getMonth() !== month.getMonth()) setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  };

  const today = new Date();
  const days = monthGrid(month);
  // No paging to a month with nothing allowed in it.
  const prevDisabled = !!minDay && new Date(month.getFullYear(), month.getMonth(), 0) < startOfDay(minDay);
  const nextDisabled = !!maxDay && new Date(month.getFullYear(), month.getMonth() + 1, 1) > startOfDay(maxDay);
  const pageMonth = (by: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));
  const navButton =
    "grid size-8 cursor-pointer place-items-center rounded-lg text-fg-muted transition-colors hover:bg-lifted hover:text-fg " +
    "focus-visible:outline-2 focus-visible:outline-leaf disabled:pointer-events-none disabled:opacity-30";

  return (
    <FieldFrame
      {...{ label, error, hint, labelAside, className }}
      controlId={id}
      messageId={messageId}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        popoverTarget={panelId}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        className={cn(
          "relative flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl bg-[var(--field-bg,var(--color-raised))] px-4 text-left text-base outline-none ring-1 ring-inset ring-fg/[0.08] transition-colors hover:bg-lifted",
          "focus-visible:ring-2 focus-visible:ring-leaf aria-invalid:ring-danger/70",
          open && "ring-2 ring-leaf",
          selected ? "text-fg" : "text-fg-subtle"
        )}
      >
        <Calendar className="size-[18px] shrink-0 text-fg-subtle" aria-hidden="true" />
        <span className="truncate tabular-nums">{selected ? formatLabel(selected) : "Choose a date and time"}</span>
      </button>

      <div
        ref={panelRef}
        id={panelId}
        popover="auto"
        role="dialog"
        aria-label={label}
        // Positioned by useAnchoredPopover; the UA's centring is undone.
        className={cn(
          "fixed m-0 w-[20rem] max-w-[calc(100vw-1rem)] rounded-2xl bg-raised p-4 text-fg shadow-lift ring-1 ring-inset ring-fg/[0.08] [--field-bg:var(--color-canvas)]",
          "transition-[opacity,scale] duration-150 ease-out motion-reduce:transition-none starting:scale-95 starting:opacity-0",
          placement === "below" ? "origin-top" : "origin-bottom"
        )}
        style={{ inset: "auto" }}
      >
        <div onMouseDown={preventDoubleClickSelection} className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => pageMonth(-1)} disabled={prevDisabled} aria-label="Previous month" className={navButton}>
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <p className="font-display font-semibold" aria-live="polite">
            {month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </p>
          <button type="button" onClick={() => pageMonth(1)} disabled={nextDisabled} aria-label="Next month" className={navButton}>
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-xs text-fg-subtle" aria-hidden="true">
          {WEEKDAYS.map((d) => (
            <span key={d} className="py-1">{d}</span>
          ))}
        </div>

        <div ref={gridRef} role="group" aria-label="Dates" onKeyDown={onGridKeyDown} className="mt-1 grid grid-cols-7 gap-y-1">
          {days.map((day) => {
            const inMonth = day.getMonth() === month.getMonth();
            const disabled = isDisabled(day);
            const isSelected = !!selected && sameDay(day, selected);
            const isFocus = sameDay(day, focusDay);
            return (
              <button
                key={day.getTime()}
                type="button"
                data-day={day.getTime()}
                // One day in the grid is tabbable; arrow keys move between days.
                tabIndex={isFocus ? 0 : -1}
                disabled={disabled}
                aria-pressed={isSelected}
                aria-label={day.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                onClick={() => pickDay(day)}
                className={cn(
                  "mx-auto grid size-9 cursor-pointer place-items-center rounded-lg text-sm tabular-nums transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-leaf disabled:cursor-default disabled:opacity-25",
                  isSelected
                    ? "bg-leaf font-semibold text-canvas"
                    : cn("hover:bg-lifted", inMonth ? "text-fg" : "text-fg-subtle/60"),
                  !isSelected && sameDay(day, today) && "ring-1 ring-inset ring-leaf/60"
                )}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>

        {/* Hour, minutes and am/pm on one line: 20rem leaves room for all three. */}
        <div className="mt-4 flex items-center gap-1.5 border-t border-fg/[0.06] pt-4">
          <Stepper label="Hour" display={String(hour12)} onStep={stepHour} />
          <span className="font-medium text-fg-subtle" aria-hidden="true">:</span>
          <Stepper label="Minutes" display={pad(base.getMinutes())} onStep={stepMinute} />
          <div onMouseDown={preventDoubleClickSelection} className="ml-auto flex shrink-0 rounded-xl bg-canvas p-0.5 ring-1 ring-inset ring-fg/[0.08]" role="group" aria-label="AM or PM">
            {(["am", "pm"] as const).map((half) => {
              const active = (half === "pm") === pm;
              return (
                <button
                  key={half}
                  type="button"
                  aria-pressed={active}
                  onClick={() => !active && setTime((base.getHours() + 12) % 24, base.getMinutes())}
                  className={cn(
                    "h-7 cursor-pointer rounded-lg px-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-leaf",
                    active ? "bg-lifted text-fg" : "text-fg-subtle hover:text-fg"
                  )}
                >
                  {half}
                </button>
              );
            })}
          </div>
        </div>

        <Button
          size="sm"
          fullWidth
          className="mt-4"
          onClick={() => {
            panelRef.current?.hidePopover();
            triggerRef.current?.focus();
          }}
        >
          Done
        </Button>
      </div>
    </FieldFrame>
  );
}
