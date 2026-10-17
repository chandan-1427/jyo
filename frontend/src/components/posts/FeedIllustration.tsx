// A faint line drawing in the bottom-right corner of the feed: someone with
// their chin on their hand, thinking about a bowl of food. Fixed to the
// viewport behind the cards; on phones it sits above the tab bar.
export function FeedIllustration() {
  return (
    <svg
      aria-hidden="true"
      viewBox="10 60 230 220"
      className="pointer-events-none fixed right-4 bottom-[calc(4rem+env(safe-area-inset-bottom))] -z-10 w-28 opacity-40 sm:right-10 sm:bottom-0 sm:w-40"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3"
    >
      <g stroke="var(--color-fg-muted)">
        {/* Thought bubbles rising to the cloud */}
        <circle cx="145" cy="155" r="3.5" />
        <circle cx="134" cy="141" r="6" />
        <path transform="translate(14 30)" d="M40 96 C 20 96 18 68 40 66 C 40 44 68 38 80 52 C 90 34 120 38 122 60 C 144 62 146 92 124 96 Z" />

        {/* Head, hair and face, eyes turned up towards the thought */}
        <circle cx="170" cy="190" r="30" />
        <path d="M141 184 C 141 162 158 152 172 154 C 187 156 200 167 200 186" />
        <path d="M157 189 q4 -4 8 0" />
        <path d="M175 189 q4 -4 8 0" />
        <path d="M165 205 q5 2 9 -1" />

        {/* Neck and shoulders, cut off by the bottom edge */}
        <path d="M162 219 L 162 230" />
        <path d="M178 219 L 178 230" />
        <path d="M118 280 C 120 246 142 230 170 230 C 198 230 220 246 222 280" />

        {/* Arm bent up, hand under the chin */}
        <path d="M208 262 C 216 246 208 234 195 230" />
        <circle cx="187" cy="228" r="8" />
      </g>

      <g stroke="var(--color-leaf)" transform="translate(14 30)">
        {/* A bowl with steam, inside the thought cloud */}
        <path d="M58 82 L 104 82" />
        <path d="M61 82 C 63 99 101 99 103 82" />
        <path d="M70 74 c -4 -5 4 -9 0 -15" />
        <path d="M81 74 c -4 -5 4 -9 0 -15" />
        <path d="M92 74 c -4 -5 4 -9 0 -15" />
      </g>
    </svg>
  );
}
