import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type ActivityDay = { date: string; posts: number; requests: number };

// Checked with the dataviz palette validator against the card surface
// (#141716, dark): lightness band, chroma, colour-blind separation and
// contrast all pass. Identity is never colour alone: a legend names each.
const SERIES = [
  { key: "posts", label: "Posts", color: "#3DA875" },
  { key: "requests", label: "Requests", color: "#4C86E8" },
] as const;

const HEIGHT = 240;
const PAD = { top: 12, right: 12, bottom: 28, left: 32 };

// Indian calendar dates as the API sends them ("2026-11-09").
const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

// A round top for the y axis with four steps between it and zero.
function niceMax(max: number) {
  if (max <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(max / 4)));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => s * 4 >= max)!;
  return nice * 4;
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function ActivityChart({ days }: { days: ActivityDay[] }) {
  const [frameRef, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);

  const innerW = Math.max(width - PAD.left - PAD.right, 1);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const top = niceMax(Math.max(0, ...days.flatMap((d) => [d.posts, d.requests])));
  const x = (i: number) => PAD.left + (days.length > 1 ? (i / (days.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const ticks = [0, 1, 2, 3, 4].map((n) => (top / 4) * n);
  const labelEvery = Math.max(1, Math.ceil(days.length / Math.max(2, Math.floor(innerW / 72))));

  const indexAt = (clientX: number, rect: DOMRect) => {
    const ratio = (clientX - rect.left - PAD.left) / innerW;
    return Math.min(days.length - 1, Math.max(0, Math.round(ratio * (days.length - 1))));
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => setActive(indexAt(e.clientX, e.currentTarget.getBoundingClientRect()));
  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step || !days.length) return;
    e.preventDefault();
    setActive((i) => Math.min(days.length - 1, Math.max(0, (i ?? days.length - 1) + step)));
  };

  const day = active !== null ? days[active] : null;
  const tipLeft = active !== null ? Math.min(Math.max(x(active) - 80, 0), Math.max(width - 160, 0)) : 0;

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-fg-muted">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} aria-hidden="true" />
            {s.label}
            <span className="font-medium text-fg tabular-nums">{days.reduce((t, d) => t + d[s.key], 0)}</span>
          </li>
        ))}
      </ul>

      <div ref={frameRef} className="relative">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label="Posts and requests per day. Use the left and right arrow keys to read each day."
            tabIndex={0}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setActive(null)}
            onKeyDown={onKeyDown}
            onBlur={() => setActive(null)}
            className="block touch-pan-y rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-leaf"
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={PAD.left + innerW} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-fg/[0.08]" />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-fg-subtle text-[11px] tabular-nums">
                  {t}
                </text>
              </g>
            ))}
            {days.map((d, i) =>
              i % labelEvery === 0 || i === days.length - 1 ? (
                <text
                  key={d.date}
                  x={x(i)}
                  y={HEIGHT - 8}
                  textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"}
                  className="fill-fg-subtle text-[11px]"
                >
                  {dayLabel(d.date)}
                </text>
              ) : null
            )}
            {active !== null && (
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} stroke="currentColor" className="text-fg/25" />
            )}
            {SERIES.map((s) => (
              <path
                key={s.key}
                d={days.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d[s.key])}`).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {SERIES.map((s) =>
              days.length ? (
                <circle
                  key={s.key}
                  cx={x(active ?? days.length - 1)}
                  cy={y(days[active ?? days.length - 1][s.key])}
                  r={4}
                  fill={s.color}
                  stroke="var(--color-raised)"
                  strokeWidth={2}
                />
              ) : null
            )}
          </svg>
        )}

        {day && (
          <div
            className="pointer-events-none absolute top-0 w-40 rounded-xl bg-lifted px-3 py-2.5 text-sm shadow-lift ring-1 ring-inset ring-fg/[0.08]"
            style={{ left: tipLeft }}
          >
            <p className="font-medium text-fg">{dayLabel(day.date)}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="mt-1 flex items-center gap-2 text-fg-muted">
                <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                {s.label}
                <span className="ml-auto font-medium text-fg tabular-nums">{day[s.key]}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <table className="sr-only">
        <caption>Posts and requests per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Posts</th>
            <th scope="col">Requests</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{dayLabel(d.date)}</th>
              <td>{d.posts}</td>
              <td>{d.requests}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
