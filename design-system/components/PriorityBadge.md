# PriorityBadge

## Purpose

Compact priority indicator shared by `TaskItem` and report summaries.

## States

| Priority | Tone |
| --- | --- |
| `P0` | `danger` |
| `P1` | `warning` |
| `P2` | `primary` |
| `P3` | muted neutral |

## A11y

- Must remain readable at `xs`.
- Never rely on color alone when text label is present.

## Do

- Keep content to the literal priority label.

## Don't

- Do not turn this into a dropdown or multi-action control.
