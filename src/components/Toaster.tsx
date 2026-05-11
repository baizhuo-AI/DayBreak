import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { useToastStore, type ToastKind } from "../lib/toast";
import { cn } from "../lib/utils";

/**
 * Toast 渲染器 — 挂在 App 根部一次
 * 右下角堆叠,新的在底部出现并向上推。
 */
export function Toaster() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed bottom-6 right-6 z-[70] flex flex-col items-end gap-2 pointer-events-none">
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 30, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "pointer-events-auto min-w-[240px] max-w-sm rounded-xl shadow-lg",
              "border backdrop-blur-md",
              kindCls(t.kind)
            )}
          >
            <div className="px-3.5 py-2.5 flex items-start gap-2.5">
              <span className="flex-shrink-0 mt-0.5">{kindIcon(t.kind)}</span>
              <p className="flex-1 text-sm leading-relaxed">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="dismiss"
                className="flex-shrink-0 p-0.5 -m-0.5 rounded text-current opacity-60 hover:opacity-100 transition-opacity"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}

function kindIcon(kind: ToastKind) {
  switch (kind) {
    case "success":
      return <CheckCircle2 className="w-4 h-4" />;
    case "error":
      return <AlertCircle className="w-4 h-4" />;
    case "warning":
      return <AlertTriangle className="w-4 h-4" />;
    case "info":
    default:
      return <Info className="w-4 h-4" />;
  }
}

function kindCls(kind: ToastKind): string {
  switch (kind) {
    case "success":
      return "bg-emerald-50/95 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-100 border-emerald-200 dark:border-emerald-900/60";
    case "error":
      return "bg-red-50/95 dark:bg-red-950/80 text-red-900 dark:text-red-100 border-red-200 dark:border-red-900/60";
    case "warning":
      return "bg-amber-50/95 dark:bg-amber-950/80 text-amber-900 dark:text-amber-100 border-amber-200 dark:border-amber-900/60";
    case "info":
    default:
      return "bg-white/95 dark:bg-zinc-900/90 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800";
  }
}
