import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckInDialog } from "../components/CheckInDialog";

describe("CheckInDialog", () => {
  it("autofocuses after 80ms and snoozes on Escape", async () => {
    vi.useFakeTimers();
    const onSnooze = vi.fn();

    render(
      <CheckInDialog
        defaultProjectId="console"
        open
        predictedProjectId="desktop"
        projects={[
          { id: "console", name: "Console", color: "project-6" },
          { id: "desktop", name: "Desktop", color: "project-7" }
        ]}
        onSkip={() => undefined}
        onSnooze={onSnooze}
        onSubmit={() => undefined}
      />
    );

    act(() => {
      vi.advanceTimersByTime(80);
    });
    expect(screen.getByLabelText("Quick activity log")).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onSnooze).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("submits the note with Enter", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(
      <CheckInDialog
        defaultProjectId="console"
        open
        predictedProjectId="desktop"
        projects={[
          { id: "console", name: "Console", color: "project-6" },
          { id: "desktop", name: "Desktop", color: "project-7" }
        ]}
        onSkip={() => undefined}
        onSnooze={() => undefined}
        onSubmit={onSubmit}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Quick activity log")).toHaveFocus());

    await user.type(screen.getByLabelText("Quick activity log"), "Shipped tokens{Enter}");

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        note: "Shipped tokens",
        projectId: "desktop"
      })
    );
  });
});
