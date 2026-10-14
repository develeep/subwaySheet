import type { DayType, Direction, Periods, RefinedData, Route } from "@shared/refined-data";
import { type Grade, scoreCars } from "./car-score";
import { FORMULA_VERSION } from "./formula";

/**
 * recommend — 추천 모듈의 단일 진입점. 화면 훅(`web/route-picker/use-route-picker.ts`)이 부른다.
 * 노선 결정, 방향 기본값, 중간 역, 칸 점수, 앉을 가능성, 화면 규칙(칸 차이 작음·바로 앉음·2등 칸)을 모두 여기서 정한다.
 * **화면은 이 결과를 그리기만 한다**(AGENTS.md). 오류도 같은 결과 형식으로 돌려준다.
 * 현재 시각·오늘 요일유형을 직접 읽지 않는다. 화면 훅이 구해 넘긴다.
 */

export type RecommendInput = {
  from: string;
  to: string;
  dayType: DayType;
  /** 출발 시각(0시부터 분). */
  departMinute: number;
  /** 사용자가 고른 방향. 없거나 순환이 아닌 노선이면 기본값을 쓴다. */
  direction?: Direction;
};

export type RecommendError = "sameStation" | "noCommonRoute" | "noStopsToScore";

export type RecommendSuccess = {
  status: "ok";
  route: { id: string; lineNumber: number; name: string; carCount: number };
  direction: Direction;
  isDefaultDirection: boolean;
  /** "○○ 방면"의 ○○. 진행 방향 다음 역이다(빠른하차 drtnInfo·승강장 바닥 표기와 같다). */
  towardStation: string;
  /** 중간 역(출발·도착역 제외). */
  stops: string[];
  /** 출발역부터 도착역까지 정거장 수. */
  stopCount: number;
  /** 추천 칸 번호(1부터, 그 방향 승강장 번호의 앞자리). 1등 칸이 먼저다. */
  picks: number[];
  grade: Grade;
  reason: { station: string; stopsAfter: number };
  missingStations: string[];
  evenlySpreadStations: string[];
  isWeakGap: boolean;
  canSitAtOrigin: boolean;
  periods: Periods;
  formulaVersion: string;
};

export type RecommendResult = RecommendSuccess | { status: "error"; error: RecommendError };

export function recommend(input: RecommendInput, data: RefinedData): RecommendResult {
  if (input.from === input.to) return { status: "error", error: "sameStation" };
  const route = data.routes.find((r) => hasStation(r, input.from) && hasStation(r, input.to));
  if (!route) return { status: "error", error: "noCommonRoute" };

  const fromIndex = route.stops.findIndex((s) => s.name === input.from);
  const toIndex = route.stops.findIndex((s) => s.name === input.to);
  const defaultDirection = defaultDirectionOf(route, fromIndex, toIndex);
  const direction = route.isLoop && input.direction ? input.direction : defaultDirection;
  const path = walk(route, fromIndex, toIndex, direction);

  const score = scoreCars({
    route,
    path,
    direction,
    dayType: input.dayType,
    departMinute: input.departMinute,
    stations: data.stations,
  });
  if (!score) return { status: "error", error: "noStopsToScore" };

  const nameAt = (index: number | undefined) => route.stops[index ?? -1]?.name ?? "";
  return {
    status: "ok",
    route: { id: route.id, lineNumber: route.lineNumber, name: route.name, carCount: route.carCount },
    direction,
    isDefaultDirection: direction === defaultDirection,
    towardStation: nameAt(path[1]),
    stops: path.slice(1, -1).map(nameAt),
    stopCount: path.length - 1,
    ...score,
    periods: data.periods,
    formulaVersion: FORMULA_VERSION,
  };
}

/** 고를 수 있는 역 이름(노선 순서, 중복 없음). 화면의 역 자동완성 목록이다. */
export function stationNames(data: RefinedData): string[] {
  return [...new Set(data.routes.flatMap((route) => route.stops.map((s) => s.name)))];
}

function hasStation(route: Route, name: string): boolean {
  return route.stops.some((s) => s.name === name);
}

/** 순환 노선은 정거장 수가 적은 쪽(같으면 하행), 아니면 역 순서대로. */
function defaultDirectionOf(route: Route, from: number, to: number): Direction {
  if (!route.isLoop) return to > from ? "down" : "up";
  const count = route.stops.length;
  const downStops = (to - from + count) % count;
  return downStops <= count - downStops ? "down" : "up";
}

function walk(route: Route, from: number, to: number, direction: Direction): number[] {
  const count = route.stops.length;
  const step = direction === "down" ? 1 : -1;
  const path = [from];
  for (let i = from; i !== to; ) {
    i = (i + step + count) % count;
    path.push(i);
  }
  return path;
}
