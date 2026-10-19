import { readFileSync } from "node:fs";
import { refinedDataSchema } from "@shared/refined-data";
import { describe, expect, it } from "vitest";
import { type RecommendSuccess, recommend } from "./recommend";

/**
 * 프로토타입 회귀 — 실제 정제 데이터(`public/data/refined-data.json`)로 프로토타입 FINDINGS 표의 2호선 평일 결과를 재현한다(스펙 #2).
 * 데이터를 다시 만들거나 공식을 바꿔 이 테스트가 깨지면, 바뀐 이유를 PR에 적는다.
 * 아래 "1~8호선 노선"은 같은 실제 데이터로 노선 순서열(갈래·지선·응암순환)이 맞게 들어갔는지 본다(#6).
 */

const data = refinedDataSchema.parse(JSON.parse(readFileSync("public/data/refined-data.json", "utf-8")));

function weekday(from: string, to: string, hour: number, routeId?: string): RecommendSuccess {
  const result = recommend({ from, to, dayType: "weekday", departMinute: hour * 60, routeId }, data);
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

describe("1~8호선 노선 (실제 데이터)", () => {
  it("노선마다 순서열 끝에서 끝까지(순환은 반 바퀴) 그 노선으로 추천이 나온다", () => {
    for (const route of data.routes) {
      for (const sequence of route.sequences) {
        const names = sequence.stops.map((s) => s.name);
        const last = route.isLoop ? Math.floor(names.length / 2) : names.length - 1;
        const [from, to] = sequence.oneWay === "up" ? [names[last], names[0]] : [names[0], names[last]];
        const result = weekday(from ?? "", to ?? "", 8, route.id);
        expect(result.route.id).toBe(route.id);
        expect(result.picks.every((car) => car >= 1 && car <= route.carCount)).toBe(true);
      }
    }
  });

  it("5호선은 마천 방면과 하남검단산 방면을 각자의 중간 역으로 계산한다", () => {
    expect(weekday("천호", "마천", 8).middleStations).toEqual([
      "강동",
      "둔촌동",
      "올림픽공원",
      "방이",
      "오금",
      "개롱",
      "거여",
    ]);
    expect(weekday("천호", "상일동", 8).middleStations).toEqual(["강동", "길동", "굽은다리", "명일", "고덕"]);
    expect(weekday("하남검단산", "길동", 8)).toMatchObject({ direction: "up", towardStation: "하남시청" });
  });

  it("성수지선·신정지선은 별도 노선이고 자기 칸 수로 계산한다", () => {
    expect(weekday("신설동", "성수", 8).route).toEqual({
      id: "2-seongsu",
      lineNumber: 2,
      name: "2호선 성수지선",
      carCount: 4,
    });
    expect(weekday("신도림", "까치산", 8).route).toMatchObject({ id: "2-sinjeong", carCount: 6 });
  });

  it("6호선 응암순환은 운행 방향(응암 → 역촌 → … → 구산)으로만 계산한다", () => {
    expect(weekday("불광", "새절", 8).middleStations).toEqual(["독바위", "연신내", "구산", "응암"]);
    expect(weekday("새절", "불광", 8).middleStations).toEqual(["응암", "역촌"]);
    expect(weekday("합정", "구산", 8).middleStations.slice(-6)).toEqual([
      "새절",
      "응암",
      "역촌",
      "불광",
      "독바위",
      "연신내",
    ]);
  });

  it("공통 노선이 둘이면 노선 칩으로 고를 수 있다(충정로→영등포구청: 2호선·5호선)", () => {
    const result = weekday("충정로", "영등포구청", 8);
    expect(result.routeChoices.map((r) => r.id)).toEqual(["2-main", "5"]);
    expect(weekday("충정로", "영등포구청", 8, "5").middleStations[0]).toBe("애오개");
  });

  it("갈아타야 하는 두 역은 공통 노선이 없다", () => {
    expect(recommend({ from: "신설동", to: "강남", dayType: "weekday", departMinute: 480 }, data)).toEqual({
      status: "error",
      error: "noCommonRoute",
    });
  });
});
