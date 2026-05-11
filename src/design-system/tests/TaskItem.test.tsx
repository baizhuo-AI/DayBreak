import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskItem } from "../components/TaskItem";

describe("TaskItem", () => {
  it("supports keyboard toggling via the checkbox row", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <TaskItem
        checked={false}
        deadlineLabel="Today 18:00"
        deadlineState="danger"
        priority="P0"
        projectColor="project-7"
        title="Keep the row keyboard-first"
        onToggle={onToggle}
      />
    );

    await user.tab();
    expect(screen.getByRole("checkbox")).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("checkbox"), { key: " ", code: "Space" });
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});
