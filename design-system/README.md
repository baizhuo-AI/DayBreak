# Todo Floating Panel Design System

This folder is the product-facing contract for the floating panel UI. Implementation lives in `src/design-system/`; this directory explains what is allowed, what is stable, and what will break consumers.

## Structure

- `tokens/`: canonical color, type, spacing, and motion guidance
- `components/`: reusable building blocks with state tables, accessibility notes, and usage rules
- `patterns/`: scene-level compositions for the panel, check-in, report, and collapsed capsule
- `CHANGELOG.md`: migration notes for token or component changes
- `dependency-map.md`: Mermaid graph for token-to-component blast radius

## Rules

1. CSS variables are the runtime source of truth.
2. Components may not introduce raw hex colors, raw box shadows, or raw spacing values.
3. Light and dark behavior must ship together.
4. Keyboard behavior is not optional documentation; it is part of the component contract.
