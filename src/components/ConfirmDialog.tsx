import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";

/**
 * 全局确认对话框 - Promise-based API
 *
 * 用法:
 *   const confirm = useConfirm();
 *   const ok = await confirm({ title: "删除",  message: "确认?", destructive: true });
 *   if (ok) ...
 *
 * 设计:
 *  - 一次只显示一个(并发请求会排队)
 *  - Esc 取消,Enter 确认
 *  - destructive=true 时确认按钮红色
 *
 * 放在 App 根部用 <ConfirmDialogProvider> 包,所有子组件 useConfirm() 可调用。
 */

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type Resolver = (ok: boolean) => void;

interface PendingConfirm extends ConfirmOptions {
  resolve: Resolver;
}

const ConfirmCtx = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions): Promise<boolean> =>
      new Promise<boolean>((resolve) => {
        setPending({ ...opts, resolve });
      }),
    []
  );

  function resolve(ok: boolean) {
    if (pending) {
      pending.resolve(ok);
      setPending(null);
    }
  }

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <ConfirmRenderer pending={pending} onResolve={resolve} />
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) {
    throw new Error("useConfirm must be used inside <ConfirmDialogProvider>");
  }
  return ctx;
}

/* ---------- 渲染 ---------- */

function ConfirmRenderer({
  pending,
  onResolve
}: {
  pending: PendingConfirm | null;
  onResolve: (ok: boolean) => void;
}) {
  const { t } = useTranslation();
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pending) return;
    // 默认聚焦确认按钮,delete 类操作期待用户主动按 Enter 确认(确认按钮就绪)
    const id = setTimeout(() => okRef.current?.focus(), 80);
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onResolve(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onResolve(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      clearTimeout(id);
      document.removeEventListener("keydown", handler);
    };
  }, [pending, onResolve]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {pending && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
          onClick={() => onResolve(false)}
        >
          <motion.div
            initial={{ scale: 0.95, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "w-full max-w-sm rounded-2xl shadow-lg overflow-hidden",
              "bg-white dark:bg-zinc-900",
              "border border-zinc-200 dark:border-zinc-800"
            )}
            role="alertdialog"
            aria-modal="true"
          >
            <div className="p-5 flex items-start gap-3">
              {pending.destructive && (
                <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-500 flex-shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {pending.title}
                </h2>
                <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {pending.message}
                </p>
              </div>
            </div>

            <div className="px-5 py-3 bg-zinc-50 dark:bg-zinc-950/50 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onResolve(false)}
                className="px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                {pending.cancelLabel ?? t("common.cancel")}
              </button>
              <button
                ref={okRef}
                type="button"
                onClick={() => onResolve(true)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium text-white rounded-md transition-colors",
                  pending.destructive
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-indigo-500 hover:bg-indigo-600"
                )}
              >
                {pending.confirmLabel ?? t("common.confirm")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
