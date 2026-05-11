# CheckInDialog

## Purpose

Short interruption for structured progress capture. It should feel like a quiet tap on the shoulder, not a mode switch.

## States

| Variant | Values |
| --- | --- |
| Presentation | `normal`, `quiet` |
| Async | `idle`, `submitting` |

## A11y

- Focus moves to the input after the entry motion.
- Escape behavior is explicit and safe: snooze, not dismiss-and-lose-state.
- Validation errors render inline near the input.

## Keyboard

- `Esc`: snooze 10 minutes
- `Enter`: submit

## Do

- Keep actions limited to `Skip`, `Snooze`, `Submit`.

## Don't

- Do not show toast confirmations that steal focus from the dialog flow.

## Snapshot References

- Ladle: `Components/P0 Core -> CheckInPreview`
