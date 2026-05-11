import type { Story, StoryDefault } from "@ladle/react";
import { CheckInDialog } from "./CheckInDialog";
import { DeadlineChip } from "./DeadlineChip";
import { IconButton } from "./IconButton";
import { BellIcon, PlusIcon } from "./icons";
import { PriorityBadge } from "./PriorityBadge";
import { ProjectSwitcher, type ProjectOption } from "./ProjectSwitcher";
import { QuickInput } from "./QuickInput";

const projects: ProjectOption[] = [
  { id: "console", name: "Console", color: "project-6" },
  { id: "desktop", name: "Desktop", color: "project-7" },
  { id: "infra", name: "Infra", color: "project-2" }
];

export default {
  title: "Components/P0 Core"
} satisfies StoryDefault;

export const BadgesAndButtons: Story = () => (
  <div className="space-y-4 bg-bg p-6" data-theme="light">
    <div className="flex flex-wrap gap-2">
      <PriorityBadge priority="P0" />
      <PriorityBadge priority="P1" />
      <PriorityBadge priority="P2" />
      <PriorityBadge priority="P3" />
    </div>
    <div className="flex flex-wrap gap-2">
      <DeadlineChip label="Safe" state="safe" />
      <DeadlineChip label="Warning" state="warning" />
      <DeadlineChip label="Danger" state="danger" />
      <DeadlineChip label="Overdue" state="overdue" />
    </div>
    <div className="flex flex-wrap gap-2">
      <IconButton ariaLabel="Open check-in" icon={<BellIcon />} shortcutHint="Alt+C" />
      <IconButton ariaLabel="Add task" icon={<PlusIcon />} shortcutHint="Enter" variant="primary" />
    </div>
  </div>
);

export const InputsAndSwitcher: Story = () => (
  <div className="w-[360px] space-y-4 bg-bg p-6" data-theme="light">
    <ProjectSwitcher
      mode="dropdown"
      predictedProjectId="desktop"
      projects={projects}
      selectedProjectId="console"
      onChange={() => undefined}
    />
    <ProjectSwitcher
      mode="inline"
      predictedProjectId="desktop"
      projects={projects}
      selectedProjectId="desktop"
      onChange={() => undefined}
    />
    <QuickInput mode="task" value="Draft a calm empty state" onChange={() => undefined} onSubmit={() => undefined} />
  </div>
);

export const CheckInPreview: Story = () => (
  <div className="min-h-[420px] bg-bg p-6" data-theme="light">
    <CheckInDialog
      defaultProjectId="console"
      open
      predictedProjectId="desktop"
      projects={projects}
      onSkip={() => undefined}
      onSnooze={() => undefined}
      onSubmit={() => undefined}
    />
  </div>
);
