import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, Clock } from "lucide-react";
import { cn } from "../../lib/utils";

interface DateTimePickerProps {
  value: string;        // "YYYY-MM-DDTHH:MM"
  onChange: (value: string) => void;
  min?: string;          // "YYYY-MM-DDTHH:MM"
  placeholder?: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,...,55

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseValue(value: string) {
  if (!value) return null;
  const [datePart, timePart] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  return { y, m, d, hh, mm };
}

function toValue(y: number, m: number, d: number, hh: number, mm: number) {
  return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}`;
}

function formatLabel(value: string) {
  const parsed = parseValue(value);
  if (!parsed) return "";
  const date = new Date(parsed.y, parsed.m - 1, parsed.d, parsed.hh, parsed.mm);
  const day = pad(date.getDate());
  const month = date.toLocaleString("en-IN", { month: "short" });
  const year = date.getFullYear();
  let hour12 = date.getHours() % 12;
  if (hour12 === 0) hour12 = 12;
  const period = date.getHours() < 12 ? "AM" : "PM";
  return `${day} ${month} ${year}, ${hour12}:${pad(date.getMinutes())} ${period}`;
}

function startOfDay(y: number, m: number, d: number) {
  return new Date(y, m - 1, d).setHours(0, 0, 0, 0);
}

export function DateTimePicker({ value, onChange, min, placeholder = "Select date & time" }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const parsed = parseValue(value);
  const minParsed = parseValue(min ?? "");

  const initialView = parsed
    ? new Date(parsed.y, parsed.m - 1, 1)
    : minParsed
    ? new Date(minParsed.y, minParsed.m - 1, 1)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [viewMonth, setViewMonth] = useState(initialView);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth(); // 0-indexed

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { day: number; inMonth: boolean; y: number; m: number }[] = [];

  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, inMonth: false, y: month === 0 ? year - 1 : year, m: month === 0 ? 12 : month });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true, y: year, m: month + 1 });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    cells.push({
      day: cells.length - (firstDayOfMonth + daysInMonth) + 1,
      inMonth: false,
      y: month === 11 ? year + 1 : year,
      m: month === 11 ? 1 : month + 2,
    });
    if (cells.length >= 42) break;
  }

  const isDisabled = (y: number, m: number, d: number) => {
    if (!minParsed) return false;
    return startOfDay(y, m, d) < startOfDay(minParsed.y, minParsed.m, minParsed.d);
  };

  const isSelected = (y: number, m: number, d: number) =>
    parsed && parsed.y === y && parsed.m === m && parsed.d === d;

  const isToday = (y: number, m: number, d: number) => {
    const now = new Date();
    return now.getFullYear() === y && now.getMonth() + 1 === m && now.getDate() === d;
  };

  const currentHour = parsed ? (parsed.hh % 12 === 0 ? 12 : parsed.hh % 12) : 12;
  const currentMinuteRounded = parsed ? Math.round(parsed.mm / 5) * 5 % 60 : 0;
  const currentPeriod = parsed ? (parsed.hh < 12 ? "AM" : "PM") : "AM";

  const selectDay = (y: number, m: number, d: number) => {
    if (isDisabled(y, m, d)) return;
    const hh = parsed ? parsed.hh : 12;
    const mm = parsed ? parsed.mm : 0;
    onChange(toValue(y, m, d, hh, mm));
  };

  const updateTime = (hour12: number, minute: number, period: "AM" | "PM") => {
    const base = parsed ?? minParsed ?? { y: year, m: month + 1, d: new Date().getDate(), hh: 0, mm: 0 };
    let hh = hour12 % 12;
    if (period === "PM") hh += 12;
    onChange(toValue(base.y, base.m, base.d, hh, minute));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "w-full flex items-center gap-2 rounded-lg border border-border bg-background",
          "px-3.5 py-2.5 text-sm text-left transition-colors duration-150",
          "hover:border-neutral-600",
          value ? "text-foreground" : "text-subtle"
        )}
      >
        <Calendar className="w-3.5 h-3.5 text-subtle shrink-0" />
        {value ? formatLabel(value) : placeholder}
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-[280px] rounded-xl border border-border bg-surface shadow-lg p-4">

          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setViewMonth(new Date(year, month - 1, 1))}
              className="p-1 rounded-md text-subtle hover:text-foreground hover:bg-background transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-sm font-semibold text-foreground">
              {viewMonth.toLocaleString("en-IN", { month: "long", year: "numeric" })}
            </p>
            <button
              type="button"
              onClick={() => setViewMonth(new Date(year, month + 1, 1))}
              className="p-1 rounded-md text-subtle hover:text-foreground hover:bg-background transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((w) => (
              <span key={w} className="text-[11px] text-subtle text-center py-1">{w}</span>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-1 mb-4">
            {cells.map((cell, i) => {
              const disabled = isDisabled(cell.y, cell.m, cell.day);
              const selected = isSelected(cell.y, cell.m, cell.day);
              const today = isToday(cell.y, cell.m, cell.day);
              return (
                <button
                  type="button"
                  key={i}
                  disabled={disabled}
                  onClick={() => selectDay(cell.y, cell.m, cell.day)}
                  className={cn(
                    "text-[13px] h-7 w-7 mx-auto rounded-md transition-colors",
                    !cell.inMonth && "text-subtle/40",
                    cell.inMonth && !selected && !disabled && "text-muted hover:bg-background",
                    disabled && "text-subtle/30 cursor-not-allowed",
                    selected && "bg-accent text-background font-semibold",
                    today && !selected && "border border-accent/50"
                  )}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Time selection */}
          <div className="border-t border-border pt-3">
            <p className="text-[11px] text-subtle flex items-center gap-1 mb-2">
              <Clock className="w-3 h-3" /> Time
            </p>
            <div className="flex gap-1.5">
              <select
                value={currentHour}
                onChange={(e) => updateTime(Number(e.target.value), currentMinuteRounded, currentPeriod as "AM" | "PM")}
                className="flex-1 rounded-md border border-border bg-background text-sm text-foreground px-2 py-1.5 outline-none focus:border-neutral-600"
              >
                {HOURS.map((h) => <option key={h} value={h}>{pad(h)}</option>)}
              </select>
              <select
                value={currentMinuteRounded}
                onChange={(e) => updateTime(currentHour, Number(e.target.value), currentPeriod as "AM" | "PM")}
                className="flex-1 rounded-md border border-border bg-background text-sm text-foreground px-2 py-1.5 outline-none focus:border-neutral-600"
              >
                {MINUTES.map((m) => <option key={m} value={m}>{pad(m)}</option>)}
              </select>
              <select
                value={currentPeriod}
                onChange={(e) => updateTime(currentHour, currentMinuteRounded, e.target.value as "AM" | "PM")}
                className="flex-1 rounded-md border border-border bg-background text-sm text-foreground px-2 py-1.5 outline-none focus:border-neutral-600"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}