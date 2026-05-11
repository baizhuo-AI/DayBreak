import type { ProjectColorToken } from "../tokens";
import { cn } from "../utils/cn";
import { projectColorClasses } from "../utils/projectColor";

export interface ProjectOption {
  id: string;
  name: string;
  color: ProjectColorToken;
}

export interface ProjectSwitcherProps {
  projects: ProjectOption[];
  selectedProjectId: string;
  predictedProjectId?: string;
  mode?: "dropdown" | "inline";
  onChange: (projectId: string) => void;
}

export function ProjectSwitcher({
  projects,
  selectedProjectId,
  predictedProjectId,
  mode = "dropdown",
  onChange
}: ProjectSwitcherProps) {
  const predictedProject = projects.find((project) => project.id === predictedProjectId);

  if (mode === "inline") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {projects.map((project) => {
          const isSelected = project.id === selectedProjectId;
          const isPredicted = project.id === predictedProjectId;

          return (
            <button
              key={project.id}
              className={cn(
                "focus-ring inline-flex min-h-touch items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium transition-colors duration-fast ease-calm",
                isSelected
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-surface text-text hover:border-primary hover:text-primary"
              )}
              type="button"
              onClick={() => onChange(project.id)}
            >
              <span className={cn("h-2 w-2 rounded-full", projectColorClasses[project.color])} />
              <span>{project.name}</span>
              {isPredicted ? <span className="text-xs text-muted">AI</span> : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label className="text-xs font-medium text-muted" htmlFor="project-switcher">
        Project
      </label>
      <select
        id="project-switcher"
        className="focus-ring h-touch rounded-md border border-border bg-surface px-3 text-sm text-text"
        value={selectedProjectId}
        onChange={(event) => onChange(event.target.value)}
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      {predictedProject ? (
        <p className="text-xs text-muted">Predicted project: {predictedProject.name}</p>
      ) : null}
    </div>
  );
}
