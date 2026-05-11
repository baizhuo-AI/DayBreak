import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../utils/cn";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: ReactNode;
  ariaLabel: string;
  shortcutHint?: string;
  variant?: "ghost" | "primary";
}

export function IconButton({
  icon,
  ariaLabel,
  shortcutHint,
  variant = "ghost",
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={ariaLabel}
      className={cn(
        "focus-ring inline-flex min-h-touch min-w-touch items-center justify-center gap-1 rounded-md border text-sm font-medium transition-colors duration-fast ease-calm",
        variant === "primary"
          ? "border-primary bg-primary px-2 text-surface hover:bg-primary-soft hover:text-primary disabled:border-border disabled:bg-surface-muted disabled:text-muted"
          : "border-border bg-surface px-2 text-muted hover:border-primary hover:text-primary disabled:border-border disabled:text-muted",
        className
      )}
      type={type}
      {...props}
    >
      <span className="h-4 w-4">{icon}</span>
      {shortcutHint ? <span className="text-xs font-medium">{shortcutHint}</span> : null}
    </button>
  );
}
