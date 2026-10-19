import { refinedDataSchema } from "@shared/refined-data";
import { describe, expect, it } from "vitest";
import { FIXTURE_CONFIG, fixtureRawSources } from "./fixtures/raw-sources";
import { refine, type TransferPassage } from "./refine";

const refined = () => refine(fixtureRawSources(), FIXTURE_CONFIG);
const station = (name: string) => refined().stations[name];
const stop = (name: string) => {
  const found = refined().routes[0]?.sequences[0]?.stops.find((s) => s.name === name);
  if (!found) throw new Error(`${name} 없음`);
  return found;
};

describe("refine", () => {
  it("정제 데이터 형식을 지킨다", () => {
    expect(() => refinedDataSchema.parse(refined())).not.toThrow();
  });

  it("노선 역 순서열을 역번호 순서로 만들고 부기명을 뗀다", () => {
    const route = refined().routes[0];
    expect(route).toMatchObject({ id: "2-main", lineNumber: 2, carCount: 10, isLoop: true });
    expect(route?.sequences[0]?.stops.map((s) => s.name)).toEqual(["시청", "을지로입구", "을지로3가", "을지로4가"]);
  });

  it("승하차를 요일유형별 하루 평균으로 만들고 공휴일은 일요일·공휴일에 넣는다", () => {
    const ridership = station("시청")?.ridership;
    // 하차 06시 이전 값: 평일 1000·1100 → 1050, 토요일 1200, 일요일 1300과 공휴일 1400 → 1350
    expect(ridership?.weekday.alighting[0]).toBe(1050);
    expect(ridership?.saturday.alighting[0]).toBe(1200);
    expect(ridership?.sunday.alighting[0]).toBe(1350);
    expect(ridership?.weekday.boarding[3]).toBe(503);
  });

  it("노선에 없는 호선 행은 같은 이름 역에도 더하지 않는다", () => {
    // 9호선 "시청" 하차 9999명이 섞이면 06시 이전 평일 하차가 1050이 아니게 된다.
    expect(station("시청")?.ridership?.weekday.alighting[0]).toBe(1050);
  });

  it("옛 역 이름(당고개)의 승하차가 현재 역 이름(불암산)에 붙는다", () => {
    const line4 = refined().routes.find((r) => r.id === "4");
    expect(line4?.sequences[0]?.stops.map((s) => s.name)).toEqual(["불암산", "충무로"]);
    expect(station("불암산")?.ridership?.weekday.alighting[0]).toBe(400);
    expect(station("당고개")).toBeUndefined();
  });

  it("환승역 승하차는 호선을 합쳐 역 단위로 쓴다", () => {
    // 을지로3가: 2호선 평일 하차 3000·3100 → 3050, 3호선 700 → 3750.
    expect(station("을지로3가")?.ridership?.weekday.alighting[0]).toBe(3750);
    // 충무로: 3호선 행이 없어도 4호선 행에 몰린 값을 역 단위로 쓴다. 3호선 정차 이름은 혼잡도 역명이다.
    expect(station("충무로")?.ridership?.weekday.alighting[0]).toBe(800);
    const line3 = refined().routes.find((r) => r.id === "3");
    expect(line3?.sequences[0]?.stops.map((s) => s.name)).toEqual(["을지로3가", "충무로"]);
  });

  it("원본별 기준 기간을 적는다", () => {
    expect(refined().periods).toEqual({
      ridership: { start: "2024-03-04", end: "2024-04-10" },
      congestion: "2026-06",
      transfer: "2026-06",
      fastExit: "2024-12-31",
    });
  });

  it("혼잡도 30분 값을 1시간 시간대로 합친다", () => {
    const down = stop("시청").congestion.down?.weekday;
    // 5시30분 = 0 → 06시 이전, 6시00분·6시30분 = 10·20 → 06~07시 15, 00시00분·00시30분 = 370·380 → 24시 이후 375
    expect(down?.[0]).toBe(0);
    expect(down?.[1]).toBe(15);
    expect(down?.[19]).toBe(375);
    expect(stop("시청").congestion.up?.sunday[5]).toBe(50);
  });

  it("한 역에서 빠른하차 하행과 혼잡도 내선이 함께 역번호 증가 방향(down)에 들어간다", () => {
    const { fastExit, congestion } = stop("시청");
    // 픽스처: 내선은 30분마다 10씩 오르고 외선은 50 고정이다.
    expect(congestion.down?.weekday[1]).toBe(15);
    expect(congestion.up?.weekday[1]).toBe(50);
    expect(fastExit.down.facilities).toEqual([
      { car: 3, door: 2, kind: "stairs" },
      { car: 8, door: 1, kind: "escalator" },
    ]);
    expect(fastExit.up.facilities).toEqual([
      { car: 4, door: 3, kind: "stairs" },
      { car: 6, door: 1, kind: "elevator" },
    ]);
  });

  it("칸 번호 형식 이상과 칸 수 초과 행을 거른다", () => {
    expect(stop("을지로입구").fastExit.down.facilities).toEqual([{ car: 7, door: 4, kind: "stairs" }]);
  });

  it("엘리베이터뿐인 역·방향과 한 방향이 없는 역·방향을 표시한다", () => {
    expect(stop("을지로3가").fastExit.down).toMatchObject({ isElevatorOnly: true, isMissing: false });
    expect(stop("시청").fastExit.down).toMatchObject({ isElevatorOnly: false, isMissing: false });
    // 계단이 없어도 에스컬레이터가 있으면 그 위치를 쓴다(엘리베이터뿐이 아니다).
    expect(stop("을지로4가").fastExit.down).toMatchObject({ isElevatorOnly: false, isMissing: false });
    expect(stop("을지로4가").fastExit.up).toEqual({ isElevatorOnly: false, isMissing: true, facilities: [] });
  });

  it("환승역에 환승인원과 만나는 노선 수를 붙이고, 환승역이 아니면 비운다", () => {
    expect(station("시청")?.transfer).toEqual({
      perDay: { weekday: 52690, saturday: 42575, sunday: 29750 },
      lineCount: 2,
    });
    expect(station("을지로입구")?.transfer).toBeNull();
  });

  it("환승역 표의 환승통로 칸을 그 노선·역·방향 정차에 붙이고, 표에 없는 역·방향은 비운다", () => {
    const passage = { station: "을지로3가", routeId: "2-main", toLine: "3호선", source: "픽스처" };
    const data = refine(fixtureRawSources(), {
      ...FIXTURE_CONFIG,
      transferPassages: [
        { ...passage, direction: "down", car: 10 },
        { ...passage, direction: "up", car: 1 },
      ],
    });
    const stops = data.routes[0]?.sequences[0]?.stops;
    expect(stops?.find((s) => s.name === "을지로3가")?.transferCars).toEqual({ down: [10], up: [1] });
    expect(stops?.find((s) => s.name === "시청")?.transferCars).toEqual({ down: [], up: [] });
    // 3호선 을지로3가는 표에 없다.
    expect(data.routes[1]?.sequences[0]?.stops[0]?.transferCars).toEqual({ down: [], up: [] });
  });

  it("환승역 표의 행이 어느 정차에도 붙지 않거나 칸 수를 넘으면 멈춘다", () => {
    const row: TransferPassage = {
      station: "을지로3가",
      routeId: "2-main",
      direction: "down",
      toLine: "3호선",
      car: 3,
      source: "픽스처",
    };
    const withRow = (patch: Partial<TransferPassage>) =>
      refine(fixtureRawSources(), { ...FIXTURE_CONFIG, transferPassages: [{ ...row, ...patch }] });
    expect(() => withRow({ station: "을지로" })).toThrow(/을지로/);
    expect(() => withRow({ routeId: "3" })).not.toThrow();
    expect(() => withRow({ routeId: "4" })).toThrow(/을지로3가/);
    expect(() => withRow({ car: 11 })).toThrow(/칸/);
  });

  it("노선 수 표에 없는 환승역이 있으면 멈춘다", () => {
    expect(() => refine(fixtureRawSources(), { ...FIXTURE_CONFIG, transferLineCounts: { 시청: 2 } })).toThrow(
      /을지로3가/,
    );
  });
});

describe("refine — 순서열 정의", () => {
  const [line2] = FIXTURE_CONFIG.routes;
  it("같은 호선의 노선마다 자기 칸 수로 빠른하차를 거른다(2호선 본선 10량, 지선 4량)", () => {
    if (!line2) throw new Error("픽스처 노선 없음");
    const branch = { ...line2, id: "2-branch", carCount: 4, isLoop: false, sequences: [{ stops: ["201", "202"] }] };
    const data = refine(fixtureRawSources(), { ...FIXTURE_CONFIG, routes: [line2, branch] });
    const carsAt = (routeId: string) =>
      data.routes.find((r) => r.id === routeId)?.sequences[0]?.stops[0]?.fastExit.down.facilities.map((f) => f.car);
    expect(carsAt("2-main")).toEqual([3, 8]);
    expect(carsAt("2-branch")).toEqual([3]);
  });

  if (!line2) throw new Error("픽스처 노선 없음");
  const withSequences = (sequences: (typeof line2)["sequences"]) =>
    refine(fixtureRawSources(), { ...FIXTURE_CONFIG, routes: [{ ...line2, isLoop: false, sequences }] }).routes[0];

  it("혼잡도를 특수 행 역번호에서 읽는 정차는 그 방향 칸만 바꾼다(2호선 9001 성수E 꼴)", () => {
    const route = withSequences([{ stops: [{ code: "201", up: { congestionCode: "9001" } }, "202"] }]);
    const cityHall = route?.sequences[0]?.stops[0];
    expect(cityHall?.congestion.up?.weekday[1]).toBe(77);
    expect(cityHall?.congestion.down?.weekday[1]).toBe(15);
  });

  it("한 방향 순서열은 그 방향을 적고, 다른 방향 원본을 읽는 정차는 그 값을 쓴다(6호선 응암순환 꼴)", () => {
    // 을지로입구를 상행으로 타지만 열차는 하행으로 달린다: 상행 칸에 하행 혼잡도·빠른하차(다음 역 을지로3가)를 읽는다.
    const route = withSequences([
      { oneWay: "up", stops: ["203", { code: "202", up: { congestionSide: "down", fastExitSide: "down" } }] },
    ]);
    const sequence = route?.sequences[0];
    expect(sequence?.oneWay).toBe("up");
    expect(sequence?.stops[1]?.congestion.up?.weekday[1]).toBe(15);
    expect(sequence?.stops[1]?.fastExit.up.facilities).toEqual([{ car: 7, door: 4, kind: "stairs" }]);
  });

  it("빠른하차는 순서열의 다음 역과 같은 행만 쓰고, 다음 역이 없는 끝 역 방향은 비운다", () => {
    const route = withSequences([{ stops: ["201", "202"] }]);
    const [cityHall, euljiroIpgu] = route?.sequences[0]?.stops ?? [];
    expect(cityHall?.fastExit.down.facilities.map((f) => f.car)).toEqual([3, 8]);
    // 시청 상행 행의 다음 역(픽스처 순환의 을지로4가)은 이 순서열에 없다.
    expect(cityHall?.fastExit.up.isMissing).toBe(true);
    expect(euljiroIpgu?.fastExit.down.isMissing).toBe(true);
  });
});

describe("refine — 잘못된 원본은 멈춘다", () => {
  const broken = (patch: Partial<ReturnType<typeof fixtureRawSources>>) => () =>
    refine({ ...fixtureRawSources(), ...patch }, FIXTURE_CONFIG);

  it("승하차 행의 칸이 모자라거나 승하차구분을 모르면 멈춘다", () => {
    expect(broken({ ridershipCsv: "머리\n1,2024-03-04,2호선,201,시청,하차,1,2" })).toThrow(/칸 수/);
    const unknownKind = `머리\n${["1", "2024-03-04", "2호선", "201", "시청", "환승", ...new Array(20).fill("1")].join(",")}`;
    expect(broken({ ridershipCsv: unknownKind })).toThrow(/승하차구분/);
  });

  it("따옴표가 든 CSV는 칸이 밀릴 수 있어 멈춘다", () => {
    expect(broken({ transfer: { period: "2026-06", csv: '머리\n1,"시청",1,2,3' } })).toThrow(/따옴표/);
  });

  it("혼잡도 구분 값이나 시간 칸 수가 다르면 멈춘다", () => {
    expect(broken({ congestion: { period: "2026-06", csv: "머리\n공휴일,2호선,201,시청,내선,1" } })).toThrow(/구분/);
    expect(broken({ congestion: { period: "2026-06", csv: "머리\n평일,2호선,201,시청,내선,1,2" } })).toThrow(/시간 칸/);
  });

  it("혼잡도 한 방향에 요일유형이 빠지면 0으로 채우지 않고 멈춘다", () => {
    const csv = `머리\n${["평일", "2호선", "201", "시청", "내선", ...new Array(39).fill("1")].join(",")}`;
    expect(broken({ congestion: { period: "2026-06", csv } })).toThrow(/요일유형/);
  });

  it("역번호가 숫자가 아니면 멈춘다", () => {
    const csv = `머리\n${["평일", "2호선", "ABC", "시청", "내선", ...new Array(39).fill("1")].join(",")}`;
    expect(broken({ congestion: { period: "2026-06", csv } })).toThrow(/역번호/);
  });

  it("빠른하차 행이 하나도 없으면 멈춘다", () => {
    expect(broken({ fastExitItems: [] })).toThrow(/빠른하차/);
  });

  it("노선 역의 이름을 어느 원본에서도 찾지 못하면 멈춘다", () => {
    const [route] = FIXTURE_CONFIG.routes;
    if (!route) throw new Error("픽스처 노선 없음");
    const config = { ...FIXTURE_CONFIG, routes: [{ ...route, sequences: [{ stops: ["201", "299"] }] }] };
    expect(() => refine(fixtureRawSources(), config)).toThrow(/299/);
  });
});
