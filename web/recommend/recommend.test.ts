import { describe, expect, it } from "vitest";
import {
  alightingAt,
  congestionOf,
  elevatorOnlyAt,
  fakeData,
  MISSING_SIDE,
  stairsAt,
  withStation,
  withStop,
} from "./fixtures/fake-data";
import { FORMULA_VERSION } from "./formula";
import { type RecommendInput, type RecommendResult, recommend, stationOptions } from "./recommend";

const EIGHT_AM = 8 * 60;
const input = (from: string, to: string, extra: Partial<RecommendInput> = {}): RecommendInput => ({
  from,
  to,
  dayType: "weekday",
  departMinute: EIGHT_AM,
  ...extra,
});

function ok(result: RecommendResult) {
  if (result.status !== "ok") throw new Error(`추천 실패: ${result.error}`);
  return result;
}

/** 나역에서 2번 칸 쪽 계단으로 많이 내리는 데이터. */
const busyAtNa = () =>
  withStation(withStop(fakeData(), "나", { fastExit: { down: stairsAt(2), up: stairsAt(2) } }), "나", {
    ridership: alightingAt(Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i, 5000]))),
  });

describe("recommend — 오류", () => {
  it("출발역과 도착역이 같으면 sameStation", () => {
    expect(recommend(input("가", "가"), fakeData())).toEqual({ status: "error", error: "sameStation" });
  });

  it("두 역을 함께 지나는 노선이 없으면 noCommonRoute", () => {
    expect(recommend(input("가", "아"), fakeData())).toEqual({ status: "error", error: "noCommonRoute" });
    expect(recommend(input("가", "없는역"), fakeData())).toEqual({ status: "error", error: "noCommonRoute" });
  });

  it("중간 역이 없으면 noStopsToScore", () => {
    expect(recommend(input("가", "나"), fakeData())).toEqual({ status: "error", error: "noStopsToScore" });
  });

  it("중간 역이 모두 데이터 없는 역이면 noStopsToScore", () => {
    const data = withStation(withStation(fakeData(), "나", { ridership: null }), "다", { ridership: null });
    expect(recommend(input("가", "라"), data)).toEqual({ status: "error", error: "noStopsToScore" });
  });
});

describe("recommend — 노선과 방향", () => {
  it("순환 노선은 정거장 수가 적은 방향이 기본이고 다음 역 방면으로 적는다", () => {
    const down = ok(recommend(input("가", "다"), fakeData()));
    expect(down).toMatchObject({
      direction: "down",
      isDefaultDirection: true,
      canChangeDirection: true,
      towardStation: "나",
      stops: ["나"],
    });
    const up = ok(recommend(input("가", "마"), fakeData()));
    expect(up).toMatchObject({ direction: "up", towardStation: "바", stops: ["바"], stopCount: 2 });
  });

  it("순환 노선에서 두 방향 정거장 수가 같으면 하행(down)", () => {
    expect(ok(recommend(input("가", "라"), fakeData())).direction).toBe("down");
  });

  it("순환 노선은 방향을 반대로 바꿀 수 있다", () => {
    const result = ok(recommend(input("가", "다", { direction: "up" }), fakeData()));
    expect(result).toMatchObject({
      direction: "up",
      isDefaultDirection: false,
      towardStation: "바",
      stops: ["바", "마", "라"],
      stopCount: 4,
    });
  });

  it("순환이 아닌 노선은 역 순서로 방향이 정해진다", () => {
    expect(ok(recommend(input("사", "자"), fakeData()))).toMatchObject({
      direction: "down",
      canChangeDirection: false,
      stops: ["아"],
    });
    expect(ok(recommend(input("자", "사", { direction: "down" }), fakeData()))).toMatchObject({
      direction: "up",
      towardStation: "아",
      route: { id: "line", lineNumber: 7, carCount: 4 },
    });
  });
});

describe("recommend — 추천 칸과 앉을 가능성", () => {
  it("많이 내리는 중간 역의 출입설비 칸을 추천하고 그 역을 이유로 든다", () => {
    const result = ok(recommend(input("가", "라"), busyAtNa()));
    expect(result.picks[0]).toBe(2);
    expect(result.reason).toEqual({ station: "나", stopsAfter: 1 });
    expect(result.isWeakGap).toBe(false);
  });

  it("중간 역 도착 시각이 시간대 경계를 넘으면 그 시간대 데이터를 쓴다", () => {
    // 나(1정거장 뒤)는 08시대에만, 다(2정거장 뒤)는 07시대에만 많이 내린다. 정거장당 2분.
    let data = withStop(fakeData(), "나", { fastExit: { down: stairsAt(2), up: stairsAt(2) } });
    data = withStop(data, "다", { fastExit: { down: stairsAt(3), up: stairsAt(3) } });
    data = withStation(data, "나", { ridership: alightingAt({ 3: 5000 }) });
    data = withStation(data, "다", { ridership: alightingAt({ 2: 5000 }) });

    expect(ok(recommend(input("가", "라", { departMinute: 7 * 60 + 59 }), data)).picks[0]).toBe(2);
    expect(ok(recommend(input("가", "라", { departMinute: 7 * 60 + 50 }), data)).picks[0]).toBe(3);
  });

  it("1등과 2등 칸 점수가 10% 안이면 두 칸을 함께 추천한다", () => {
    const data = withStop(busyAtNa(), "나", {
      fastExit: {
        down: {
          isMissing: false,
          isElevatorOnly: false,
          facilities: [2, 3].map((car) => ({ car, door: 1, kind: "stairs" })),
        },
        up: MISSING_SIDE,
      },
    });
    expect([...ok(recommend(input("가", "라"), data)).picks].sort()).toEqual([2, 3]);
    expect(ok(recommend(input("가", "라"), busyAtNa())).picks).toEqual([2]);
  });

  it("칸마다 점수가 비슷하면 칸 차이 작음으로 표시한다", () => {
    let data = fakeData();
    for (const name of ["가", "나", "다"]) {
      data = withStop(data, name, { fastExit: { down: elevatorOnlyAt([]), up: elevatorOnlyAt([]) } });
    }
    expect(ok(recommend(input("가", "라"), data)).isWeakGap).toBe(true);
  });

  it("출발역 혼잡도가 칸당 좌석보다 적으면 바로 앉을 수 있고 가능성은 높음", () => {
    const data = withStop(fakeData(), "가", { congestion: congestionOf(20) });
    expect(ok(recommend(input("가", "라"), data))).toMatchObject({ canSitAtOrigin: true, grade: "high" });
    expect(ok(recommend(input("가", "라"), fakeData())).canSitAtOrigin).toBe(false);
  });

  it("빈자리가 서 있는 사람보다 훨씬 적으면 가능성은 낮음", () => {
    const data = withStop(fakeData(), "가", { congestion: congestionOf(200) });
    expect(ok(recommend(input("가", "라"), data)).grade).toBe("low");
  });
});

describe("recommend — 데이터 없는 역과 고르게 퍼뜨린 역", () => {
  it("승하차가 없는 중간 역은 빼고 계산하고 이름을 돌려준다", () => {
    const result = ok(recommend(input("가", "라"), withStation(busyAtNa(), "다", { ridership: null })));
    expect(result.missingStations).toEqual(["다"]);
    expect(result.picks[0]).toBe(2);
  });

  it("그 방향 빠른하차가 통째로 없는 역은 데이터 없는 역으로 다룬다", () => {
    const data = withStop(fakeData(), "다", { fastExit: { down: MISSING_SIDE, up: stairsAt(1) } });
    expect(ok(recommend(input("가", "라"), data)).missingStations).toEqual(["다"]);
  });

  it("엘리베이터뿐인 역은 칸마다 고르게 퍼뜨리고 이름을 돌려준다", () => {
    const elevatorOnly = elevatorOnlyAt([{ car: 2, door: 1, kind: "elevator" }]);
    const data = withStop(busyAtNa(), "나", { fastExit: { down: elevatorOnly, up: elevatorOnly } });
    const result = ok(recommend(input("가", "라"), data));
    expect(result.evenlySpreadStations).toEqual(["나"]);
    expect(result.picks[0]).not.toBe(2);
  });
});

describe("recommend — 결과에 함께 싣는 값", () => {
  it("기준 기간, 공식 버전, 계산에 쓴 요일유형을 돌려준다", () => {
    const result = ok(recommend(input("가", "라", { dayType: "saturday" }), fakeData()));
    expect(result.dayType).toBe("saturday");
    expect(result.periods.ridership).toEqual({ start: "2024-01-01", end: "2024-12-31" });
    expect(result.formulaVersion).toBe(FORMULA_VERSION);
    expect(result.route).toEqual({ id: "loop", lineNumber: 2, name: "2호선", carCount: 4 });
  });
});

describe("recommend — 시간대와 요일유형", () => {
  const gradeAt = (hour: number, dayType: RecommendInput["dayType"] = "weekday") =>
    ok(recommend(input("가", "라", { departMinute: hour * 60, dayType }), busyAtNa())).grade;

  it("시간당 하차가 같아도 배차 간격이 길면 열차당 내리는 사람이 많아 가능성이 오른다", () => {
    expect(gradeAt(8)).toBe("low"); // 평일 첨두 2.5분
    expect(gradeAt(9)).toBe("mid"); // 평일 준첨두 4분
    expect(gradeAt(13)).toBe("mid"); // 평시 5.5분
    expect(gradeAt(8, "saturday")).toBe("mid"); // 주말은 평시 배차
    expect(gradeAt(23)).toBe("high"); // 심야 8분
  });

  it("고른 요일유형의 승하차를 쓴다", () => {
    const ridership = alightingAt({ 3: 5000 });
    if (!ridership) throw new Error("픽스처 없음");
    const data = withStation(busyAtNa(), "나", {
      ridership: { ...ridership, weekday: { boarding: new Array(20).fill(0), alighting: new Array(20).fill(0) } },
    });
    expect(ok(recommend(input("가", "라", { dayType: "saturday" }), data)).picks[0]).toBe(2);
    expect(ok(recommend(input("가", "라"), data)).picks[0]).not.toBe(2);
  });

  it("출발역 혼잡도가 없으면 서 있는 사람을 0으로 본다(프로토타입 그대로, 규칙은 #10에서 정한다)", () => {
    const data = withStop(busyAtNa(), "가", { congestion: { down: null, up: null } });
    expect(ok(recommend(input("가", "라"), data))).toMatchObject({ canSitAtOrigin: false, grade: "high" });
  });
});

describe("stationOptions", () => {
  it("고를 수 있는 역을 노선 순서대로 중복 없이, 지나는 호선과 함께 돌려준다", () => {
    const base = fakeData();
    const [loop, line] = base.routes;
    const ga = loop?.stops.find((s) => s.name === "가");
    if (!loop || !line || !ga) throw new Error("픽스처 노선 없음");
    // "가"역이 7호선에도 있다고 가정한다.
    const options = stationOptions({ ...base, routes: [loop, { ...line, stops: [...line.stops, ga] }] });
    expect(options.map((o) => o.name)).toEqual(["가", "나", "다", "라", "마", "바", "사", "아", "자", "차"]);
    expect(options[0]).toEqual({ name: "가", lineNumbers: [2, 7] });
    expect(options[6]).toEqual({ name: "사", lineNumbers: [7] });
  });
});
