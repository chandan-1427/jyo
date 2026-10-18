// A map pin with a steaming bowl inside, and a dotted trail leading to it:
// food is out there nearby, go and find it. For someone who hasn't asked for
// any food yet, above a "Find food" button that carries the same pin. Same
// line style as the other illustrations: the green accent only on the steam.
export function FindFoodIllustration({ className }: { className?: string }) {
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
        {/* Dotted trail winding up to the pin */}
        <path d="M16 128 C38 128 42 112 60 116 S78 122 84 121" strokeDasharray="2 6" />
        {/* The pin, and its shadow on the ground */}
        <path d="M92 114 C92 114 64 84 64 58 a28 28 0 0 1 56 0 C120 84 92 114 92 114 Z" />
        <ellipse cx="92" cy="121" rx="12" ry="3" className="stroke-fg-subtle/50" />
        {/* A bowl in the pin's head */}
        <path d="M76 60 H108" />
        <path d="M78 60 a14 12 0 0 0 28 0" />
      </g>
      {/* Steam rising from the bowl */}
      <g className="stroke-leaf/80">
        <path d="M87 52 c-3 -3 3 -6 0 -11" />
        <path d="M97 52 c-3 -3 3 -6 0 -11" />
      </g>
    </svg>
  );
}
