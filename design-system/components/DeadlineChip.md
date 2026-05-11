# DeadlineChip

## Purpose

Urgency chip for due dates. It translates raw deadline computation into one of four stable semantic states.

## States

| State | Meaning |
| --- | --- |
| `safe` | no near-term urgency |
| `warning` | deadline within 3 days |
| `danger` | deadline within 24 hours |
| `overdue` | deadline missed |

## A11y

- Text label must include human-readable time context.
- Overdue contrast must pass on dark and light surfaces.

## Do

- Use it anywhere deadline urgency appears.

## Don't

- Do not invent extra deadline colors like orange-red or pink.
