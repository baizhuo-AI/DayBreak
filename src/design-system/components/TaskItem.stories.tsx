import type { Story, StoryDefault } from "@ladle/react";
import { TaskItem } from "./TaskItem";

export default {
  title: "Components/TaskItem"
} satisfies StoryDefault;

export const States: Story = () => (
  <div className="w-panel space-y-2 bg-bg p-4" data-theme="light">
    <TaskItem
      checked={false}
      deadlineLabel="Today 18:00"
      deadlineState="danger"
      priority="P0"
      projectColor="project-7"
      shortcutHint="1"
      title="Ship token baseline to the floating panel"
    />
    <TaskItem
      checked={false}
      deadlineLabel="Tomorrow"
      deadlineState="warning"
      depth={1}
      priority="P1"
      projectColor="project-6"
      shortcutHint="2"
      title="Write light and dark snapshots"
    />
    <TaskItem
      checked={true}
      deadlineLabel="No rush"
      deadlineState="safe"
      depth={2}
      priority="P3"
      projectColor="project-2"
      title="Archive resolved tasks"
    />
    <TaskItem
      checked={false}
      deadlineLabel="Overdue"
      deadlineState="overdue"
      isDragging
      priority="P0"
      projectColor="project-1"
      title="Escalate overdue DDL"
    />
  </div>
);

export const DarkMode: Story = () => (
  <div className="w-panel bg-bg p-4" data-theme="dark">
    <TaskItem
      checked={false}
      deadlineLabel="Today 18:00"
      deadlineState="danger"
      priority="P0"
      projectColor="project-7"
      title="Verify density inside the 240x400 frame"
    />
  </div>
);
