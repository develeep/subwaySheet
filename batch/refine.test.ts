import { refinedDataSchema } from "@shared/refined-data";
import { describe, expect, it } from "vitest";
import { FIXTURE_CONFIG, fixtureRawSources } from "./fixtures/raw-sources";
import { refine } from "./refine";

const refined = () => refine(fixtureRawSources(), FIXTURE_CONFIG);
const station = (name: string) => refined().stations[name];
const stop = (name: string) => {
  const found = refined().routes[0]?.stops.find((s) => s.name === name);
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
    expect(route?.stops.map((s) => s.name)).toEqual(["시청", "을지로입구", "을지로3가", "을지로4가"]);
  });

  it("승하차를 요일유형별 하루 평균으로 만들고 공휴일은 일요일·공휴일에 넣는다", () => {
    const ridership = station("시청")?.ridership;
    // 하차 06시 이전 값: 평일 1000·1100 → 1050, 토요일 1200, 일요일 1300과 공휴일 1400 → 1350
    expect(ridership?.weekday.alighting[0]).toBe(1050);
    expect(ridership?.saturday.alighting[0]).toBe(1200);
    expect(ridership?.sunday.alighting[0]).toBe(1350);
    expect(ridership?.weekday.boarding[3]).toBe(503);
  });

  it("다른 호선 행을 섞지 않는다", () => {
    expect(station("사당")).toBeUndefined();
  });

  it("원본별 기준 기간을 적는다", () => {
    expect(refined().periods).toEqual({
      ridership: { start: "2024-03-04", end: "2024-04-10" },
      congestion: "2026-06",
      transfer: "2026-06",
      fastExit: "2024-12-31",
    });
  });

  it("혼잡도 30분 값을 1시간 시간대로 합치고 2호선 내선을 하행(down)에 맞춘다", () => {
    const down = stop("시청").congestion.down?.weekday;
    // 5시30분 = 0 → 06시 이전, 6시00분·6시30분 = 10·20 → 06~07시 15, 00시00분·00시30분 = 370·380 → 24시 이후 375
    expect(down?.[0]).toBe(0);
    expect(down?.[1]).toBe(15);
    expect(down?.[19]).toBe(375);
    expect(stop("시청").congestion.up?.sunday[5]).toBe(50);
  });

  it("빠른하차 2호선 하행을 down, 상행을 up에 넣는다", () => {
    const { fastExit } = stop("시청");
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

  it("노선 수 표에 없는 환승역이 있으면 멈춘다", () => {
    expect(() => refine(fixtureRawSources(), { ...FIXTURE_CONFIG, transferLineCounts: { 시청: 2 } })).toThrow(
      /을지로3가/,
    );
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
    const config = { ...FIXTURE_CONFIG, routes: [{ ...route, codes: [...route.codes, "299"] }] };
    expect(() => refine(fixtureRawSources(), config)).toThrow(/299/);
  });
});
