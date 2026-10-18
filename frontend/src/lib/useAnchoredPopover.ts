import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useState, type RefObject } from "react";

// Space kept between the panel and its trigger, and between the panel and
// the edges of the screen.
const GAP = 6;
const EDGE = 8;

// For a panel using the Popover API (popover="auto", opened by a trigger with
// popovertarget): the browser opens and closes it, puts it in the top layer
// (so no scrolling container or dialog can clip it) and closes it on Escape
// or a click outside. This keeps React's `open` in step, and positions the
// panel against its trigger: below it, or above when there's more room
// there, nudged to stay fully on screen, and re-placed on any scroll
// (including inside a dialog) or resize while open. `onToggle` runs on each
// open and close, e.g. to reset the panel's contents or mark a field touched.
export function useAnchoredPopover(
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  onToggle?: (open: boolean) => void
) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"below" | "above">("below");
  const notify = useEffectEvent((isOpen: boolean) => onToggle?.(isOpen));

  const place = useCallback(() => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const viewport = window.visualViewport;
    const vw = viewport?.width ?? window.innerWidth;
    const vh = viewport?.height ?? window.innerHeight;
    const { offsetWidth: w, offsetHeight: h } = panel;

    const spaceBelow = vh - anchor.bottom - GAP - EDGE;
    const spaceAbove = anchor.top - GAP - EDGE;
    const below = spaceBelow >= h || spaceBelow >= spaceAbove;

    const top = Math.min(Math.max(below ? anchor.bottom + GAP : anchor.top - GAP - h, EDGE), vh - h - EDGE);
    const left = Math.min(Math.max(anchor.left, EDGE), vw - w - EDGE);

    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
    setPlacement(below ? "below" : "above");
  }, [anchorRef, panelRef]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    // Before it's shown, start it just under the trigger, so its first frame
    // isn't wherever it last was; the layout effect then fits it to screen.
    const onBeforeToggle = (e: Event) => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if ((e as ToggleEvent).newState !== "open" || !anchor) return;
      panel.style.top = `${anchor.bottom + GAP}px`;
      panel.style.left = `${Math.max(anchor.left, EDGE)}px`;
    };
    const onToggleEvent = (e: Event) => {
      const isOpen = (e as ToggleEvent).newState === "open";
      setOpen(isOpen);
      notify(isOpen);
    };
    panel.addEventListener("beforetoggle", onBeforeToggle);
    panel.addEventListener("toggle", onToggleEvent);
    return () => {
      panel.removeEventListener("beforetoggle", onBeforeToggle);
      panel.removeEventListener("toggle", onToggleEvent);
    };
  }, [anchorRef, panelRef]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    // Capture, so scrolling any ancestor (a dialog's own scroll) counts.
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
    };
  }, [open, place]);

  return { open, placement };
}
