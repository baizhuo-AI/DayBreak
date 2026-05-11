import type { DeadlineState } from "../tokens";
import { cn } from "../utils/cn";

const toneByState: Record<DeadlineState, string> = {
  safe: "border-success bg-success-soft text-success",
  warning: "border-warning bg-warning-soft text-warning",
  danger: "border-danger bg-danger-soft text-danger",
  overdue: "border-danger bg-danger text-surface"
};

export interface DeadlineChipProps {
  state: DeadlineState;
  label: string;
}

export function DeadlineChip({ state, label }: DeadlineChipProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-touch items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        toneByState[state]
      )}
    >
      {label}
    </span>
  );
}
