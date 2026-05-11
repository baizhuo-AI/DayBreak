import { create } from "zustand";

/**
 * 全局 Toast 系统
 *
 * 用法:
 *   import { toast } from "@/lib/toast";
 *   toast.success("已添加");
 *   toast.error("解析失败,已存原文");
 *
 * 设计:
 *  - zustand store(非 Context),可以在任何地方调用(包括 store action)
 *  - 多条 toast 堆叠,自动 3.5 秒消失
 *  - 类型:success / error / info / warning
 *  - 渲染靠 <Toaster /> 组件,在 App 根挂一次
 */

export type ToastKind = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
  duration: number; // ms
  createdAt: number;
}

const DEFAULT_DURATION = 3500;

interface ToastStore {
  items: ToastItem[];
  push: (item: Omit<ToastItem, "id" | "createdAt">) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  items: [],
  push: (item) => {
    const id = `t${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const full: ToastItem = { ...item, id, createdAt: Date.now() };
    set((s) => ({ items: [...s.items, full] }));
    // 自动消失
    if (full.duration > 0) {
      setTimeout(() => {
        set((s) => ({ items: s.items.filter((x) => x.id !== id) }));
      }, full.duration);
    }
    return id;
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
  clear: () => set({ items: [] })
}));

function helper(kind: ToastKind, duration = DEFAULT_DURATION) {
  return (message: string, opts?: { duration?: number }) =>
    useToastStore.getState().push({
      kind,
      message,
      duration: opts?.duration ?? duration
    });
}

export const toast = {
  success: helper("success"),
  error: helper("error", 5000),
  info: helper("info"),
  warning: helper("warning", 4500)
};
