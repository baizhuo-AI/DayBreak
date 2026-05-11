# QuickInput

## Purpose

Single-line input for fast task capture or check-in logging.

## States

| Mode | Values |
| --- | --- |
| Variant | `task`, `activity-log` |
| Interaction | `focus`, `submitting`, `disabled` |

## A11y

- Hidden label is required even when placeholder text exists.
- Submit button must stay reachable by keyboard.

## Keyboard

- `Enter`: submit when non-empty

## Do

- Keep placeholder instructional, not verbose.
- Preserve the current line during validation failure.

## Don't

- Do not attach large toolbars or formatting affordances.
