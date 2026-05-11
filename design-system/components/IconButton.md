# IconButton

## Purpose

Tiny utility button for the panel title bar and dialog actions.

## States

| Variant | Values |
| --- | --- |
| Style | `ghost`, `primary` |
| Interaction | `hover`, `active`, `disabled`, `focus-visible` |

## A11y

- `aria-label` is mandatory.
- Touch target must stay at or above `24x24`.

## Do

- Use a visible shortcut hint when the action is part of the keyboard-first flow.

## Don't

- Do not stack more than three icon buttons in the panel header.
