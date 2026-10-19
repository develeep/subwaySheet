import type { DayType, Direction, Periods, RefinedData, Route, RouteStop } from "@shared/refined-data";
import { type CarScoreResult, scoreCars } from "./car-score";
import { FORMULA_VERSION } from "./formula";

/**
 * recommend — 추천 모듈의 단일 진입점. 화면 훅(`web/hooks/use-seat-finder.ts`)이 부른다.
 * 노선 결정, 방향 기본값, 중간 역, 칸 점수, 앉을 가능성, 화면 규칙(칸 차이 작음·바로 앉음·2등 칸)을 모두 여기서 정한다.
 * **화면은 이 결과를 그리기만 한다**(AGENTS.md). 오류도 같은 결과 형식으로 돌려준다.
 * 노선은 두 역을 함께 담은 순서열에서 구간을 잘라 정한다(스펙 #2 "노선과 구간"). 공통 노선이 여럿이면 `routeChoices`로 알리고
 * 고른 노선이 없으면 정거장 수가 가장 적은 구간을 쓴다. 한 방향 순서열(6호선 응암순환)은 그 방향 구간만 만든다.
 * 현재 시각·오늘 요일유형을 직접 읽지 않는다. 화면 훅이 구해 넘긴다.
 */

export type RecommendInput = {
  from: string;
  to: string;
  dayType: DayType;
  /** 출발 시각(0시부터 분). */
  departMinute: number;
  /** 사용자가 고른 노선(노선 칩). 없거나 두 역을 함께 지나지 않으면 정거장 수가 가장 적은 노선을 쓴다. */
  routeId?: string;
  /** 사용자가 고른 방향. 없거나 순환이 아닌 노선이면 기본값을 쓴다. */
  direction?: Direction;
};

export type RecommendError = "sameStation" | "noCommonRoute" | "noStopsToScore";

type RouteSummary = { id: string; lineNumber: number; name: string; carCount: number };

export type RecommendSuccess = {
  status: "ok";
  route: RouteSummary;
  /** 출발역과 도착역을 함께 지나는 노선(데이터 순서). 둘 이상이면 화면이 노선 칩으로 보여 준다. */
  routeChoices: RouteSummary[];
  dayType: DayType;
  direction: Direction;
  /** 바꿀 수 있는 반대 방향. 순환 노선만 있고, 아니면 null(방향 바꾸기 없음). */
  oppositeDirection: Direction | null;
  /** "○○ 방면"의 ○○. 진행 방향 다음 역이다(빠른하차 drtnInfo·승강장 바닥 표기와 같다). */
  towardStation: string;
  /** 중간 역(출발·도착역 제외). */
  middleStations: string[];
  /** 출발역부터 도착역까지 정거장 수. */
  stopCount: number;
  periods: Periods;
  formulaVersion: string;
} & CarScoreResult;

export type RecommendResult = RecommendSuccess | { status: "error"; error: RecommendError };

/** 한 노선의 한 순서열에서 자른 구간. stops는 탈 순서(처음 = 출발역, 끝 = 도착역)다. */
type Segment = { route: Route; direction: Direction; stops: RouteStop[] };

export function recommend(input: RecommendInput, data: RefinedData): RecommendResult {
  if (input.from === input.to) return { status: "error", error: "sameStation" };
  const segments = data.routes.flatMap((route) => segmentsOf(route, input.from, input.to));
  const commonRoutes = data.routes.filter((route) => segments.some((s) => s.route === route));
  if (commonRoutes.length === 0) return { status: "error", error: "noCommonRoute" };

  const segment = pickSegment(segments, input);
  const { route, direction, stops } = segment;
  const score = scoreCars({
    carCount: route.carCount,
    stops,
    direction,
    dayType: input.dayType,
    departMinute: input.departMinute,
    stations: data.stations,
    routeCounts: routeCountsOf(data),
  });
  if (!score) return { status: "error", error: "noStopsToScore" };

  return {
    status: "ok",
    route: summaryOf(route),
    routeChoices: commonRoutes.map(summaryOf),
    dayType: input.dayType,
    direction,
    oppositeDirection: route.isLoop ? (direction === "down" ? "up" : "down") : null,
    towardStation: stops[1]?.name ?? "",
    middleStations: stops.slice(1, -1).map((s) => s.name),
    stopCount: stops.length - 1,
    ...score,
    periods: data.periods,
    formulaVersion: FORMULA_VERSION,
  };
}

export type StationOption = { name: string; lineNumbers: number[] };

/** 고를 수 있는 역(노선 순서, 중복 없음)과 그 역을 지나는 호선. 화면의 역 자동완성 목록이다. */
export function stationOptions(data: RefinedData): StationOption[] {
  const byName = new Map<string, Set<number>>();
  for (const route of data.routes) {
    for (const stop of route.sequences.flatMap((s) => s.stops)) {
      byName.set(stop.name, (byName.get(stop.name) ?? new Set()).add(route.lineNumber));
    }
  }
  return [...byName].map(([name, lines]) => ({ name, lineNumbers: [...lines].sort((a, b) => a - b) }));
}

/** 역 이름 → 그 역에 데이터 있는 정차로 서는 노선 수. 승하차는 데이터 있는 호선만 더한 역 합계라(`batch/ridership.ts`) 데이터 없는 정차는 세지 않는다. */
function routeCountsOf(data: RefinedData): Map<string, number> {
  const counts = new Map<string, number>();
  for (const route of data.routes) {
    const stops = route.sequences.flatMap((s) => s.stops).filter((stop) => !stop.isDataless);
    for (const name of new Set(stops.map((stop) => stop.name))) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return counts;
}

const summaryOf = (route: Route): RouteSummary => ({
  id: route.id,
  lineNumber: route.lineNumber,
  name: route.name,
  carCount: route.carCount,
});

/** 노선의 순서열마다 두 역을 담으면 탈 수 있는 구간을 만든다. 순환 노선은 두 방향 다, 한 방향 순서열은 그 방향만. */
function segmentsOf(route: Route, from: string, to: string): Segment[] {
  const segments: Segment[] = [];
  for (const sequence of route.sequences) {
    const fromIndex = sequence.stops.findIndex((s) => s.name === from);
    const toIndex = sequence.stops.findIndex((s) => s.name === to);
    if (fromIndex < 0 || toIndex < 0) continue;
    const directions: Direction[] = route.isLoop ? ["down", "up"] : [toIndex > fromIndex ? "down" : "up"];
    for (const direction of directions) {
      if (sequence.oneWay && sequence.oneWay !== direction) continue;
      segments.push({ route, direction, stops: walk(sequence.stops, fromIndex, toIndex, direction) });
    }
  }
  return segments;
}

/** 출발역부터 도착역까지 방향대로 걷는다. 순환 노선은 끝에서 처음으로 이어진다(순환이 아니면 넘어갈 일이 없다). */
function walk(stops: RouteStop[], from: number, to: number, direction: Direction): RouteStop[] {
  const count = stops.length;
  const step = direction === "down" ? 1 : -1;
  const walked = [stops[from] as RouteStop];
  for (let i = from; i !== to; ) {
    i = (i + step + count) % count;
    walked.push(stops[i] as RouteStop);
  }
  return walked;
}

/** 고른 노선(없으면 전부)·고른 방향(순환 노선만) 안에서 정거장 수가 가장 적은 구간. 같으면 앞의 것(하행 먼저)이다. */
function pickSegment(segments: Segment[], input: RecommendInput): Segment {
  const ofRoute = segments.filter((s) => s.route.id === input.routeId);
  const pool = ofRoute.length > 0 ? ofRoute : segments;
  const ofDirection = pool.filter((s) => s.route.isLoop && s.direction === input.direction);
  const candidates = ofDirection.length > 0 ? ofDirection : pool;
  return candidates.reduce((best, s) => (s.stops.length < best.stops.length ? s : best));
}
