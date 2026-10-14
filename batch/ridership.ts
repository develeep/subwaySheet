import { DAY_TYPES, type DayType, type StationData, TIME_SLOT_COUNT } from "@shared/refined-data";
import { parseCsv } from "./csv";
import { dayTypeOfYmd } from "./day-type";
import { baseStationName, stationKey } from "./station-key";

/**
 * refineRidership — 승하차 OA-12921(날짜 × 역 × 1시간)을 역·요일유형·시간대별 하루 평균으로 줄인다. `refine`이 부른다.
 * 열: 연번, 수송일자, 호선, 역번호, 역명, 승하차구분, 06시이전 … 24시이후(20칸 = TIME_SLOT_COUNT).
 * 요일유형별 일수는 파일 전체 날짜로 센다(그날 운행이 없던 역도 0으로 평균에 들어간다).
 * **지금은 노선에 든 호선·역번호 행만 쓴다.** 환승역의 호선을 합쳐 역 단위로 쓰는 일은 #6에서 한다.
 */

type Ridership = NonNullable<StationData["ridership"]>;

export type RidershipResult = {
  byStation: Map<string, { name: string; ridership: Ridership }>;
  period: { start: string; end: string };
};

/** `wanted`는 "호선|역번호" 키(예: "2호선|201")다. 결과도 같은 키로 돌려준다. */
export function refineRidership(csv: string, wanted: Set<string>): RidershipResult {
  const sums = new Map<string, { name: string; on: Record<DayType, number[]>; off: Record<DayType, number[]> }>();
  const days: Record<DayType, Set<string>> = { weekday: new Set(), saturday: new Set(), sunday: new Set() };
  let start = "";
  let end = "";

  for (const row of parseCsv(csv)) {
    if (row.length < 6 + TIME_SLOT_COUNT) throw new Error(`승하차 행의 칸 수가 모자란다: ${row.join(",")}`);
    const [, ymd = "", line = "", code = "", name = "", kind = ""] = row;
    const dayType = dayTypeOfYmd(ymd);
    days[dayType].add(ymd);
    if (start === "" || ymd < start) start = ymd;
    if (ymd > end) end = ymd;

    const key = stationKey(line, code);
    if (!wanted.has(key)) continue;
    const acc = sums.get(key) ?? { name: baseStationName(name), on: emptyByDayType(), off: emptyByDayType() };
    sums.set(key, acc);
    const target = kind === "승차" ? acc.on[dayType] : kind === "하차" ? acc.off[dayType] : null;
    if (!target) throw new Error(`승하차구분 값을 모른다: ${kind}`);
    row.slice(6, 6 + TIME_SLOT_COUNT).forEach((value, slot) => {
      target[slot] = (target[slot] ?? 0) + Number(value || 0);
    });
  }

  const byStation = new Map<string, { name: string; ridership: Ridership }>();
  for (const [key, acc] of sums) {
    const average = (values: number[], dayType: DayType) =>
      values.map((v) => (days[dayType].size === 0 ? 0 : Math.round(v / days[dayType].size)));
    const ridership = Object.fromEntries(
      DAY_TYPES.map((dayType) => [
        dayType,
        { boarding: average(acc.on[dayType], dayType), alighting: average(acc.off[dayType], dayType) },
      ]),
    ) as Ridership;
    byStation.set(key, { name: acc.name, ridership });
  }
  return { byStation, period: { start, end } };
}

function emptyByDayType(): Record<DayType, number[]> {
  return {
    weekday: new Array(TIME_SLOT_COUNT).fill(0),
    saturday: new Array(TIME_SLOT_COUNT).fill(0),
    sunday: new Array(TIME_SLOT_COUNT).fill(0),
  };
}
