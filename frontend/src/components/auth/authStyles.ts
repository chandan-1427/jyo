// `authInputStyles` used to live here: five !important-flagged colour classes
// (background, border, text, placeholder, and a focus border). They are spelled
// out descriptively rather than quoted verbatim on purpose — Tailwind v4 scans
// COMMENTS as well as code, so pasting real class names into a comment silently
// re-emits dead CSS for classes nothing uses any more.
//
// Removed rather than retuned. All five classes were a verbatim restatement of
// Input.tsx's own defaults, so the `!important` bought nothing — but it DID mean
// anything later added to Input's base styles in the same utility group would be
// silently dead on the four auth pages only. A nasty invisible failure mode for
// zero benefit. Auth inputs now inherit Input/PasswordInput like every other
// input in the app, which makes them consistent by construction.

export const AUTH_BENEFITS = [
  "Free to join, always",
  "No payments or delivery, ever",
  "Verified members only in your area",
];