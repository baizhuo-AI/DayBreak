import type { ProjectColorToken } from "../tokens";
import { cn } from "../utils/cn";
import { projectColorClasses } from "../utils/projectColor";

export interface CollapsedCapsuleProps {
  projectColor: ProjectColorToken;
  taskCount: number;
  hasUrgentDeadline?: boolean;
  onExpand: () => void;
}

export function CollapsedCapsule({
  projectColor,
  taskCount,
  hasUrgentDeadline = false,
  onExpand
}: CollapsedCapsuleProps) {
  return (
    <button
      className="surface-frame focus-ring flex h-panel w-capsule flex-col items-center justify-between rounded-full px-2 py-3"
      type="button"
      onClick={onExpand}
    >
      <span className={cn("h-14 w-2 rounded-full", projectColorClasses[projectColor])} />
      <span className="rounded-full border border-border bg-surface-muted px-2 py-1 text-sm font-semibold text-text">
        {taskCount}
      </span>
      <span
        aria-label={hasUrgentDeadline ? "Urgent deadline pending" : "No urgent deadline"}
        className={cn(
          "h-3 w-3 rounded-full border border-border",
          hasUrgentDeadline ? "border-danger bg-danger" : "bg-surface-muted"
        )}
      />
    </button>
  );
}
