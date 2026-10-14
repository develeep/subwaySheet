import type { Direction, Facility, FacilityKind, FastExitSide } from "@shared/refined-data";
import { z } from "zod";
import { DIRECTION_BY_SIDE, stationKey } from "./station-key";

/**
 * refineFastExit — 빠른하차 `getFstExit` 응답 행을 역·방향별 출입설비 칸 목록과 표시 플래그로 정제한다. `refine`이 부른다.
 * - 칸 번호는 그 행의 방향 기준 번호(`qckgffVhclDoorNo`, "칸-문")를 그대로 쓴다. 0번 칸은 없다(프로토타입 FINDINGS).
 * - 형식 이상("3-2,3-3 사이", "NA-NA")과 노선 칸 수를 넘는 값은 버린다(스펙 #2).
 * - 방향은 `station-key.ts` DIRECTION_BY_SIDE로 맞춘다(2호선도 상행/하행으로 오고 하행 = down).
 * - 퍼짐 같은 공식 값은 넣지 않는다(ADR 0001). 엘리베이터뿐·한 방향 없음 표시까지만 한다.
 */

const itemSchema = z.object({
  lineNm: z.string(),
  stnCd: z.string(),
  crtrYmd: z.string().regex(/^\d{8}$/),
  upbdnbSe: z.string(),
  qckgffVhclDoorNo: z.string(),
  plfmCmgFac: z.string(),
});

const KINDS: Record<string, FacilityKind> = { 계단: "stairs", 에스컬레이터: "escalator", 엘리베이터: "elevator" };

export type FastExitResult = {
  /** 키 "호선|역번호" → 방향별 설비. 행이 하나도 없는 역은 키가 없다. */
  byStation: Map<string, Record<Direction, Facility[]>>;
  /** 원본 기준일 중 가장 늦은 날(YYYY-MM-DD). */
  period: string;
};

/** `carCounts`는 "호선" → 칸 수다. 노선에 없는 호선 행은 버린다. */
export function refineFastExit(items: unknown[], carCounts: Map<string, number>): FastExitResult {
  const byStation = new Map<string, Record<Direction, Facility[]>>();
  let latest = "";
  for (const raw of items) {
    const item = itemSchema.parse(raw);
    if (item.crtrYmd > latest) latest = item.crtrYmd;
    const carCount = carCounts.get(item.lineNm);
    const direction = DIRECTION_BY_SIDE[item.upbdnbSe];
    const kind = KINDS[item.plfmCmgFac];
    const match = /^(\d+)-(\d+)$/.exec(item.qckgffVhclDoorNo);
    if (carCount === undefined || !direction || !kind || !match) continue;
    const car = Number(match[1]);
    const door = Number(match[2]);
    if (car < 1 || car > carCount || door < 1) continue;

    const key = stationKey(item.lineNm, item.stnCd);
    const sides = byStation.get(key) ?? { down: [], up: [] };
    byStation.set(key, sides);
    sides[direction].push({ car, door, kind });
  }
  if (latest === "") throw new Error("빠른하차 행이 없다");
  return { byStation, period: `${latest.slice(0, 4)}-${latest.slice(4, 6)}-${latest.slice(6, 8)}` };
}

export function toFastExitSide(facilities: Facility[] | undefined): FastExitSide {
  const list = [...(facilities ?? [])].sort((a, b) => a.car - b.car || a.door - b.door);
  return {
    isMissing: list.length === 0,
    isElevatorOnly: list.length > 0 && list.every((f) => f.kind === "elevator"),
    facilities: list,
  };
}
