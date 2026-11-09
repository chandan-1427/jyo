import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

type Drag = {
  from: number;
  to: number;
  startY: number;
  dy: number;
  min: number;
  max: number;
  rects: { top: number; bottom: number; height: number }[];
  dropping: boolean;
};

const SETTLE_MS = 160;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const move = <T,>(list: T[], from: number, to: number) => {
  const next = [...list];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
};

// Drag a row by its handle and the rows around it slide out of the way, as
// in ClickUp's task lists; the arrow keys do the same from the handle. The
// order lives only on this screen: the server's order is newest first, and
// nothing about a person changes by moving them.
export function useRowReorder<T extends { id: string }>(items: T[]) {
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);

  const rank = new Map(order.map((id, i) => [id, i]));
  const rows = [...items].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));

  const commit = (from: number, to: number) => {
    if (from !== to) setOrder(move(rows, from, to).map((r) => r.id));
  };

  const offsetFor = (d: Drag, i: number) => {
    const h = d.rects[d.from].height;
    if (i === d.from) {
      if (!d.dropping) return d.dy;
      return d.to > d.from ? d.rects[d.to].bottom - d.rects[d.from].bottom : d.rects[d.to].top - d.rects[d.from].top;
    }
    if (d.to > d.from && i > d.from && i <= d.to) return -h;
    if (d.to < d.from && i >= d.to && i < d.from) return h;
    return 0;
  };

  const onPointerDown = (index: number) => (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || drag || !bodyRef.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rects = [...bodyRef.current.rows].map((tr) => {
      const r = tr.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, height: r.height };
    });
    const body = bodyRef.current.getBoundingClientRect();
    setDrag({
      from: index,
      to: index,
      startY: e.clientY,
      dy: 0,
      min: body.top - rects[index].top,
      max: body.bottom - rects[index].bottom,
      rects,
      dropping: false,
    });
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (!drag || drag.dropping) return;
    const dy = Math.min(drag.max, Math.max(drag.min, e.clientY - drag.startY));
    const r = drag.rects[drag.from];
    // A row's leading edge crossing a neighbour's middle swaps them. Its
    // centre can't: dragging is stopped at the table's edge, which leaves
    // the centre exactly on the first row's middle, never past it.
    const mid = (i: number) => (drag.rects[i].top + drag.rects[i].bottom) / 2;
    let to = drag.from;
    while (to < drag.rects.length - 1 && r.bottom + dy > mid(to + 1)) to++;
    if (to === drag.from) while (to > 0 && r.top + dy < mid(to - 1)) to--;
    setDrag({ ...drag, dy, to });
  };

  // The row glides into its slot first, then the list is reordered with
  // every offset at zero, so nothing jumps.
  const onPointerUp = () => {
    if (!drag || drag.dropping) return;
    const { from, to } = drag;
    if (reducedMotion()) {
      commit(from, to);
      setDrag(null);
      return;
    }
    setDrag({ ...drag, dropping: true });
    window.setTimeout(() => {
      commit(from, to);
      setDrag(null);
    }, SETTLE_MS);
  };

  const onKeyDown = (index: number) => (e: KeyboardEvent<HTMLElement>) => {
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    const to = index + step;
    if (!step || to < 0 || to >= rows.length) return;
    e.preventDefault();
    commit(index, to);
  };

  const rowProps = (index: number): { style?: CSSProperties; "data-dragging"?: boolean } => {
    if (!drag) return {};
    const offset = offsetFor(drag, index);
    const moving = index === drag.from;
    return {
      "data-dragging": moving || undefined,
      style: {
        translate: `0 ${offset}px`,
        position: "relative",
        zIndex: moving ? 1 : undefined,
        transition: (moving && !drag.dropping) || reducedMotion() ? "none" : `translate ${SETTLE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      },
    };
  };

  const handleProps = (index: number) => ({
    onPointerDown: onPointerDown(index),
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onKeyDown: onKeyDown(index),
  });

  return { bodyRef, rows, rowProps, handleProps, reordered: items.some((item) => rank.has(item.id)) };
}
