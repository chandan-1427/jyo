export type ReportReason = "unsafe_food" | "misleading" | "money" | "harassment" | "other";

// Who a report or block is about: a post (and the person who shared it), or
// the person who asked for your food, by their request.
export type SafetyTarget = { kind: "post"; id: string } | { kind: "request"; id: string; name: string };

export const REPORT_REASONS: { value: ReportReason; label: string; forPosts?: boolean }[] = [
  { value: "unsafe_food", label: "Unsafe or spoiled food", forPosts: true },
  { value: "misleading", label: "Fake or misleading" },
  { value: "money", label: "Asked for or offered money" },
  { value: "harassment", label: "Harassment, or made me feel unsafe" },
  { value: "other", label: "Something else" },
];

export const targetPath = (target: SafetyTarget) =>
  target.kind === "post" ? `/posts/${target.id}` : `/requests/${target.id}`;
