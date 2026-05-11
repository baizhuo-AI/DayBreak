import type { DeadlineState, PriorityLevel, ProjectColorToken } from "../tokens";
import { cn } from "../utils/cn";
import { projectColorClasses } from "../utils/projectColor";
import { DeadlineChip } from "./DeadlineChip";
import { PriorityBadge } from "./PriorityBadge";

const depthClasses = {
  0: "pl-0",
  1: "pl-4",
  2: "pl-8"
} as const;

export interface TaskItemProps {
  title: string;
  checked: boolean;
  priority: PriorityLevel;
  deadlineState: DeadlineState;
  deadlineLabel: string;
  projectColor: ProjectColorToken;
  depth?: 0 | 1 | 2;
  isDragging?: boolean;
  shortcutHint?: string;
  onToggle?: (nextChecked: boolean) => void;
}

export function TaskItem({
  title,
  checked,
  priority,
  deadlineState,
  deadlineLabel,
  projectColor,
  depth = 0,
  isDragging = false,
  shortcutHint,
  onToggle
}: TaskItemProps) {
  const isOverdue = deadlineState === "overdue";
  const nextChecked = !checked;

  function handleToggle() {
    onToggle?.(nextChecked);
  }

  return (
    <div className={cn("w-full", depthClasses[depth])}>
      <button
        aria-checked={checked}
        className={cn(
          "focus-ring group flex w-full items-start gap-3 rounded-lg border bg-surface px-3 py-3 text-left transition-all duration-base ease-calm hover:border-primary hover:bg-surface-muted",
          checked ? "border-border text-muted" : "border-border text-text",
          isOverdue && "border-danger",
          isDragging && "border-primary shadow-popover ring-2 ring-focus"
        )}
        role="checkbox"
        type="button"
        onClick={handleToggle}
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            handleToggle();
          }
        }}
      >
        <span
          className={cn(
            "mt-1 h-6 w-1 shrink-0 rounded-full",
            projectColorClasses[projectColor]
          )}
        />
        <span
          className={cn(
            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
            checked
              ? "border-success bg-success text-surface"
              : "border-border bg-surface text-transparent group-hover:border-primary"
          )}
        >
          ✓
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block text-sm font-medium", checked && "line-through")}>
            {title}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-2">
            <PriorityBadge priority={priority} />
            <DeadlineChip label={deadlineLabel} state={deadlineState} />
          </span>
        </span>
        {shortcutHint ? (
          <span className="shrink-0 text-xs font-medium text-muted">{shortcutHint}</span>
        ) : null}
      </button>
    </div>
  );
}
