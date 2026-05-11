import { ExportIcon } from "../components/icons";
import { ReportSection } from "../components/ReportSection";
import type { ProjectColorToken } from "../tokens";

export interface DailyReportSection {
  projectName: string;
  projectColor: ProjectColorToken;
  duration: string;
  doneList: string[];
  todoList: string[];
}

export interface DailyReportProps {
  dateLabel: string;
  totalDuration: string;
  sections: DailyReportSection[];
  supplement: string;
  onSupplementChange: (value: string) => void;
  onExport: () => void;
}

export function DailyReport({
  dateLabel,
  totalDuration,
  sections,
  supplement,
  onSupplementChange,
  onExport
}: DailyReportProps) {
  return (
    <section className="surface-frame w-full max-w-2xl rounded-lg p-4">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.04em] text-muted">Daily Report</p>
          <h2 className="text-xl font-semibold text-text">{dateLabel}</h2>
          <p className="text-sm text-muted">Total focus time: {totalDuration}</p>
        </div>
        <button
          className="focus-ring inline-flex min-h-touch items-center gap-2 rounded-md border border-primary bg-primary px-3 text-sm font-medium text-surface"
          type="button"
          onClick={onExport}
        >
          <span className="h-4 w-4">
            <ExportIcon />
          </span>
          Export
        </button>
      </header>

      <div className="space-y-3">
        {sections.map((section) => (
          <ReportSection key={section.projectName} {...section} />
        ))}
      </div>

      <label className="mt-4 block">
        <span className="mb-2 block text-xs font-medium uppercase tracking-[0.04em] text-muted">
          Supplement
        </span>
        <textarea
          className="focus-ring min-h-24 w-full rounded-lg border border-border bg-surface px-3 py-3 text-sm text-text placeholder:text-muted"
          placeholder="Context that should appear in the exported summary…"
          value={supplement}
          onChange={(event) => onSupplementChange(event.target.value)}
        />
      </label>
    </section>
  );
}
