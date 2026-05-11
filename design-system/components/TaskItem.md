# TaskItem

## Purpose

Task row for the floating panel. It carries project identity, completion state, priority, deadline urgency, and an optional shortcut hint without blowing up vertical density.

## States

| Dimension | Values |
| --- | --- |
| Variant | `default`, `nested`, `overdue` |
| Interaction | `hover`, `focus-visible`, `checked`, `dragging` |
| Density | `depth: 0`, `1`, `2` |

## A11y

- Keyboard reachable as a single checkbox row.
- Focus ring must remain visible in both themes.
- Completion state is exposed through `aria-checked`.

## Keyboard

- `Tab`: move to row
- `Space` / `Enter`: toggle completion

## Do

- Keep title to 1-2 lines.
- Use project accent only on the leading strip.
- Show deadline and priority together.

## Don't

- Do not add avatars, timestamps, or secondary metadata here.
- Do not encode priority with project colors.

## Snapshot References

- Ladle: `Components/TaskItem -> States`
- Ladle: `Components/TaskItem -> DarkMode`
