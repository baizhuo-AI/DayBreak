import { useId } from "react";
import type { FormEvent, RefObject } from "react";
import { cn } from "../utils/cn";

export interface QuickInputProps {
  mode: "task" | "activity-log";
  value: string;
  isSubmitting?: boolean;
  inputRef?: RefObject<HTMLInputElement>;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void | Promise<void>;
}

export function QuickInput({
  mode,
  value,
  isSubmitting = false,
  inputRef,
  onChange,
  onSubmit
}: QuickInputProps) {
  const inputId = useId();
  const label = mode === "task" ? "Quick add task" : "Quick activity log";
  const placeholder =
    mode === "task" ? "Add a task…  ⌘K" : "What did you do…  ⏎ to submit";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextValue = value.trim();

    if (!nextValue || isSubmitting) {
      return;
    }

    await onSubmit(nextValue);
  }

  return (
    <form className="flex items-center gap-2" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        ref={inputRef}
        className={cn(
          "focus-ring h-touch w-full rounded-md border border-border bg-surface px-3 text-sm text-text placeholder:text-muted",
          isSubmitting && "cursor-progress opacity-70"
        )}
        disabled={isSubmitting}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        className="focus-ring min-h-touch min-w-touch rounded-md border border-primary bg-primary px-3 text-sm font-medium text-surface transition-colors duration-fast ease-calm hover:bg-primary-soft hover:text-primary disabled:border-border disabled:bg-surface-muted disabled:text-muted"
        disabled={isSubmitting || value.trim().length === 0}
        type="submit"
      >
        {isSubmitting ? "…" : mode === "task" ? "Add" : "Log"}
      </button>
    </form>
  );
}
