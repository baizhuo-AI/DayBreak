export type ThemeMode = "light" | "dark";

export type PriorityLevel = "P0" | "P1" | "P2" | "P3";

export type DeadlineState = "safe" | "warning" | "danger" | "overdue";

export type ProjectColorToken =
  | "project-1"
  | "project-2"
  | "project-3"
  | "project-4"
  | "project-5"
  | "project-6"
  | "project-7"
  | "project-8";

export interface DesignTokens {
  color: {
    neutral: Record<ThemeMode, Record<"bg" | "surface" | "border" | "text" | "textMuted", string>>;
    semantic: Record<"primary" | "success" | "warning" | "danger", string>;
    projectPalette: Record<ProjectColorToken, string>;
  };
  typography: {
    fontSize: Record<"xs" | "sm" | "md" | "lg" | "xl", string>;
    lineHeight: Record<"xs" | "sm" | "md" | "lg" | "xl", string>;
    fontWeight: Record<"regular" | "medium" | "semibold", number>;
  };
  spacing: Record<"0.5" | "1" | "2" | "3" | "4" | "5" | "6" | "8", string>;
  radius: Record<"sm" | "md" | "lg" | "full", string>;
  shadow: Record<"popover" | "toast", string>;
  motion: {
    fast: string;
    base: string;
    slow: string;
    easing: string;
  };
  layout: {
    panelWidth: string;
    panelHeight: string;
    capsuleWidth: string;
    hitTarget: string;
  };
}

export const designTokens: DesignTokens = {
  color: {
    neutral: {
      light: {
        bg: "#FAFAF9",
        surface: "#FFFFFF",
        border: "#E7E5E4",
        text: "#1C1917",
        textMuted: "#78716C"
      },
      dark: {
        bg: "#1A1A1A",
        surface: "#242424",
        border: "#2E2E2E",
        text: "#F5F5F4",
        textMuted: "#A8A29E"
      }
    },
    semantic: {
      primary: "#3B82F6",
      success: "#10B981",
      warning: "#F59E0B",
      danger: "#EF4444"
    },
    projectPalette: {
      "project-1": "#F87171",
      "project-2": "#FB923C",
      "project-3": "#FBBF24",
      "project-4": "#A3E635",
      "project-5": "#34D399",
      "project-6": "#22D3EE",
      "project-7": "#818CF8",
      "project-8": "#C084FC"
    }
  },
  typography: {
    fontSize: {
      xs: "11px",
      sm: "12px",
      md: "13px",
      lg: "15px",
      xl: "18px"
    },
    lineHeight: {
      xs: "14px",
      sm: "16px",
      md: "18px",
      lg: "20px",
      xl: "24px"
    },
    fontWeight: {
      regular: 400,
      medium: 500,
      semibold: 600
    }
  },
  spacing: {
    "0.5": "2px",
    "1": "4px",
    "2": "8px",
    "3": "12px",
    "4": "16px",
    "5": "20px",
    "6": "24px",
    "8": "32px"
  },
  radius: {
    sm: "4px",
    md: "6px",
    lg: "8px",
    full: "9999px"
  },
  shadow: {
    popover: "0 4px 16px rgba(0, 0, 0, 0.08)",
    toast: "0 8px 24px rgba(0, 0, 0, 0.12)"
  },
  motion: {
    fast: "120ms",
    base: "180ms",
    slow: "240ms",
    easing: "cubic-bezier(.2,.8,.2,1)"
  },
  layout: {
    panelWidth: "240px",
    panelHeight: "400px",
    capsuleWidth: "60px",
    hitTarget: "24px"
  }
};

export const priorityOrder: PriorityLevel[] = ["P0", "P1", "P2", "P3"];

export const deadlineStates: DeadlineState[] = ["safe", "warning", "danger", "overdue"];

export const projectColorTokens = Object.keys(
  designTokens.color.projectPalette
) as ProjectColorToken[];
