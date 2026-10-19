import { describe, expect, it } from "vitest";
import {
  alightingAt,
  asDataless,
  boardingAt,
  congestionOf,
  elevatorOnlyAt,
  everySlot,
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

describe("recommend — 추천 칸과 화면 규칙", () => {
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

  it("출발역 혼잡도가 칸당 좌석보다 적으면 바로 앉을 수 있다", () => {
    const data = withStop(fakeData(), "가", { congestion: congestionOf(20) });
    expect(ok(recommend(input("가", "라"), data)).canSitAtOrigin).toBe(true);
    // 모든 칸에서 바로 앉아 점수가 같으면 자리가 많이 나는 칸과 그 역을 든다.
    const quietOrigin = withStop(busyAtNa(), "가", { congestion: congestionOf(20) });
    const quiet = ok(recommend(input("가", "라"), quietOrigin));
    expect(quiet).toMatchObject({ isWeakGap: true, reason: { station: "나" } });
    expect(quiet.picks[0]).toBe(2);
    expect(ok(recommend(input("가", "라"), fakeData())).canSitAtOrigin).toBe(false);
  });
});

describe("recommend — 중간 역에서 타는 사람과 나눠 앉기", () => {
  it("중간 역에서 계단 쪽 칸으로 많이 타면, 그 뒤 역의 빈자리를 나눠 가져 옆 칸이 앞선다", () => {
    // 아(1정거장 뒤)에서 2번 칸 쪽으로 많이 타고, 자(2정거장 뒤)에서 2·3번 칸 쪽으로 똑같이 많이 내린다.
    let data = withStop(fakeData(), "아", { fastExit: { down: stairsAt(2), up: stairsAt(2) } });
    data = withStation(data, "아", { ridership: boardingAt(everySlot(6000)) });
    data = withStop(data, "자", { fastExit: { down: stairsAt(2, 3), up: stairsAt(2, 3) } });
    data = withStation(data, "자", { ridership: alightingAt(everySlot(6000)) });
    expect(ok(recommend(input("사", "차"), data)).picks).toEqual([3]);
  });

  it("중간 역을 떠날 때 서 있는 사람이 없으면 그 뒤 역에서는 어느 칸이든 앉아 칸 차이가 작다", () => {
    // 다(2정거장 뒤)에서 2번 칸 쪽으로 많이 내린다. 나를 떠날 때 붐비면(150%) 2번 칸이 앞서고, 한산하면(20%) 다 전에 이미 앉는다.
    let data = withStop(fakeData(), "다", { fastExit: { down: stairsAt(2), up: stairsAt(2) } });
    data = withStation(data, "다", { ridership: alightingAt(everySlot(20000)) });
    const withNa = (percent: number) =>
      ok(
        recommend(
          input("가", "마", { direction: "down" }),
          withStop(data, "나", { congestion: congestionOf(percent) }),
        ),
      );
    expect(withNa(150)).toMatchObject({ picks: [2], isWeakGap: false });
    expect(withNa(20).isWeakGap).toBe(true);
  });
});

describe("recommend — 데이터 없는 역과 고르게 퍼뜨린 역", () => {
  it("승하차가 없는 중간 역은 빼고 계산하고 이름을 돌려준다", () => {
    const result = ok(recommend(input("가", "라"), withStation(busyAtNa(), "다", { ridership: null })));
    expect(result.missingRanges).toEqual([["다"]]);
    expect(result.picks[0]).toBe(2);
  });

  it("그 방향 빠른하차가 통째로 없는 역은 데이터 없는 역으로 다룬다", () => {
    const data = withStop(fakeData(), "다", { fastExit: { down: MISSING_SIDE, up: stairsAt(1) } });
    expect(ok(recommend(input("가", "라"), data)).missingRanges).toEqual([["다"]]);
  });

  it("엘리베이터뿐인 역은 칸마다 고르게 퍼뜨리고 이름을 돌려준다", () => {
    const elevatorOnly = elevatorOnlyAt([{ car: 2, door: 1, kind: "elevator" }]);
    const data = withStop(busyAtNa(), "나", { fastExit: { down: elevatorOnly, up: elevatorOnly } });
    const result = ok(recommend(input("가", "라"), data));
    expect(result.evenlySpreadStations).toEqual(["나"]);
    // 엘리베이터 칸(2번)만 앞서지 않는다. 출발역에서 1·4번 칸(계단)으로 탄 사람과 나눠 앉아 2·3번 칸이 같다.
    expect([...result.picks].sort()).toEqual([2, 3]);
  });
});

describe("recommend — 데이터 없는 역이 낀 구간(코레일 구간 꼴)", () => {
  // 사·아는 데이터 없는 역, 자는 많이 내리는 역(3번 칸 계단)이다. 오이도(코레일)→…→남태령→사당 꼴이다.
  const korailFront = () =>
    withStation(
      withStop(asDataless(asDataless(fakeData(), "사"), "아"), "자", {
        fastExit: { down: stairsAt(3), up: stairsAt(3) },
      }),
      "자",
      { ridership: alightingAt(Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i, 5000]))) },
    );

  it("출발역 쪽이 데이터 없는 역이면 있는 역만으로 계산하고, 출발역부터 이어진 범위로 묶어 알린다", () => {
    const result = ok(recommend(input("사", "차"), korailFront()));
    expect(result).toMatchObject({ middleStations: ["아", "자"], missingRanges: [["사", "아"]] });
    expect(result.picks[0]).toBe(3);
    expect(result.reason).toEqual({ station: "자", stopsAfter: 2 });
  });

  it("도착역 쪽이 데이터 없는 역이면 도착역까지 이어진 범위로 묶어 알린다", () => {
    const result = ok(recommend(input("차", "사"), korailFront()));
    expect(result.missingRanges).toEqual([["아", "사"]]);
    expect(result.reason.station).toBe("자");
  });

  it("출발역과 도착역이 모두 데이터 없는 역이면 범위를 따로 알린다", () => {
    const result = ok(recommend(input("사", "차"), asDataless(asDataless(fakeData(), "사"), "차")));
    expect(result.missingRanges).toEqual([["사"], ["차"]]);
  });

  it("빠진 역을 포함한 정거장 순서로 도착 시간대와 앞쪽 역 가중치를 센다", () => {
    // 나는 데이터 없는 역. 다(2정거장 뒤)는 08시대에만 3번 칸 쪽으로 많이 내린다. 7시 57분 출발 + 2정거장 × 2분 = 8시 1분.
    let data = asDataless(fakeData(), "나");
    data = withStop(data, "다", { fastExit: { down: stairsAt(3), up: stairsAt(3) } });
    data = withStation(data, "다", { ridership: alightingAt({ 3: 5000 }) });
    const result = ok(recommend(input("가", "라", { departMinute: 7 * 60 + 57 }), data));
    expect(result.picks[0]).toBe(3);
    expect(result.reason).toEqual({ station: "다", stopsAfter: 2 });
  });

  it("출발역 혼잡도가 없으면 구간에서 혼잡도가 있는 첫 역의 값으로 서 있는 사람을 잡는다", () => {
    // 0명으로 두면 첫 중간 역에서 모두 앉아 칸 차이가 사라진다. 나의 75%로 대신하면 가가 75%일 때와 같다.
    const noOriginCongestion = withStop(busyAtNa(), "가", { congestion: { down: null, up: null } });
    const { picks, isWeakGap, reason } = ok(recommend(input("가", "라"), busyAtNa()));
    expect(ok(recommend(input("가", "라"), noOriginCongestion))).toMatchObject({
      picks,
      isWeakGap,
      reason,
      canSitAtOrigin: false,
    });
    // 대신 쓴 역이 한산해도 출발역에서 바로 앉는다고 하지 않는다(출발역 혼잡도를 모른다).
    const quietNa = withStop(noOriginCongestion, "나", { congestion: congestionOf(20) });
    expect(ok(recommend(input("가", "라"), quietNa)).canSitAtOrigin).toBe(false);
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
  it("환승역 승하차(역 합계)는 그 역을 지나는 노선 수로 나눠 노선 하나 몫으로 쓴다", () => {
    // 나(1정거장 뒤, 2번 칸)에서 1000명, 다(2정거장 뒤, 앞쪽 역 가중치 절반, 3번 칸)에서 3000명이 내린다.
    let data = withStop(fakeData(), "나", { fastExit: { down: stairsAt(2), up: stairsAt(2) } });
    data = withStop(data, "다", { fastExit: { down: stairsAt(3), up: stairsAt(3) } });
    data = withStation(data, "나", { ridership: alightingAt({ 3: 1000 }) });
    data = withStation(data, "다", { ridership: alightingAt({ 3: 3000 }) });
    expect(ok(recommend(input("가", "라"), data)).picks).toEqual([3]);

    // 다가 7호선에도 있으면 3000명의 절반만 이 노선 몫이라 나 쪽 칸이 앞선다.
    const [loop, line] = data.routes;
    if (!loop || !line) throw new Error("픽스처 노선 없음");
    const daOnLine = { ...line, sequences: [sequence(["사", "아", "자", "차", "다"])] };
    expect(ok(recommend(input("가", "라"), { ...data, routes: [loop, daOnLine] })).picks).toEqual([2]);

    // 7호선에서는 다가 데이터 없는 정차(1호선 신도림 꼴)면 7호선 몫이 없어 나누지 않는다.
    const [daSequence] = daOnLine.sequences;
    if (!daSequence) throw new Error("픽스처 순서열 없음");
    const stops = daSequence.stops.map((s) => ({ ...s, isDataless: s.name === "다" }));
    const daDataless = { ...daOnLine, sequences: [{ ...daSequence, stops }] };
    expect(ok(recommend(input("가", "라"), { ...data, routes: [loop, daDataless] })).picks).toEqual([3]);
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
