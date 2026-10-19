import { describe, expect, it } from "vitest";
import {
  alightingAt,
  congestionOf,
  elevatorOnlyAt,
  fakeData,
  MISSING_SIDE,
  sequence,
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
      oppositeDirection: "up",
      towardStation: "나",
      middleStations: ["나"],
    });
    const up = ok(recommend(input("가", "마"), fakeData()));
    expect(up).toMatchObject({ direction: "up", towardStation: "바", middleStations: ["바"], stopCount: 2 });
  });

  it("순환 노선에서 두 방향 정거장 수가 같으면 하행(down)", () => {
    expect(ok(recommend(input("가", "라"), fakeData())).direction).toBe("down");
  });

  it("순환 노선은 방향을 반대로 바꿀 수 있다", () => {
    const result = ok(recommend(input("가", "다", { direction: "up" }), fakeData()));
    expect(result).toMatchObject({
      direction: "up",
      towardStation: "바",
      middleStations: ["바", "마", "라"],
      stopCount: 4,
    });
  });

  it("순환이 아닌 노선은 역 순서로 방향이 정해진다", () => {
    expect(ok(recommend(input("사", "자"), fakeData()))).toMatchObject({
      direction: "down",
      oppositeDirection: null,
      middleStations: ["아"],
    });
    expect(ok(recommend(input("자", "사", { direction: "down" }), fakeData()))).toMatchObject({
      direction: "up",
      towardStation: "아",
      route: { id: "line", lineNumber: 7, carCount: 4 },
    });
  });
});

describe("recommend — 노선 고르기", () => {
  /** 가·다를 함께 지나는 5호선(가→사→아→다, 3정거장)을 더한다. 2호선 순환으로는 2정거장이다. */
  const withLine5 = () => {
    const base = fakeData();
    const line5 = {
      id: "line5",
      lineNumber: 5,
      name: "5호선",
      carCount: 8,
      isLoop: false,
      sequences: [sequence(["가", "사", "아", "다"])],
    };
    return { ...base, routes: [...base.routes, line5] };
  };

  it("공통 노선이 하나면 그 노선으로 정하고 노선 칩은 하나뿐이다", () => {
    expect(ok(recommend(input("가", "다"), fakeData())).routeChoices).toEqual([
      { id: "loop", lineNumber: 2, name: "2호선", carCount: 4 },
    ]);
  });

  it("공통 노선이 둘 이상이면 노선 칩으로 모두 돌려주고, 기본은 정거장 수가 적은 노선이다", () => {
    const result = ok(recommend(input("가", "다"), withLine5()));
    expect(result.routeChoices.map((r) => r.id)).toEqual(["loop", "line5"]);
    expect(result).toMatchObject({ route: { id: "loop" }, middleStations: ["나"] });
  });

  it("노선 칩으로 고른 노선의 구간과 칸 수로 계산한다", () => {
    const result = ok(recommend(input("가", "다", { routeId: "line5" }), withLine5()));
    expect(result).toMatchObject({
      route: { id: "line5", carCount: 8 },
      middleStations: ["사", "아"],
      oppositeDirection: null,
    });
    expect(result.picks.every((car) => car >= 1 && car <= 8)).toBe(true);
  });

  it("고른 노선이 두 역을 함께 지나지 않으면 기본 노선을 쓴다", () => {
    expect(ok(recommend(input("가", "라", { routeId: "line5" }), withLine5())).route.id).toBe("loop");
  });
});

describe("recommend — 갈라지는 노선과 한 방향 순서열", () => {
  /** 사에서 아·자 방면과 차·가 방면으로 갈라지는 노선. */
  const forked = () => {
    const base = fakeData();
    const route = {
      id: "fork",
      lineNumber: 5,
      name: "5호선",
      carCount: 8,
      isLoop: false,
      sequences: [sequence(["사", "아", "자"]), sequence(["사", "차", "가"])],
    };
    return { ...base, routes: [route] };
  };

  it("갈라지는 노선은 도착역이 있는 갈래의 중간 역으로 계산한다", () => {
    expect(ok(recommend(input("사", "자"), forked())).middleStations).toEqual(["아"]);
    expect(ok(recommend(input("사", "가"), forked())).middleStations).toEqual(["차"]);
    expect(ok(recommend(input("가", "사"), forked()))).toMatchObject({ direction: "up", middleStations: ["차"] });
  });

  it("서로 다른 갈래의 두 역은 공통 노선이 없다", () => {
    expect(recommend(input("자", "가"), forked())).toEqual({ status: "error", error: "noCommonRoute" });
  });

  it("한 방향 순서열은 그 방향으로만 구간을 만든다(6호선 응암순환)", () => {
    // 순환 구간 아→자를 지나 사에서 차 방면으로 간다. 거꾸로 차→사→자→아는 상행 전용 순서열을 탄다.
    const base = fakeData();
    const route = {
      id: "6",
      lineNumber: 6,
      name: "6호선",
      carCount: 8,
      isLoop: false,
      sequences: [sequence(["아", "자", "사", "차", "가"], "down"), sequence(["자", "아", "사", "차", "가"], "up")],
    };
    const data = { ...base, routes: [route] };
    expect(ok(recommend(input("아", "차"), data))).toMatchObject({ direction: "down", middleStations: ["자", "사"] });
    expect(ok(recommend(input("차", "자"), data))).toMatchObject({ direction: "up", middleStations: ["사", "아"] });
    // 순환을 거꾸로 도는 열차는 없다.
    expect(recommend(input("자", "아"), data)).toEqual({ status: "error", error: "noCommonRoute" });
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

describe("recommend — 환승역 표", () => {
  // 나에서 하루 20만 명이 갈아탄다. 나의 출입설비는 기본값(1·4번 칸 계단)이다.
  const transferAtNa = (transferCars: { down: number[]; up: number[] }) =>
    withStop(
      withStation(fakeData(), "나", {
        transfer: { perDay: { weekday: 200000, saturday: 200000, sunday: 200000 }, lineCount: 1 },
      }),
      "나",
      { transferCars },
    );

  it("표에 있는 역·방향은 환승 하차가 환승통로 칸 쪽으로 몰린다", () => {
    expect(ok(recommend(input("가", "라"), transferAtNa({ down: [2], up: [] }))).picks).toEqual([2]);
  });

  it("표에 없는 역·방향은 환승 하차도 빠른하차 칸 분포를 따른다", () => {
    const withoutTable = ok(recommend(input("가", "라"), transferAtNa({ down: [], up: [] })));
    const otherDirectionOnly = ok(recommend(input("가", "라"), transferAtNa({ down: [], up: [2] })));
    expect(otherDirectionOnly.picks).toEqual(withoutTable.picks);
    expect(otherDirectionOnly.picks.every((car) => car === 1 || car === 4)).toBe(true);
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

  it("환승역 승하차(역 합계)는 그 역을 지나는 노선 수로 나눠 노선 하나 몫으로 쓴다", () => {
    // 나(1정거장 뒤, 2번 칸)에서 5000명, 다(2정거장 뒤, 앞쪽 역 가중치 절반, 3번 칸)에서 15000명이 내린다.
    let data = withStop(fakeData(), "나", { fastExit: { down: stairsAt(2), up: stairsAt(2) } });
    data = withStop(data, "다", { fastExit: { down: stairsAt(3), up: stairsAt(3) } });
    data = withStation(data, "나", { ridership: alightingAt({ 3: 5000 }) });
    data = withStation(data, "다", { ridership: alightingAt({ 3: 15000 }) });
    expect(ok(recommend(input("가", "라"), data)).picks[0]).toBe(3);

    // 다가 7호선에도 있으면 15000명의 절반만 이 노선 몫이라 나 쪽 칸이 앞선다.
    const [loop, line] = data.routes;
    if (!loop || !line) throw new Error("픽스처 노선 없음");
    const daOnLine = { ...line, sequences: [sequence(["사", "아", "자", "차", "다"])] };
    expect(ok(recommend(input("가", "라"), { ...data, routes: [loop, daOnLine] })).picks[0]).toBe(2);
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
    if (!loop || !line) throw new Error("픽스처 노선 없음");
    // "가"역이 7호선에도 있다고 가정한다.
    const options = stationOptions({
      ...base,
      routes: [loop, { ...line, sequences: [sequence(["사", "아", "자", "차", "가"])] }],
    });
    expect(options.map((o) => o.name)).toEqual(["가", "나", "다", "라", "마", "바", "사", "아", "자", "차"]);
    expect(options[0]).toEqual({ name: "가", lineNumbers: [2, 7] });
    expect(options[6]).toEqual({ name: "사", lineNumbers: [7] });
  });
});
