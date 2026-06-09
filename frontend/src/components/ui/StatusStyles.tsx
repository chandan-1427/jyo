import type { FoodPost } from "../../types/api";

export const STATUS_STYLES: Record<FoodPost["status"], string> = {
  open:             "bg-emerald-50 text-emerald-600 border-emerald-100",
  pending_approval: "bg-amber-50 text-amber-600 border-amber-100",
  closed:           "bg-neutral-100 text-neutral-500 border-neutral-200",
  expired:          "bg-red-50 text-red-400 border-red-100",
  completed:        "bg-blue-50 text-blue-600 border-blue-100",
};