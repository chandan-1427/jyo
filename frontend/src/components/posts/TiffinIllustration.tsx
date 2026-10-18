// A tiffin carrier (the stacked lunch box) with steam rising: food packed up
// to be passed on. Line art in the same quiet style as FeedIllustration: the
// box in muted strokes, with the green accent only on the steam.
export function TiffinIllustration({ className }: { className?: string }) {
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
        {/* Carrying handle */}
        <path d="M66 34 V26 a14 14 0 0 1 28 0 V34" />
        {/* Lid */}
        <rect x="52" y="34" width="56" height="9" rx="4.5" />
        {/* Three stacked tiers, each with the lip of its rim */}
        <rect x="48" y="45" width="64" height="24" rx="6" />
        <path d="M48 51 H112" />
        <rect x="48" y="71" width="64" height="24" rx="6" />
        <path d="M48 77 H112" />
        <rect x="48" y="97" width="64" height="24" rx="6" />
        <path d="M48 103 H112" />
        {/* Side rods that clip the tiers together */}
        <path d="M43 40 V116 M117 40 V116" />
        <path d="M43 57 H48 M43 83 H48 M43 109 H48 M112 57 H117 M112 83 H117 M112 109 H117" />
        {/* Ground line */}
        <path d="M34 129 H126" className="stroke-fg-subtle/50" />
      </g>
      {/* Steam, rising either side of the handle */}
      <g className="stroke-leaf/80">
        <path d="M54 28 c-5 -5 5 -9 0 -15 c-3 -3 -2 -6 0 -8" />
        <path d="M106 28 c5 -5 -5 -9 0 -15 c3 -3 2 -6 0 -8" />
      </g>
    </svg>
  );
}
