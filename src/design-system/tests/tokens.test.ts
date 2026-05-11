import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deadlineStates, designTokens, projectColorTokens, priorityOrder } from "../tokens";

const tokensCssPath = resolve(process.cwd(), "src/styles/tokens.css");
const tokensCss = readFileSync(tokensCssPath, "utf8").toLowerCase();

describe("design tokens", () => {
  it("keeps the allowed semantic and project token counts stable", () => {
    expect(priorityOrder).toHaveLength(4);
    expect(deadlineStates).toHaveLength(4);
    expect(Object.keys(designTokens.color.semantic)).toEqual([
      "primary",
      "success",
      "warning",
      "danger"
    ]);
    expect(projectColorTokens).toHaveLength(8);
  });

  it("mirrors neutral and semantic color values into tokens.css", () => {
    const colorChecks = [
      ["--color-bg", designTokens.color.neutral.light.bg],
      ["--color-surface", designTokens.color.neutral.light.surface],
      ["--color-border", designTokens.color.neutral.light.border],
      ["--color-text", designTokens.color.neutral.light.text],
      ["--color-text-muted", designTokens.color.neutral.light.textMuted],
      ["--color-primary", designTokens.color.semantic.primary],
      ["--color-success", designTokens.color.semantic.success],
      ["--color-warning", designTokens.color.semantic.warning],
      ["--color-danger", designTokens.color.semantic.danger],
      ["--color-bg", designTokens.color.neutral.dark.bg],
      ["--color-surface", designTokens.color.neutral.dark.surface],
      ["--color-border", designTokens.color.neutral.dark.border],
      ["--color-text", designTokens.color.neutral.dark.text],
      ["--color-text-muted", designTokens.color.neutral.dark.textMuted]
    ];

    colorChecks.forEach(([cssVar, value]) => {
      expect(tokensCss).toContain(`${cssVar}: ${value.toLowerCase()}`);
    });
  });

  it("does not introduce component-private CSS variables", () => {
    expect(tokensCss).not.toMatch(/--task-item|--deadline-chip|--priority-badge|--check-in-dialog/);
  });
});
