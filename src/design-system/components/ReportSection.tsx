import { useState } from "react";
import type { ProjectColorToken } from "../tokens";
import { cn } from "../utils/cn";
import { projectColorClasses } from "../utils/projectColor";

export interface ReportSectionProps {
  projectName: string;
  projectColor: ProjectColorToken;
  duration: string;
  doneList: string[];
  todoList: string[];
  defaultCollapsed?: boolean;
}

export function ReportSection({
  projectName,
  projectColor,
  duration,
  doneList,
  todoList,
  defaultCollapsed = false
}: ReportSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section className="rounded-lg border border-border bg-surface">
      <button
        className="focus-ring flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left"
        type="button"
        onClick={() => setCollapsed((current) => !current)}
      >
        <span className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", projectColorClasses[projectColor])} />
          <span className="text-md font-semibold text-text">{projectName}</span>
        </span>
        <span className="text-xs font-medium text-muted">{duration}</span>
      </button>
      {!collapsed ? (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.04em] text-muted">Done</p>
            <ul className="space-y-1 text-sm text-text">
              {doneList.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.04em] text-muted">Next</p>
            <ul className="space-y-1 text-sm text-text">
              {todoList.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
