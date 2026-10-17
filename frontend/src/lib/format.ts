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

// Plain-language pickup time: "Today, 7:00 pm to 9:00 pm" before pickup
// starts, "Until 9:00 pm" once it has (with the day if it isn't today).
export function formatPickupTime(start: string, end: string, now = new Date()): string {
  const s = new Date(start);
  const e = new Date(end);
  if (now < s) return `${formatDay(s, now)}, ${formatTime(s)} to ${formatTime(e)}`;
  const day = formatDay(e, now);
  return day === "Today" ? `Until ${formatTime(e)}` : `Until ${day.toLowerCase()} ${formatTime(e)}`;
}

export function formatPickupWindow(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const date = s.toLocaleDateString("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "short",
  });
  const startTime = s.toLocaleTimeString("en-IN", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const endTime = e.toLocaleTimeString("en-IN", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${date}, ${startTime} – ${endTime}`;
}