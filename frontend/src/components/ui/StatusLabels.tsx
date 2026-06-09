import type { FoodPost } from "../../types/api";

export const STATUS_LABELS: Record<FoodPost["status"], string> = {
  open:             "Open",
  pending_approval: "Pending",
  closed:           "Closed",
  expired:          "Expired",
  completed:        "Completed",
};