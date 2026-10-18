// An order slip with nothing written on it, under a magnifying glass: for a
// requests search or filter that finds nothing (a request is a little like
// an order). Same line style as the other illustrations: the green accent
// only on the lens's glint.
export function EmptySlipIllustration({ className }: { className?: string }) {
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
        {/* The slip, torn off along a zigzag at the bottom */}
        <path d="M44 22 a4 4 0 0 1 4 -4 H104 a4 4 0 0 1 4 4 V112 l-8 6 l-8 -6 l-8 6 l-8 -6 l-8 6 l-8 -6 l-8 6 l-8 -6 Z" />
        {/* A heading, then empty lines where items would be */}
        <path d="M56 36 H86" />
        <g className="stroke-fg-subtle/40" strokeDasharray="3 5">
          <path d="M56 52 H96" />
          <path d="M56 64 H96" />
          <path d="M56 76 H84" />
        </g>
        {/* Magnifying glass over the slip's corner */}
        <circle cx="112" cy="92" r="16" />
        <path d="M123.5 103.5 L136 116" strokeWidth={4} />
      </g>
      {/* The lens's glint */}
      <path d="M103 87 a10 10 0 0 1 7 -5" className="stroke-leaf/80" />
    </svg>
  );
}
