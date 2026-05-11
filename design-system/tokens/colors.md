# Colors

## Canonical Palette

Neutral tokens define the panel shell. Semantic tokens define action and urgency. Project colors are user-selected accents only.

| Token | Light | Dark | Usage |
| --- | --- | --- | --- |
| `bg` | `#FAFAF9` | `#1A1A1A` | Window background |
| `surface` | `#FFFFFF` | `#242424` | Cards, rows, dialogs |
| `border` | `#E7E5E4` | `#2E2E2E` | Separators and quiet outlines |
| `text` | `#1C1917` | `#F5F5F4` | Primary text |
| `textMuted` | `#78716C` | `#A8A29E` | Labels, timestamps, hints |
| `primary` | `#3B82F6` | same | Primary actions and links |
| `success` | `#10B981` | same | Completed work |
| `warning` | `#F59E0B` | same | Deadline in 3 days or less |
| `danger` | `#EF4444` | same | P0, overdue, 24h deadline |

## Project Palette

`project-1` to `project-8` map to the fixed palette in `src/design-system/tokens.ts`. Components may use them only as project identity accents, not as semantic state.

## Rules

- DDL yellow and red always resolve to `warning` and `danger`.
- Components may derive soft fills from semantic tokens, but may not introduce independent hue tokens.
- Dark mode overrides only the neutral layer; semantic urgency colors remain stable across themes.
