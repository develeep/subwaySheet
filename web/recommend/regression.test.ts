import { readFileSync } from "node:fs";
import { refinedDataSchema } from "@shared/refined-data";
import { describe, expect, it } from "vitest";
import { type RecommendSuccess, recommend } from "./recommend";

/**
 * 프로토타입 회귀 — 실제 정제 데이터(`public/data/refined-data.json`)로 프로토타입 FINDINGS 표의 2호선 평일 결과를 재현한다(스펙 #2).
 * 데이터를 다시 만들거나 공식을 바꿔 이 테스트가 깨지면, 바뀐 이유를 PR에 적는다.
 */

const data = refinedDataSchema.parse(JSON.parse(readFileSync("public/data/refined-data.json", "utf-8")));

function weekday(from: string, to: string, hour: number): RecommendSuccess {
  const result = recommend({ from, to, dayType: "weekday", departMinute: hour * 60 }, data);
  if (result.status !== "ok") throw new Error(`${from}→${to} 추천 실패: ${result.error}`);
  return result;
}

describe("프로토타입 회귀 (2호선 평일)", () => {
  it("신도림→강남 08시는 3번 칸", () => {
    expect(weekday("신도림", "강남", 8).picks[0]).toBe(3);
  });

  it("강남→신도림 18시는 3·8번 칸", () => {
    expect([...weekday("강남", "신도림", 18).picks].sort()).toEqual([3, 8]);
  });

  it("사당→시청 08시는 4번 칸(4·7번 안에서)", () => {
    const { picks } = weekday("사당", "시청", 8);
    expect(picks[0]).toBe(4);
    expect(picks.every((car) => car === 4 || car === 7)).toBe(true);
  });

  it("잠실→신도림 08시는 3·8번 칸 안에서", () => {
    expect(weekday("잠실", "신도림", 8).picks.every((car) => car === 3 || car === 8)).toBe(true);
  });

  it("홍대입구→잠실 08시는 칸 차이 작음", () => {
    expect(weekday("홍대입구", "잠실", 8).isWeakGap).toBe(true);
  });
});
