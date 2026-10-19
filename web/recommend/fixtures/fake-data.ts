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

/** 그 칸들에 계단이 있는 방향. */
export const stairsAt = (...cars: number[]): FastExitSide => ({
  isMissing: false,
  isElevatorOnly: false,
  facilities: cars.map((car) => ({ car, door: 2, kind: "stairs" })),
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
    isDataless: false,
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
    transferCars: { down: [], up: [] },
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

/** 원본이 하나도 없는 정차(코레일 구간 꼴)로 바꾼다. 같은 이름 역의 승하차도 비운다. */
export function asDataless(data: RefinedData, name: string): RefinedData {
  const stopPatch = {
    isDataless: true,
    congestion: { down: null, up: null },
    fastExit: { down: MISSING_SIDE, up: MISSING_SIDE },
  };
  return withStation(withStop(data, name, stopPatch), name, { ridership: null });
}

/** 하차 인원을 시간대별로 정한다(나머지 시간대는 0). */
export function alightingAt(slots: Record<number, number>): StationData["ridership"] {
  const values = Array.from({ length: 20 }, (_, i) => slots[i] ?? 0);
  return byDay(() => ({ boarding: flat(0), alighting: values }));
}

/** 타는 인원을 시간대별로 정한다(나머지 시간대와 하차는 0). */
export function boardingAt(slots: Record<number, number>): StationData["ridership"] {
  const values = Array.from({ length: 20 }, (_, i) => slots[i] ?? 0);
  return byDay(() => ({ boarding: values, alighting: flat(0) }));
}

/** 시간대마다 같은 인원. */
export const everySlot = (value: number) => Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i, value]));

export function congestionOf(value: number): RouteStop["congestion"] {
  return { down: byDay(() => flat(value)), up: byDay(() => flat(value)) };
}
