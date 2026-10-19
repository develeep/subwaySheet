import { readFileSync } from "node:fs";
import { type RefinedData, refinedDataSchema } from "@shared/refined-data";
import { describe, expect, it } from "vitest";
import { type RecommendSuccess, recommend, stationOptions } from "./recommend";

/**
 * 프로토타입 회귀 — 실제 정제 데이터(`public/data/refined-data.json`)로 프로토타입 FINDINGS 표의 2호선 평일 결과를 재현한다(스펙 #2).
 * 프로토타입에는 환승역 표가 없어서, 표를 비운 데이터로 재현한다. 표를 채운 결과는 "환승역 표 반영"에서 따로 본다(#7).
 * 데이터를 다시 만들거나 공식을 바꿔 이 테스트가 깨지면, 바뀐 이유를 PR에 적는다. 공식 5·6에서 달라진 구간은 "중간 역 경쟁 반영",
 * 공식 7(역 사이 운행시간, #25)에서 달라진 구간은 "역 사이 운행시간 반영"에 둔다.
 * 공식 8(칸마다 내릴 역별로 승객 걷기, #26, ADR 0008)에서는 대부분의 구간이 바뀌어 제자리에서 고치고 제목에 공식 7 값을 함께 적는다.
 * 아래 "1~8호선 노선"은 같은 실제 데이터로 노선 순서열(갈래·지선·응암순환)이 맞게 들어갔는지 본다(#6).
 * "데이터 없는 역과 코레일 구간"은 코레일 구간·데이터 없는 역이 낀 구간을 있는 역만으로 계산하는지 본다(#10).
 */

const data = refinedDataSchema.parse(JSON.parse(readFileSync("public/data/refined-data.json", "utf-8")));

/** 환승역 표를 비운 데이터. 표에 없는 역·방향과 같게 빠른하차 칸 분포를 따른다. */
const withoutTable: RefinedData = {
  ...data,
  routes: data.routes.map((route) => ({
    ...route,
    sequences: route.sequences.map((sequence) => ({
      ...sequence,
      stops: sequence.stops.map((stop) => ({ ...stop, transferCars: { down: [], up: [] } })),
    })),
  })),
};

function weekday(from: string, to: string, hour: number, routeId?: string, source = data): RecommendSuccess {
  const result = recommend({ from, to, dayType: "weekday", departMinute: hour * 60, routeId }, source);
  if (result.status !== "ok") throw new Error(`${from}→${to} 추천 실패: ${result.error}`);
  return result;
}

describe("프로토타입 회귀 (2호선 평일, 환승역 표 비움)", () => {
  const prototype = (from: string, to: string, hour: number) => weekday(from, to, hour, undefined, withoutTable);

  it("강남→신도림 18시는 10·2번 칸이지만 칸 차이 작음(프로토타입·공식 7은 3·8번 칸)", () => {
    expect(prototype("강남", "신도림", 18)).toMatchObject({ picks: [10, 2], isWeakGap: true });
  });
});

// 공식 5(ADR 0006)에서 달라진 18~20정거장 구간. 중간 역에서 계단 쪽 칸으로 탄 사람과 나눠 앉아 칸끼리 차이가 줄었다.
// 공식 6(ADR 0007)에서는 탄 사람의 44%가 내릴 역 출입설비 쪽에 서서 아래 두 구간이 더 바뀌었다.
// 공식 8(ADR 0008)에서는 내리는 칸이 그 사람이 탄 칸을 따르고 이미 타고 있던 사람도 계단 쪽 칸에 몰려 아래 세 구간이 더 바뀌었다.
describe("중간 역 경쟁 반영 (2호선 평일, 환승역 표 비움, 공식 8)", () => {
  const ridden = (from: string, to: string, hour: number) => weekday(from, to, hour, undefined, withoutTable);

  it("사당→시청 08시는 4·7번 칸이지만 칸 차이 작음(프로토타입 4번 칸)", () => {
    expect(ridden("사당", "시청", 8)).toMatchObject({ picks: [4, 7], isWeakGap: true });
  });

  it("신도림→강남 08시는 6번 칸이 1등이고 5번 칸이 2등(프로토타입·공식 5는 3번 칸, 공식 6·7은 2등 3번 칸)", () => {
    expect(ridden("신도림", "강남", 8).picks).toEqual([6, 5]);
  });

  it("잠실→신도림 08시는 5·4번 칸이지만 칸 차이 작음(프로토타입 3·8번 칸, 공식 7은 8·4번 칸)", () => {
    expect(ridden("잠실", "신도림", 8)).toMatchObject({ picks: [5, 4], isWeakGap: true });
  });

  it("홍대입구→잠실 08시는 10·6번 칸이지만 칸 차이 작음(프로토타입 칸 차이 작음, 공식 7은 을지로입구 쪽 6·9번 칸)", () => {
    expect(ridden("홍대입구", "잠실", 8)).toMatchObject({
      picks: [10, 6],
      isWeakGap: true,
      reason: { station: "을지로입구" },
    });
  });
});

describe("역 사이 운행시간 반영 (2호선 평일, 공식 8, #25)", () => {
  it("삼성→봉천 18시는 10번 칸이 1등이고 3번 칸이 2등(공식 6은 3번 칸이 1등, 공식 7은 교대 쪽 1·3번 칸)", () => {
    expect(weekday("삼성", "봉천", 18)).toMatchObject({
      picks: [10, 3],
      isWeakGap: false,
      reason: { station: "선릉" },
    });
  });
});

describe("환승역 표 반영 (2호선 평일, #7)", () => {
  it("강남→신도림 18시는 첫 중간 역 교대의 3호선 환승통로(내선 1번 칸) 쪽 1번 칸", () => {
    expect(weekday("강남", "신도림", 18)).toMatchObject({ picks: [1], reason: { station: "교대" } });
  });

  it("신도림→강남 08시는 구로디지털단지 쪽 5·6번 칸(공식 7은 대림 7호선 환승통로 쪽 4번 칸)", () => {
    expect(weekday("신도림", "강남", 8)).toMatchObject({ picks: [5, 6], reason: { station: "구로디지털단지" } });
  });

  it("사당→시청 08시는 7·6번 칸이지만 칸 차이 작음(공식 7은 이유 역이 대림)", () => {
    expect(weekday("사당", "시청", 8)).toMatchObject({
      picks: [7, 6],
      isWeakGap: true,
      reason: { station: "구로디지털단지" },
    });
  });

  it("홍대입구→잠실 08시는 6·1번 칸이지만 칸 차이 작음(공식 7은 동대문역사문화공원 환승통로 덕에 2등 9번 칸)", () => {
    expect(weekday("홍대입구", "잠실", 8)).toMatchObject({
      picks: [6, 1],
      isWeakGap: true,
      reason: { station: "을지로입구" },
    });
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

describe("데이터 없는 역과 코레일 구간 (실제 데이터, #10)", () => {
  const rangeEnds = (result: RecommendSuccess) => result.missingRanges.map((r) => [r[0], r.at(-1)]);

  it("데이터 없는 역(7호선 부천 구간·별내선·진접선)과 1·3·4호선 코레일 구간 역을 고를 수 있다", () => {
    const names = new Set(stationOptions(data).map((o) => o.name));
    const targets = [
      "석남",
      "까치울",
      "별내",
      "장자호수공원",
      "진접",
      "별내별가람",
      "오이도",
      "선바위",
      "대화",
      "삼송",
    ];
    const line1 = ["연천", "회기", "남영", "구로", "인천", "신창", "서동탄", "광명"];
    expect([...targets, ...line1].filter((name) => !names.has(name))).toEqual([]);
  });

  it("오이도→사당은 남태령으로 계산하고 오이도~선바위 범위를 알린다", () => {
    const result = weekday("오이도", "사당", 8);
    expect(result).toMatchObject({ route: { id: "4" }, reason: { station: "남태령" } });
    expect(rangeEnds(result)).toEqual([["오이도", "선바위"]]);
  });

  it("출발역이 코레일 구간이면(대화→종로3가) 출발역부터, 도착역이 코레일 구간이면(종로3가→인천) 도착역까지 범위로 묶는다", () => {
    expect(rangeEnds(weekday("대화", "종로3가", 8))).toEqual([["대화", "삼송"]]);
    expect(rangeEnds(weekday("종로3가", "인천", 8))).toEqual([["남영", "인천"]]);
  });

  it("출발역과 도착역이 모두 코레일 구간이면(회기→구로) 범위 둘을 알린다", () => {
    expect(rangeEnds(weekday("회기", "구로", 8))).toEqual([
      ["회기", "회기"],
      ["남영", "구로"],
    ]);
  });

  it("중간 역이 모두 데이터 없는 역이면(오이도→금정) 추천할 수 없다", () => {
    expect(recommend({ from: "오이도", to: "금정", dayType: "weekday", departMinute: 480 }, data)).toEqual({
      status: "error",
      error: "noStopsToScore",
    });
  });
});
