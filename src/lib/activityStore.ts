import { create } from "zustand";
import {
  dbInsertActivity,
  dbListActivities,
  dbDeleteActivity,
  type ActivityRecord
} from "./db";
import { emitSync } from "./syncBus";

/**
 * 间歇式时间日志 store
 *
 * 记录「刚才做了什么」的一句话流水。主 App 和浮窗共享同一 SQLite,
 * 改动后 emitSync("activities") 广播,各窗口 re-hydrate。
 */

export type { ActivityRecord } from "./db";

export function newActivityId(): string {
  return `a${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

interface ActivityStore {
  activities: ActivityRecord[];
  loaded: boolean;
  hydrate: () => Promise<void>;
  /** 记一条活动(自由文本) */
  addActivity: (content: string) => Promise<void>;
  removeActivity: (id: string) => Promise<void>;
}

export const useActivityStore = create<ActivityStore>((set) => ({
  activities: [],
  loaded: false,

  hydrate: async () => {
    try {
      const activities = await dbListActivities();
      set({ activities, loaded: true });
    } catch (err) {
      console.error("[activityStore] hydrate failed:", err);
      set({ activities: [], loaded: true });
    }
  },

  addActivity: async (content) => {
    const rec: ActivityRecord = {
      id: newActivityId(),
      content,
      createdAt: new Date().toISOString()
    };
    await dbInsertActivity(rec);
    set((s) => ({ activities: [rec, ...s.activities] }));
    emitSync("activities");
  },

  removeActivity: async (id) => {
    await dbDeleteActivity(id);
    set((s) => ({ activities: s.activities.filter((a) => a.id !== id) }));
    emitSync("activities");
  }
}));
