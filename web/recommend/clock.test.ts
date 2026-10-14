import { describe, expect, it } from "vitest";
import { clockOf } from "./clock";

describe("clockOf", () => {
  it("현지 시각을 0시부터 분으로, 요일을 요일유형으로 바꾼다", () => {
    expect(clockOf(new Date(2026, 9, 14, 8, 5))).toEqual({ departMinute: 485, dayType: "weekday" });
    expect(clockOf(new Date(2026, 9, 17, 23, 59))).toEqual({ departMinute: 1439, dayType: "saturday" });
    expect(clockOf(new Date(2026, 9, 18, 0, 0))).toEqual({ departMinute: 0, dayType: "sunday" });
  });
});
