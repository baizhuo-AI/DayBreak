import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickInput } from "../components/QuickInput";

function QuickInputHarness({ onSubmit }: { onSubmit: (value: string) => void }) {
  const [value, setValue] = useState("");

  return <QuickInput mode="task" value={value} onChange={setValue} onSubmit={onSubmit} />;
}

describe("QuickInput", () => {
  it("submits with Enter and keeps the button disabled when empty", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<QuickInputHarness onSubmit={onSubmit} />);

    const input = screen.getByLabelText("Quick add task");
    const button = screen.getByRole("button", { name: "Add" });

    expect(button).toBeDisabled();

    await user.type(input, "Draft release note");
    expect(button).toBeEnabled();

    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("Draft release note");
  });
});
