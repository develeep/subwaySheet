import { recommend } from "@web/recommend/recommend";
import { describe, expect, it } from "vitest";
import { FIXTURE_CONFIG, fixtureRawSources } from "./fixtures/raw-sources";
import { refine } from "./refine";

/**
 * 계약 테스트 — 배치 픽스처 출력을 그대로 추천 모듈에 넣어 결과가 나오는지 본다(스펙 #2).
 * 배치나 정제 데이터 형식을 고쳐도 앱이 조용히 깨지지 않게 한다. `*.test.ts`라 batch → web import가 허용된다.
 */

describe("배치 출력 → 추천 모듈", () => {
  it("픽스처 정제 데이터로 추천 칸이 나온다", () => {
    const data = refine(fixtureRawSources(), FIXTURE_CONFIG);
    const result = recommend({ from: "을지로입구", to: "을지로4가", dayType: "weekday", departMinute: 8 * 60 }, data);
    expect(result).toMatchObject({
      status: "ok",
      route: { id: "2-main", carCount: 10 },
      direction: "down",
      towardStation: "을지로3가",
      stops: ["을지로3가"],
      evenlySpreadStations: ["을지로3가"],
      periods: { ridership: { start: "2024-03-04", end: "2024-04-10" } },
    });
    if (result.status !== "ok") return;
    expect(result.picks.length).toBeGreaterThan(0);
    expect(result.picks.every((car) => car >= 1 && car <= 10)).toBe(true);
  });
});
