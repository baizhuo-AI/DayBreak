import type { PriorityLevel } from "../tokens";
import { cn } from "../utils/cn";

const toneByPriority: Record<PriorityLevel, string> = {
  P0: "border-danger bg-danger-soft text-danger",
  P1: "border-warning bg-warning-soft text-warning",
  P2: "border-primary bg-primary-soft text-primary",
  P3: "border-border bg-surface-muted text-muted"
};

export interface PriorityBadgeProps {
  priority: PriorityLevel;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-touch items-center rounded-full border px-2 py-0.5 text-xs font-semibold tracking-[0.02em]",
        toneByPriority[priority]
      )}
    >
      {priority}
    </span>
  );
}
