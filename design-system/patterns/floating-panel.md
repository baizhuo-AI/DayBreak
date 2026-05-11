# Floating Panel

## Composition

`TitleBar(ProjectSwitcher + IconButton x 3) -> TaskList(TaskItem x N) -> ActionBar(QuickInput)`

## Rules

- Hard-size the panel to `240x400`.
- Header and footer are fixed; only the task list scrolls.
- Keep the default viewport useful with 4-6 tasks visible.

## Keyboard

- Primary workflow order: project switcher -> title-bar actions -> task list -> quick input

## Snapshot References

- Ladle: `Patterns -> FloatingPanelPattern`
