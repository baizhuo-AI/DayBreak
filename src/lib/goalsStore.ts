import { create } from "zustand";
import {
  dbDeleteGoal,
  dbInsertGoal,
  dbListGoals,
  dbUpdateGoalStatus,
  type Goal,
  type GoalStatus
} from "./db";

export type { Goal, GoalPeriod, GoalStatus } from "./db";

/** 生成 goal id */
export function newGoalId(): string {
  return `g${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

interface GoalsStore {
  goals: Goal[];
  loaded: boolean;
  hydrate: () => Promise<void>;
  addGoal: (goal: Goal) => Promise<void>;
  setStatus: (id: string, status: GoalStatus) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
}

export const useGoalsStore = create<GoalsStore>((set, get) => ({
  goals: [],
  loaded: false,

  hydrate: async () => {
    try {
      const goals = await dbListGoals();
      set({ goals, loaded: true });
    } catch (err) {
      console.error("[goalsStore] hydrate failed:", err);
      set({ goals: [], loaded: true });
    }
  },

  addGoal: async (goal) => {
    await dbInsertGoal(goal);
    set((state) => ({ goals: [goal, ...state.goals] }));
  },

  setStatus: async (id, status) => {
    await dbUpdateGoalStatus(id, status);
    set((state) => ({
      goals: state.goals.map((g) =>
        g.id === id ? { ...g, status } : g
      )
    }));
  },

  removeGoal: async (id) => {
    await dbDeleteGoal(id);
    set((state) => ({ goals: state.goals.filter((g) => g.id !== id) }));
  }
}));
