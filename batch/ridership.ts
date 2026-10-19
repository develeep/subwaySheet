import { type DayType, type StationData, TIME_SLOT_COUNT } from "@shared/refined-data";
import { parseCsv } from "./csv";
import { dayTypeOfYmd, mapDayTypes } from "./day-type";
import { baseStationName, stationKey } from "./station-key";

/**
 * refineRidership — 승하차 OA-12921(날짜 × 역 × 1시간)을 역·요일유형·시간대별 하루 평균으로 줄인다. `refine`이 부른다.
 * 열: 연번, 수송일자, 호선, 역번호, 역명, 승하차구분, 06시이전 … 24시이후(20칸 = TIME_SLOT_COUNT).
 * 요일유형별 일수는 파일 전체 날짜로 센다(그날 운행이 없던 역도 0으로 평균에 들어간다).
 * **환승역은 호선을 합쳐 역 이름 단위로 쓴다**(스펙 #2). 카드 승하차가 한 호선에 몰려 집계되는 역이 있어서다
 * (3호선 충무로·6호선 연신내 행은 없고 4호선·3호선 행에 모두 들어 있다). 노선에 든 호선의 행만 더한다.
 */

type Ridership = NonNullable<StationData["ridership"]>;

export type RidershipResult = {
  /** 역 이름(부기명 뗌, 현재 이름) → 호선을 합친 승하차. */
  byName: Map<string, Ridership>;
  /** "호선|역번호" 키(예: "2호선|201") → 역 이름. 승하차 행이 있는 역만 있다. */
  nameByKey: Map<string, string>;
  period: { start: string; end: string };
};

/** `lineLabels`는 더할 호선(예: "2호선")이다. */
export function refineRidership(csv: string, lineLabels: Set<string>): RidershipResult {
  const sums = new Map<string, { boarding: Record<DayType, number[]>; alighting: Record<DayType, number[]> }>();
  const nameByKey = new Map<string, string>();
  const days = mapDayTypes(() => new Set<string>());
  let start = "";
  let end = "";

  for (const row of parseCsv(csv)) {
    if (row.length < 6 + TIME_SLOT_COUNT) throw new Error(`승하차 행의 칸 수가 모자란다: ${row.join(",")}`);
    const [, ymd = "", line = "", code = "", name = "", kind = ""] = row;
    const dayType = dayTypeOfYmd(ymd);
    days[dayType].add(ymd);
    if (start === "" || ymd < start) start = ymd;
    if (ymd > end) end = ymd;

    if (!lineLabels.has(line)) continue;
    const stationName = baseStationName(name);
    nameByKey.set(stationKey(line, code), stationName);
    const acc = sums.get(stationName) ?? { boarding: zerosByDayType(), alighting: zerosByDayType() };
    sums.set(stationName, acc);
    const target = kind === "승차" ? acc.boarding[dayType] : kind === "하차" ? acc.alighting[dayType] : null;
    if (!target) throw new Error(`승하차구분 값을 모른다: ${kind}`);
    row.slice(6, 6 + TIME_SLOT_COUNT).forEach((value, slot) => {
      target[slot] = (target[slot] ?? 0) + Number(value || 0);
    });
  }

  const byName = new Map<string, Ridership>();
  for (const [name, acc] of sums) {
    const average = (values: number[], dayType: DayType) =>
      values.map((v) => (days[dayType].size === 0 ? 0 : Math.round(v / days[dayType].size)));
    const ridership = mapDayTypes((dayType) => ({
      boarding: average(acc.boarding[dayType], dayType),
      alighting: average(acc.alighting[dayType], dayType),
    }));
    byName.set(name, ridership);
  }
  return { byName, nameByKey, period: { start, end } };
}

const zerosByDayType = () => mapDayTypes(() => new Array<number>(TIME_SLOT_COUNT).fill(0));
