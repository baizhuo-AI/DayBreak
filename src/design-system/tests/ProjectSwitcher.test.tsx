import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectSwitcher, type ProjectOption } from "../components/ProjectSwitcher";

const projects: ProjectOption[] = [
  { id: "console", name: "Console", color: "project-6" },
  { id: "desktop", name: "Desktop", color: "project-7" }
];

function ProjectSwitcherHarness() {
  const [value, setValue] = useState("console");

  return (
    <ProjectSwitcher
      mode="dropdown"
      predictedProjectId="desktop"
      projects={projects}
      selectedProjectId={value}
      onChange={setValue}
    />
  );
}

describe("ProjectSwitcher", () => {
  it("is keyboard reachable and updates the selection", async () => {
    const user = userEvent.setup();

    render(<ProjectSwitcherHarness />);

    await user.tab();

    const select = screen.getByLabelText("Project");
    expect(select).toHaveFocus();

    await user.selectOptions(select, "desktop");
    expect(select).toHaveValue("desktop");
  });
});
