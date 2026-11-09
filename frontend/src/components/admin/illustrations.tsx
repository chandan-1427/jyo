import type { ReactNode } from "react";

// Line drawings for the admin portal's empty states, in the same style as
// the app's own (components/posts/*Illustration.tsx): thin subtle strokes,
// with the green accent on one detail only.
function Drawing({ children, className }: { children: ReactNode; className?: string }) {
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
      {children}
    </svg>
  );
}

// A flag on its pole, with a tick beside it: no open reports.
export function ReportsClearIllustration({ className }: { className?: string }) {
  return (
    <Drawing className={className}>
      <g className="stroke-fg-subtle">
        <path d="M60 24 V118" />
        <path d="M46 118 H74" />
        <path d="M60 28 H106 L96 42 L106 56 H60" />
      </g>
      <g className="stroke-leaf/80">
        <circle cx="108" cy="96" r="16" />
        <path d="M100.5 96 L105.5 101 L115.5 91" />
      </g>
    </Drawing>
  );
}

// An open tray with a sheet on its way in: nothing resolved yet.
export function TrayIllustration({ className }: { className?: string }) {
  return (
    <Drawing className={className}>
      <g className="stroke-fg-subtle">
        <path d="M36 74 H124 V112 a4 4 0 0 1 -4 4 H40 a4 4 0 0 1 -4 -4 Z" />
        <path d="M36 74 L48 52 H112 L124 74" />
        <path d="M62 74 V80 a4 4 0 0 0 4 4 H94 a4 4 0 0 0 4 -4 V74" />
        <path d="M66 46 V22 H94 V46" className="stroke-fg-subtle/40" strokeDasharray="3 5" />
      </g>
      <path d="M80 28 V42 M74 36 L80 42 L86 36" className="stroke-leaf/80" />
    </Drawing>
  );
}

// One person, a second drawn in dashes, a magnifying glass over them: a
// search that finds nobody.
export function PeopleSearchIllustration({ className }: { className?: string }) {
  return (
    <Drawing className={className}>
      <g className="stroke-fg-subtle">
        <circle cx="56" cy="50" r="12" />
        <path d="M34 96 a22 22 0 0 1 44 0" />
        <g className="stroke-fg-subtle/40" strokeDasharray="3 5">
          <circle cx="94" cy="50" r="12" />
          <path d="M72 96 a22 22 0 0 1 44 0" />
        </g>
        <path d="M28 108 H92" />
        <circle cx="114" cy="96" r="16" />
        <path d="M125.5 107.5 L138 120" strokeWidth={4} />
      </g>
      <path d="M105 91 a10 10 0 0 1 7 -5" className="stroke-leaf/80" />
    </Drawing>
  );
}

// An open padlock: nobody is suspended.
export function OpenLockIllustration({ className }: { className?: string }) {
  return (
    <Drawing className={className}>
      <g className="stroke-fg-subtle">
        <rect x="50" y="66" width="60" height="48" rx="10" />
        <path d="M62 66 V44 a16 16 0 0 1 32 0 V48" />
        <path d="M38 124 H122" className="stroke-fg-subtle/40" strokeDasharray="3 5" />
      </g>
      <g className="stroke-leaf/80">
        <circle cx="80" cy="86" r="5" />
        <path d="M80 91 V100" />
      </g>
    </Drawing>
  );
}

// An empty chart whose flat line ends in a sprout: a range with no activity.
export function QuietChartIllustration({ className }: { className?: string }) {
  return (
    <Drawing className={className}>
      <g className="stroke-fg-subtle">
        <path d="M30 22 V108 H134" />
        <g className="stroke-fg-subtle/40" strokeDasharray="3 5">
          <path d="M38 44 H128" />
          <path d="M38 66 H128" />
          <path d="M38 88 H128" />
        </g>
        <path d="M38 104 H116" />
      </g>
      <g className="stroke-leaf/80">
        <path d="M120 104 V88" />
        <path d="M120 94 c0 -9 6 -14 13 -14 c0 9 -6 14 -13 14 Z" />
        <path d="M120 98 c0 -6 -4 -9 -9 -9 c0 6 4 9 9 9 Z" />
      </g>
    </Drawing>
  );
}
