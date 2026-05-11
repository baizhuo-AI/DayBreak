import { useEffect, useRef, useState } from "react";
import type { ProjectOption } from "./ProjectSwitcher";
import { IconButton } from "./IconButton";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { QuickInput } from "./QuickInput";

export interface CheckInDialogSubmitPayload {
  note: string;
  projectId: string;
}

export interface CheckInDialogProps {
  open: boolean;
  projects: ProjectOption[];
  defaultProjectId: string;
  predictedProjectId?: string;
  initialValue?: string;
  isSubmitting?: boolean;
  variant?: "normal" | "quiet";
  onSubmit: (payload: CheckInDialogSubmitPayload) => void | Promise<void>;
  onSnooze: () => void;
  onSkip: () => void;
}

export function CheckInDialog({
  open,
  projects,
  defaultProjectId,
  predictedProjectId,
  initialValue = "",
  isSubmitting = false,
  variant = "normal",
  onSubmit,
  onSnooze,
  onSkip
}: CheckInDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [projectId, setProjectId] = useState(predictedProjectId ?? defaultProjectId);
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    setProjectId(predictedProjectId ?? defaultProjectId);
    setValue(initialValue);
    setError("");

    const timeoutId = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 80);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onSnooze();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [defaultProjectId, initialValue, onSnooze, open, predictedProjectId]);

  if (!open) {
    return null;
  }

  async function handleSubmit(note: string) {
    if (!note.trim()) {
      setError("Write a short update or snooze.");
      return;
    }

    setError("");
    await onSubmit({ note, projectId });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/20 px-4">
      <div className="surface-frame w-full max-w-sm rounded-lg p-4 transition-all duration-slow ease-calm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text">
              {variant === "quiet" ? "Quiet Check-in" : "Hourly Check-in"}
            </h2>
            <p className="text-sm text-muted">
              Capture progress without leaving the flow.
            </p>
          </div>
          <IconButton ariaLabel="Snooze 10 minutes" icon={<span>⏱</span>} shortcutHint="Esc" onClick={onSnooze} />
        </div>

        <div className="space-y-3">
          <ProjectSwitcher
            mode="dropdown"
            predictedProjectId={predictedProjectId}
            projects={projects}
            selectedProjectId={projectId}
            onChange={setProjectId}
          />
          <QuickInput
            inputRef={inputRef}
            isSubmitting={isSubmitting}
            mode="activity-log"
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
          />
          {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
          <div className="flex items-center justify-end gap-2">
            <button
              className="focus-ring min-h-touch rounded-md border border-border px-3 text-sm font-medium text-muted"
              type="button"
              onClick={onSkip}
            >
              Skip
            </button>
            <button
              className="focus-ring min-h-touch rounded-md border border-border px-3 text-sm font-medium text-text"
              type="button"
              onClick={onSnooze}
            >
              Snooze
            </button>
            <button
              className="focus-ring min-h-touch rounded-md border border-primary bg-primary px-3 text-sm font-medium text-surface disabled:border-border disabled:bg-surface-muted disabled:text-muted"
              disabled={isSubmitting || value.trim().length === 0}
              type="button"
              onClick={() => void handleSubmit(value)}
            >
              Submit ⏎
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
