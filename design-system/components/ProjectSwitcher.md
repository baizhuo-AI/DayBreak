# ProjectSwitcher

## Purpose

Project selection control used in the panel header and check-in dialog.

## States

| Variant | Values |
| --- | --- |
| Presentation | `dropdown`, `inline` |
| Interaction | `hover`, `focus-visible`, `open` |
| Prediction | with or without `predictedProjectId` |

## A11y

- Dropdown mode uses a labeled native `select`.
- Inline mode exposes each option as a button with clear selected state.

## Keyboard

- Dropdown mode follows native select behavior.
- Inline mode uses tab navigation between buttons.

## Do

- Surface predicted project as a hint, not an auto-commit.

## Don't

- Do not hide the current selection behind an icon-only control.
