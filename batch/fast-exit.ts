import type { Direction, Facility, FacilityKind, FastExitSide } from "@shared/refined-data";
import { z } from "zod";
import { hyphenateDate } from "./day-type";
import { baseStationName, DIRECTION_BY_SIDE, stationKey } from "./station-key";

/**
 * refineFastExit — 빠른하차 `getFstExit` 응답 행을 역·방향별 출입설비 칸 목록과 표시 플래그로 정제한다. `refine`이 부른다.
 * - 칸 번호는 그 행의 방향 기준 번호(`qckgffVhclDoorNo`, "칸-문")를 그대로 쓴다. 0번 칸은 없다(프로토타입 FINDINGS).
 * - 형식 이상("3-2,3-3 사이", "NA-NA")과 노선 칸 수를 넘는 값은 버린다(스펙 #2). 같은 호선에 칸 수가 다른 노선(2호선 지선)이
 *   있어 칸 수는 정차를 만들 때(`toFastExitSide`) 노선마다 따로 거른다.
 * - 방향은 `station-key.ts` DIRECTION_BY_SIDE로 맞춘다(2호선도 상행/하행으로 오고 하행 = down).
 * - 행마다 다음 역(`drtnInfo`)을 남겨, 순서열의 다음 역과 같은 행만 그 정차에 쓴다. 갈래마다 승강장이 다른 역
 *   (5호선 강동 길동·둔촌동 방면, 6호선 응암 새절·역촌 방면, 2호선 성수·신도림의 지선 승강장)을 가르기 위해서다.
 * - 퍼짐 같은 공식 값은 넣지 않는다(ADR 0001). 엘리베이터뿐·한 방향 없음 표시까지만 한다.
 */

const itemSchema = z.object({
  lineNm: z.string(),
  stnCd: z.string(),
  crtrYmd: z.string().regex(/^\d{8}$/),
  upbdnbSe: z.string(),
  qckgffVhclDoorNo: z.string(),
  plfmCmgFac: z.string(),
  drtnInfo: z.string().nullable(),
});

const KINDS: Record<string, FacilityKind> = { 계단: "stairs", 에스컬레이터: "escalator", 엘리베이터: "elevator" };

/** 원본 설비 한 행. `toward`는 다음 역 이름(부기명 뗌)이고 원본에 없으면 null이다. */
type SourceFacility = Facility & { toward: string | null };

export type FastExitResult = {
  /** 키 "호선|역번호" → 방향별 설비. 행이 하나도 없는 역은 키가 없다. */
  byStation: Map<string, Record<Direction, SourceFacility[]>>;
  /** 원본 기준일 중 가장 늦은 날(YYYY-MM-DD). */
  period: string;
};

/** `lineLabels`는 노선에 든 호선(예: "2호선")이다. 노선에 없는 호선 행은 버린다. */
export function refineFastExit(items: unknown[], lineLabels: Set<string>): FastExitResult {
  const byStation = new Map<string, Record<Direction, SourceFacility[]>>();
  let latest = "";
  for (const raw of items) {
    const item = itemSchema.parse(raw);
    if (item.crtrYmd > latest) latest = item.crtrYmd;
    const direction = DIRECTION_BY_SIDE[item.upbdnbSe];
    const kind = KINDS[item.plfmCmgFac];
    const match = /^(\d+)-(\d+)$/.exec(item.qckgffVhclDoorNo);
    if (!lineLabels.has(item.lineNm) || !direction || !kind || !match) continue;
    const car = Number(match[1]);
    const door = Number(match[2]);
    if (car < 1 || door < 1) continue;

    const key = stationKey(item.lineNm, item.stnCd);
    const sides = byStation.get(key) ?? { down: [], up: [] };
    byStation.set(key, sides);
    sides[direction].push({ car, door, kind, toward: item.drtnInfo === null ? null : baseStationName(item.drtnInfo) });
  }
  if (latest === "") throw new Error("빠른하차 행이 없다");
  return { byStation, period: hyphenateDate(latest) };
}

/** 그 정차의 한 방향. 노선 칸 수를 넘는 행과, `nextStation`(순서열의 다음 역)과 다음 역이 다른 행은 버린다. 다음 역이 없는 끝 역은 비운다. */
export function toFastExitSide(
  facilities: SourceFacility[] | undefined,
  nextStation: string | undefined,
  carCount: number,
): FastExitSide {
  const list = (facilities ?? [])
    .filter((f) => f.car <= carCount && nextStation !== undefined && (f.toward === null || f.toward === nextStation))
    .map(({ car, door, kind }) => ({ car, door, kind }))
    .sort((a, b) => a.car - b.car || a.door - b.door);
  return {
    isMissing: list.length === 0,
    isElevatorOnly: list.length > 0 && list.every((f) => f.kind === "elevator"),
    facilities: list,
  };
}
