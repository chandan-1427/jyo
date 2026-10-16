import { useEffect } from "react";

const IDLE_AFTER_MS = 1000;
// How close to the right edge the pointer has to be to reveal the thumb.
const EDGE_PX = 24;

// Drives `html[data-scrollbar]` (see index.css): the thumb fades out while the
// page sits still and comes back while scrolling, or when the pointer heads
// for it so it's there to grab.
export function ScrollbarAutoHide() {
  useEffect(() => {
    const root = document.documentElement;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let nearEdge = false;
    let dragging = false;

    const show = () => {
      clearTimeout(timer);
      root.dataset.scrollbar = "active";
    };
    const hideSoon = () => {
      clearTimeout(timer);
      if (nearEdge || dragging) return;
      timer = setTimeout(() => {
        root.dataset.scrollbar = "idle";
      }, IDLE_AFTER_MS);
    };

    const onScroll = () => {
      show();
      hideSoon();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      // clientWidth excludes the scrollbar, so this measures from its inner edge.
      const near = e.clientX >= root.clientWidth - EDGE_PX;
      if (near === nearEdge) return;
      nearEdge = near;
      if (near) show();
      else hideSoon();
    };
    const onPointerDown = () => {
      if (nearEdge) dragging = true;
    };
    const onPointerUp = () => {
      dragging = false;
      hideSoon();
    };
    const onLeave = () => {
      nearEdge = false;
      hideSoon();
    };

    root.dataset.scrollbar = "idle";
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    document.addEventListener("mouseleave", onLeave);

    return () => {
      clearTimeout(timer);
      delete root.dataset.scrollbar;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return null;
}
