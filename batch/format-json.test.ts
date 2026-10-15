import { describe, expect, it } from "vitest";
import { formatJson } from "./format-json";

describe("formatJson", () => {
  it("객체는 줄을 나누고 숫자 배열은 한 줄에 둔다", () => {
    const text = formatJson({ a: [1, 2.5, 3], b: { c: "x" }, d: [{ e: 1 }] });
    expect(text).toBe(
      '{\n  "a": [1, 2.5, 3],\n  "b": {\n    "c": "x"\n  },\n  "d": [\n    {\n      "e": 1\n    }\n  ]\n}\n',
    );
    expect(JSON.parse(text)).toEqual({ a: [1, 2.5, 3], b: { c: "x" }, d: [{ e: 1 }] });
  });
});
