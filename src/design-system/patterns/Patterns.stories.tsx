import type { Story, StoryDefault } from "@ladle/react";
import { CollapsedCapsule } from "./CollapsedCapsule";
import { DailyReport } from "./DailyReport";
import { FloatingPanel } from "./FloatingPanel";

export default {
  title: "Patterns"
} satisfies StoryDefault;

export const FloatingPanelPattern: Story = () => (
  <div className="bg-bg p-6" data-theme="light">
    <FloatingPanel
      projects={[
        { id: "console", name: "Console", color: "project-6" },
        { id: "desktop", name: "Desktop", color: "project-7" }
      ]}
      quickInputValue=""
      selectedProjectId="console"
      tasks={[
        {
          id: "1",
          title: "Keep the panel glanceable",
          checked: false,
          priority: "P0",
          deadlineState: "danger",
          deadlineLabel: "Today 18:00",
          projectColor: "project-7",
          shortcutHint: "1"
        },
        {
          id: "2",
          title: "Use only token-backed utilities",
          checked: false,
          priority: "P1",
          deadlineState: "warning",
          deadlineLabel: "In 2 days",
          projectColor: "project-6",
          depth: 1
        }
      ]}
      onOpenCheckIn={() => undefined}
      onProjectChange={() => undefined}
      onQuickInputChange={() => undefined}
      onQuickInputSubmit={() => undefined}
      onThemeToggle={() => undefined}
      onToggleTask={() => undefined}
    />
  </div>
);

export const ReportAndCapsule: Story = () => (
  <div className="space-y-6 bg-bg p-6" data-theme="light">
    <CollapsedCapsule
      hasUrgentDeadline
      projectColor="project-7"
      taskCount={4}
      onExpand={() => undefined}
    />
    <DailyReport
      dateLabel="April 29, 2026"
      sections={[
        {
          projectName: "Desktop",
          projectColor: "project-7",
          duration: "4h 10m",
          doneList: ["Token scaffolding", "TaskItem interactions"],
          todoList: ["Snapshot review", "Dialog polish"]
        }
      ]}
      supplement=""
      totalDuration="4h 10m"
      onExport={() => undefined}
      onSupplementChange={() => undefined}
    />
  </div>
);
