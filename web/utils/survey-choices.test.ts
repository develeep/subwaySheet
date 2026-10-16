import { describe, expect, it } from "vitest";
import { otherCarsOf, stopChoicesOf } from "./survey-choices";

describe("설문 선택지", () => {
  it("다른 칸 번호는 1번부터 노선 칸 수까지에서 추천 칸을 뺀다", () => {
    expect(otherCarsOf(10, [8, 3])).toEqual([1, 2, 4, 5, 6, 7, 9, 10]);
    expect(otherCarsOf(4, [1])).toEqual([2, 3, 4]);
  });

  it("몇 정거장 뒤 버튼은 시작값이 구간 정거장 수보다 작은 것만 보인다", () => {
    expect(stopChoicesOf(12).map((c) => c.label)).toEqual(["타자마자", "1~2정거장", "3~5정거장", "6정거장 이상"]);
    expect(stopChoicesOf(6).map((c) => c.label)).toEqual(["타자마자", "1~2정거장", "3~5정거장"]);
    expect(stopChoicesOf(3).map((c) => c.label)).toEqual(["타자마자", "1~2정거장"]);
  });
});
