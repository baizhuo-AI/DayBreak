# Check-in Pattern

## Composition

`ProjectSwitcher -> QuickInput -> ActionRow(Skip, Snooze, Submit)`

## Timing

- Entry focus target: `QuickInput`
- Focus handoff delay: `80ms`
- Reduced motion: durations collapse to `1ms`

## Rules

- Escape snoozes for 10 minutes.
- Submit failure stays inline and preserves typed content.
- Predicted project may preselect, but it must remain user-overridable.
