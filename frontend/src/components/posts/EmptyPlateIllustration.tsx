// An empty plate with a magnifying glass over it: we looked, and there's
// nothing there. For a search with no results. Same line style as the other
// illustrations: muted strokes, the green accent only on the lens's glint.
export function EmptyPlateIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 140"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <g className="stroke-fg-subtle">
        {/* Plate, seen from a low angle: rim and well */}
        <ellipse cx="68" cy="102" rx="46" ry="14" />
        <ellipse cx="68" cy="100" rx="29" ry="8" />
        {/* Fork and spoon either side */}
        <path d="M12 86 V118 M8 86 V94 a4 4 0 0 0 8 0 V86" />
        <path d="M124 104 V118" />
        <ellipse cx="124" cy="96" rx="4" ry="7" />
        {/* Magnifying glass, hovering over the plate */}
        <circle cx="96" cy="48" r="19" />
        <path d="M109.5 61.5 L124 76" strokeWidth={4} />
        {/* Ground line */}
        <path d="M26 128 H112" className="stroke-fg-subtle/50" />
      </g>
      {/* The lens's glint */}
      <path d="M85 41 a12 12 0 0 1 9 -5" className="stroke-leaf/80" />
    </svg>
  );
}
