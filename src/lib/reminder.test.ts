import { describe, it, expect } from "vitest";
import { shouldFireReminder } from "./reminder";
import type { ReminderConfig } from "./settings";

const base: ReminderConfig = {
  enabled: true,
  intervalMin: 120,
  channel: "both",
  workStart: 9,
  workEnd: 22
};

// 工作时段内的某时刻:2026-05-13 14:00
const workNow = new Date(2026, 4, 13, 14, 0, 0);
const workNowMs = workNow.getTime();
const MIN = 60 * 1000;

describe("shouldFireReminder", () => {
  it("满足全部条件(间隔已过)→ true", () => {
    expect(shouldFireReminder(base, workNow, workNowMs, workNowMs - 121 * MIN)).toBe(true);
  });

  it("未开启 → false", () => {
    expect(shouldFireReminder({ ...base, enabled: false }, workNow, workNowMs, 0)).toBe(false);
  });

  it("工作时段之前(8 点)→ false", () => {
    const early = new Date(2026, 4, 13, 8, 30, 0);
    expect(shouldFireReminder(base, early, early.getTime(), 0)).toBe(false);
  });

  it("工作时段结束(22 点,区间右开)→ false", () => {
    const late = new Date(2026, 4, 13, 22, 0, 0);
    expect(shouldFireReminder(base, late, late.getTime(), 0)).toBe(false);
  });

  it("间隔未到(才过 60 分钟,阈值 120)→ false", () => {
    expect(shouldFireReminder(base, workNow, workNowMs, workNowMs - 60 * MIN)).toBe(false);
  });

  it("暂停中 → false", () => {
    expect(
      shouldFireReminder({ ...base, pausedUntil: workNowMs + 10_000 }, workNow, workNowMs, 0)
    ).toBe(false);
  });

  it("暂停已过期 → 恢复(true)", () => {
    expect(
      shouldFireReminder(
        { ...base, pausedUntil: workNowMs - 10_000 },
        workNow,
        workNowMs,
        workNowMs - 121 * MIN
      )
    ).toBe(true);
  });
});
