import type { DeadlineState, PriorityLevel, ProjectColorToken } from "../tokens";
import { BellIcon, PlusIcon, SunIcon } from "../components/icons";
import { IconButton } from "../components/IconButton";
import type { ProjectOption } from "../components/ProjectSwitcher";
import { ProjectSwitcher } from "../components/ProjectSwitcher";
import { QuickInput } from "../components/QuickInput";
import { TaskItem } from "../components/TaskItem";

export interface FloatingTask {
  id: string;
  title: string;
  checked: boolean;
  priority: PriorityLevel;
  deadlineState: DeadlineState;
  deadlineLabel: string;
  projectColor: ProjectColorToken;
  depth?: 0 | 1 | 2;
  isDragging?: boolean;
  shortcutHint?: string;
}

export interface FloatingPanelProps {
  projects: ProjectOption[];
  selectedProjectId: string;
  tasks: FloatingTask[];
  quickInputValue: string;
  onProjectChange: (projectId: string) => void;
  onQuickInputChange: (value: string) => void;
  onQuickInputSubmit: (value: string) => void | Promise<void>;
  onToggleTask: (taskId: string) => void;
  onOpenCheckIn: () => void;
  onThemeToggle: () => void;
}

export function FloatingPanel({
  projects,
  selectedProjectId,
  tasks,
  quickInputValue,
  onProjectChange,
  onQuickInputChange,
  onQuickInputSubmit,
  onToggleTask,
  onOpenCheckIn,
  onThemeToggle
}: FloatingPanelProps) {
  return (
    <section className="surface-frame flex h-panel w-panel min-w-panel flex-col overflow-hidden rounded-lg">
      <header className="flex items-start justify-between gap-3 border-b border-border px-3 py-3">
        <div className="min-w-0 flex-1">
          <ProjectSwitcher
            mode="dropdown"
            projects={projects}
            selectedProjectId={selectedProjectId}
            onChange={onProjectChange}
          />
        </div>
        <div className="flex items-center gap-2">
          <IconButton ariaLabel="Open check-in" icon={<BellIcon />} shortcutHint="⌥C" onClick={onOpenCheckIn} />
          <IconButton ariaLabel="Toggle theme" icon={<SunIcon />} shortcutHint="⌥T" onClick={onThemeToggle} />
          <IconButton ariaLabel="Add task" icon={<PlusIcon />} variant="primary" />
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            checked={task.checked}
            deadlineLabel={task.deadlineLabel}
            deadlineState={task.deadlineState}
            depth={task.depth}
            isDragging={task.isDragging}
            priority={task.priority}
            projectColor={task.projectColor}
            shortcutHint={task.shortcutHint}
            title={task.title}
            onToggle={() => onToggleTask(task.id)}
          />
        ))}
      </div>

      <footer className="border-t border-border px-3 py-3">
        <QuickInput
          mode="task"
          value={quickInputValue}
          onChange={onQuickInputChange}
          onSubmit={onQuickInputSubmit}
        />
      </footer>
    </section>
  );
}
