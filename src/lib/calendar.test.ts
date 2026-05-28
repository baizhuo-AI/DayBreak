import { describe, it, expect } from "vitest";
import { parseScheduledTime, quickDeadline, dateKey } from "./calendar";

describe("parseScheduledTime", () => {
  it("解析合法时段", () => {
    expect(parseScheduledTime("09:30-11:00")).toEqual({ startMin: 570, endMin: 660 });
  });

  it("容忍空格", () => {
    expect(parseScheduledTime(" 9:00 - 10:30 ")).toEqual({ startMin: 540, endMin: 630 });
  });

  it("结束 <= 开始 → null(NewTaskModal 提交校验依赖此)", () => {
    expect(parseScheduledTime("11:00-09:00")).toBeNull();
    expect(parseScheduledTime("10:00-10:00")).toBeNull();
  });

  it("非法格式 → null", () => {
    expect(parseScheduledTime("下午3点")).toBeNull();
    expect(parseScheduledTime("0930-1100")).toBeNull();
    expect(parseScheduledTime(undefined)).toBeNull();
  });

  it("越界 → null", () => {
    expect(parseScheduledTime("25:00-26:00")).toBeNull();
  });
});

describe("quickDeadline", () => {
  // 锚定一个周三 2026-05-13(月份 0-based,4 = 5 月)
  const wed = new Date(2026, 4, 13, 10, 0, 0);

  it("today = 当天", () => {
    expect(quickDeadline("today", wed)).toBe(dateKey(wed));
  });

  it("tomorrow = 次日", () => {
    expect(quickDeadline("tomorrow", wed)).toBe("2026-05-14");
  });

  it("thisFri 落在周五", () => {
    const fri = quickDeadline("thisFri", wed);
    expect(new Date(`${fri}T12:00:00`).getDay()).toBe(5);
  });

  it("nextMon 落在周一,且在 thisFri 之后", () => {
    const mon = quickDeadline("nextMon", wed);
    expect(new Date(`${mon}T12:00:00`).getDay()).toBe(1);
    expect(mon > quickDeadline("thisFri", wed)).toBe(true);
  });

  it("周日仍归本周(周一为周首):thisFri/nextMon 不被周日带偏", () => {
    const sun = new Date(2026, 4, 17, 10, 0, 0); // 周日
    expect(new Date(`${quickDeadline("thisFri", sun)}T12:00:00`).getDay()).toBe(5);
    expect(new Date(`${quickDeadline("nextMon", sun)}T12:00:00`).getDay()).toBe(1);
  });
});
