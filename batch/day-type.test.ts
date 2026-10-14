import { describe, expect, it } from "vitest";
import { dayTypeOfYmd } from "./day-type";

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
