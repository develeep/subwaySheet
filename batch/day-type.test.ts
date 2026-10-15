import { describe, expect, it } from "vitest";
import { dayTypeOfYmd, hyphenateDate, mapDayTypes } from "./day-type";

describe("dayTypeOfYmd", () => {
  it("평일·토요일·일요일을 요일로 나눈다", () => {
    expect(dayTypeOfYmd("2024-03-04")).toBe("weekday");
    expect(dayTypeOfYmd("2024-03-09")).toBe("saturday");
    expect(dayTypeOfYmd("2024-03-10")).toBe("sunday");
  });

  it("공휴일은 평일이어도 일요일·공휴일이다", () => {
    expect(dayTypeOfYmd("2024-04-10")).toBe("sunday");
    expect(dayTypeOfYmd("2024-02-12")).toBe("sunday");
  });

  it("형식이 맞지 않는 날짜는 오류를 던진다", () => {
    expect(() => dayTypeOfYmd("20240304")).toThrow();
    expect(() => dayTypeOfYmd("2024-02-30")).toThrow();
  });
});

describe("hyphenateDate", () => {
  it("원본의 YYYYMMDD·YYYYMM을 하이픈 형식으로 쓴다", () => {
    expect(hyphenateDate("20241231")).toBe("2024-12-31");
    expect(hyphenateDate("202606")).toBe("2026-06");
    expect(() => hyphenateDate("2026-06")).toThrow();
  });
});

describe("mapDayTypes", () => {
  it("요일유형마다 값을 만든다", () => {
    expect(mapDayTypes((dayType) => dayType.length)).toEqual({ weekday: 7, saturday: 8, sunday: 6 });
  });
});
