// Where to go after logging in: the page a logged-out visitor asked for, if
// it's a path within the app. Anything else (another site, "//evil.example")
// goes to the feed, so a crafted link can't send people off Jyo.
export function returnPath(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === "string" && from.startsWith("/") && !from.startsWith("//") ? from : "/feed";
}
