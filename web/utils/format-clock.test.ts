import { describe, expect, it } from "vitest";
import { formatClock } from "./format-clock";

describe("formatClock", () => {
  it("0시부터 센 분을 HH:MM으로 쓴다", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(8 * 60 + 5)).toBe("08:05");
    expect(formatClock(23 * 60 + 59)).toBe("23:59");
  });
});
