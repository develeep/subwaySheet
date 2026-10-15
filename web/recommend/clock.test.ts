import { describe, expect, it } from "vitest";
import { clockOf } from "./clock";

describe("clockOf", () => {
  it("현지 시각을 0시부터 분으로, 요일을 요일유형으로 바꾼다", () => {
    expect(clockOf(new Date(2026, 9, 14, 8, 5))).toEqual({ departMinute: 485, dayType: "weekday" });
    expect(clockOf(new Date(2026, 9, 17, 23, 59))).toEqual({ departMinute: 1439, dayType: "saturday" });
    expect(clockOf(new Date(2026, 9, 18, 0, 0))).toEqual({ departMinute: 0, dayType: "sunday" });
  });

  it("평일 공휴일과 대체공휴일은 일요일·공휴일이다", () => {
    expect(clockOf(new Date(2026, 9, 9, 8, 0)).dayType).toBe("sunday"); // 한글날(금)
    expect(clockOf(new Date(2026, 9, 5, 8, 0)).dayType).toBe("sunday"); // 개천절 대체공휴일(월)
    expect(clockOf(new Date(2026, 4, 1, 8, 0)).dayType).toBe("sunday"); // 노동절(금)
    expect(clockOf(new Date(2026, 6, 17, 8, 0)).dayType).toBe("sunday"); // 제헌절(금)
  });

  it("토요일 공휴일은 일요일·공휴일이다", () => {
    expect(clockOf(new Date(2026, 7, 15, 8, 0)).dayType).toBe("sunday"); // 광복절(토)
  });
});
