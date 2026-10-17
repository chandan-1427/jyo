import { useId } from "react";

// Decorative backdrop for the profile header: a soft green wash, two large
// circles and two thin arcs, gathered at the right so the left side stays
// calm behind the photo and name. Drawn as SVG so it stays sharp at any
// size; the circles are radial gradients (not blurred shapes, which band),
// and a mask fades everything out towards the left edge.
export function BannerPattern() {
  const id = useId().replace(/:/g, "");

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
      viewBox="0 0 1200 260"
      preserveAspectRatio="xMaxYMid slice"
    >
      <defs>
        <radialGradient id={`${id}-a`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="oklch(0.42 0.09 158)" stopOpacity="0.55" />
          <stop offset="70%" stopColor="oklch(0.32 0.07 158)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="oklch(0.32 0.07 158)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-b`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="oklch(0.46 0.1 158)" stopOpacity="0.5" />
          <stop offset="75%" stopColor="oklch(0.34 0.07 158)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="oklch(0.34 0.07 158)" stopOpacity="0" />
        </radialGradient>
        {/* Fades the whole pattern out towards the left, so it never sits
            behind the text. */}
        <linearGradient id={`${id}-fade`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0.35" stopColor="white" stopOpacity="0" />
          <stop offset="0.75" stopColor="white" stopOpacity="1" />
        </linearGradient>
        <mask id={`${id}-mask`}>
          <rect width="1200" height="260" fill={`url(#${id}-fade)`} />
        </mask>
      </defs>

      <g mask={`url(#${id}-mask)`}>
        <circle cx="850" cy="40" r="210" fill={`url(#${id}-a)`} />
        <circle cx="1130" cy="290" r="170" fill={`url(#${id}-b)`} />
        <path d="M640 290 C 760 200, 860 70, 1000 -10" fill="none" stroke="var(--color-leaf)" strokeOpacity="0.35" strokeWidth="1.5" />
        <path d="M720 290 C 860 150, 1020 40, 1220 20" fill="none" stroke="var(--color-leaf)" strokeOpacity="0.3" strokeWidth="1.5" />
      </g>
    </svg>
  );
}
