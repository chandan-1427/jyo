const IST = "Asia/Calcutta";

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: IST });

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true });
}

// "Today", "Tomorrow", or a short date, in Indian time.
function formatDay(d: Date, now: Date): string {
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (dayKey(d) === dayKey(now)) return "Today";
  if (dayKey(d) === dayKey(tomorrow)) return "Tomorrow";
  return d.toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short" });
}

// The same, mid-sentence: "today" and "tomorrow" lower-cased, dates as they are.
function formatDayInline(d: Date, now: Date): string {
  const day = formatDay(d, now);
  return day === "Today" || day === "Tomorrow" ? day.toLowerCase() : day;
}

// The whole pickup window, whether or not it has started or ended:
// "Today, 7:00 pm to 9:00 pm", or "Today, 10:00 pm to tomorrow 1:00 am"
// when it runs past midnight.
export function formatPickupWindow(start: string, end: string, now = new Date()): string {
  const s = new Date(start);
  const e = new Date(end);
  const endDay = dayKey(e) === dayKey(s) ? "" : `${formatDayInline(e, now)} `;
  return `${formatDay(s, now)}, ${formatTime(s)} to ${endDay}${formatTime(e)}`;
}

// Plain-language pickup time for the feed: the whole window before pickup
// starts, then just "Until 9:00 pm" once it has (with the day if it isn't today).
export function formatPickupTime(start: string, end: string, now = new Date()): string {
  const e = new Date(end);
  if (now < new Date(start)) return formatPickupWindow(start, end, now);
  const day = formatDay(e, now);
  return day === "Today" ? `Until ${formatTime(e)}` : `Until ${formatDayInline(e, now)} ${formatTime(e)}`;
}

// A date as a <input type="datetime-local"> value ("YYYY-MM-DDTHH:mm"), in
// the browser's own time zone, which is also how that input reads it back.
export function toDateTimeInput(date: string | Date): string {
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
