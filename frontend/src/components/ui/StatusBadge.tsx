import type { FoodPost } from "../../types/api";
import { STATUS_STYLES } from "./StatusStyles";
import { STATUS_LABELS } from "./StatusLabels";

interface StatusBadgeProps {
  status: FoodPost["status"];
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium border shrink-0 ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}