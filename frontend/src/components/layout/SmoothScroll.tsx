import type { ReactNode } from "react";
import { ReactLenis } from "lenis/react";
import "lenis/dist/lenis.css";

const reducedMotion =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Eased wheel/trackpad scrolling for the whole app. Touch keeps native
// scrolling (Lenis's default), which is what phones already do well.
// `allowNestedScroll` lets inner scrollers like the notification list scroll
// on their own instead of Lenis hijacking the wheel.
export function SmoothScroll({ children }: { children: ReactNode }) {
  if (reducedMotion) return children;

  return (
    <ReactLenis root options={{ lerp: 0.1, anchors: true, allowNestedScroll: true }}>
      {children}
    </ReactLenis>
  );
}
