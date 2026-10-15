import { describe, expect, it } from "vitest";
import { formatClock, parseClock } from "./format-clock";

describe("formatClock", () => {
  it("0시부터 센 분을 HH:MM으로 쓴다", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(8 * 60 + 5)).toBe("08:05");
    expect(formatClock(23 * 60 + 59)).toBe("23:59");
  });
});

describe("parseClock", () => {
  it("시각 입력의 HH:MM을 0시부터 센 분으로 바꾼다", () => {
    expect(parseClock("00:00")).toBe(0);
    expect(parseClock("08:05")).toBe(485);
    expect(parseClock("23:59")).toBe(1439);
  });

  it("비었거나 형식·범위가 맞지 않으면 null이다", () => {
    expect(parseClock("")).toBeNull();
    expect(parseClock("8:05")).toBeNull();
    expect(parseClock("24:00")).toBeNull();
    expect(parseClock("08:60")).toBeNull();
  });
});
