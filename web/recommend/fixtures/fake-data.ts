import type {
  ByDayType,
  Facility,
  FastExitSide,
  RefinedData,
  RouteSequence,
  RouteStop,
  StationData,
} from "@shared/refined-data";

/**
 * 추천 모듈 테스트용 가짜 정제 데이터. 칸 4개짜리 순환 노선 "가~바"(6개 역)와 일반 노선 "사~차"(4개 역)가 있다.
 * 기본값은 모든 역이 고르게 붐비고 고르게 내리는 상태라, 테스트는 바꾸고 싶은 역만 `withStop`·`withStation`으로 고친다.
 */

const LOOP_STATIONS = ["가", "나", "다", "라", "마", "바"];
const LINE_STATIONS = ["사", "아", "자", "차"];

const flat = (value: number) => new Array(20).fill(value);
const byDay = <T>(make: () => T): ByDayType<T> => ({ weekday: make(), saturday: make(), sunday: make() });

/** 계단 하나가 있는 방향. */
export const stairsAt = (car: number): FastExitSide => ({
  isMissing: false,
  isElevatorOnly: false,
  facilities: [{ car, door: 2, kind: "stairs" }],
});

export const elevatorOnlyAt = (facilities: Facility[]): FastExitSide => ({
  isMissing: false,
  isElevatorOnly: true,
  facilities,
});

export const MISSING_SIDE: FastExitSide = { isMissing: true, isElevatorOnly: false, facilities: [] };

function stop(name: string): RouteStop {
  return {
    name,
    // 혼잡도 75% = 칸당 120명. 좌석 54석이라 서 있는 사람이 있다.
    congestion: { down: byDay(() => flat(75)), up: byDay(() => flat(75)) },
    // 계단이 칸 1·4번에 있어 양 끝으로 고르게 내린다.
    fastExit: {
      down: {
        isMissing: false,
        isElevatorOnly: false,
        facilities: [1, 4].map((car) => ({ car, door: 1, kind: "stairs" })),
      },
      up: {
        isMissing: false,
        isElevatorOnly: false,
        facilities: [1, 4].map((car) => ({ car, door: 1, kind: "stairs" })),
      },
    },
  };
}

export function sequence(names: string[], oneWay: RouteSequence["oneWay"] = null): RouteSequence {
  return { oneWay, stops: names.map(stop) };
}

function station(): StationData {
  return { ridership: byDay(() => ({ boarding: flat(100), alighting: flat(100) })), transfer: null };
}

export function fakeData(): RefinedData {
  const names = [...LOOP_STATIONS, ...LINE_STATIONS];
  return {
    periods: {
      ridership: { start: "2024-01-01", end: "2024-12-31" },
      congestion: "2026-06",
      transfer: "2026-06",
      fastExit: "2024-12-31",
    },
    routes: [
      { id: "loop", lineNumber: 2, name: "2호선", carCount: 4, isLoop: true, sequences: [sequence(LOOP_STATIONS)] },
      { id: "line", lineNumber: 7, name: "7호선", carCount: 4, isLoop: false, sequences: [sequence(LINE_STATIONS)] },
    ],
    stations: Object.fromEntries(names.map((name) => [name, station()])),
  };
}

export function withStop(data: RefinedData, name: string, patch: Partial<RouteStop>): RefinedData {
  return {
    ...data,
    routes: data.routes.map((route) => ({
      ...route,
      sequences: route.sequences.map((seq) => ({
        ...seq,
        stops: seq.stops.map((s) => (s.name === name ? { ...s, ...patch } : s)),
      })),
    })),
  };
}

export function withStation(data: RefinedData, name: string, patch: Partial<StationData>): RefinedData {
  const current = data.stations[name];
  if (!current) throw new Error(`${name} 없음`);
  return { ...data, stations: { ...data.stations, [name]: { ...current, ...patch } } };
}

/** 하차 인원을 시간대별로 정한다(나머지 시간대는 0). */
export function alightingAt(slots: Record<number, number>): StationData["ridership"] {
  const values = Array.from({ length: 20 }, (_, i) => slots[i] ?? 0);
  return byDay(() => ({ boarding: flat(0), alighting: values }));
}

export function congestionOf(value: number): RouteStop["congestion"] {
  return { down: byDay(() => flat(value)), up: byDay(() => flat(value)) };
}
