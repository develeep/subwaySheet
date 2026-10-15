import { DAY_TYPES, type DayType, type RouteStop } from "@shared/refined-data";
import { parseCsv } from "./csv";
import { mapDayTypes } from "./day-type";
import { baseStationName, DIRECTION_BY_SIDE, stationKey } from "./station-key";

/**
 * refineCongestion — 혼잡도 OA-12928(30분 단위, 칸당 정원 대비 %)을 역·방향·요일유형별 1시간 시간대로 합친다. `refine`이 부른다.
 * 열: 구분(평일/토요일/일요일), 호선, 역번호, 역명, 상하구분, 5시30분 … 00시30분(39칸).
 * 시간대 0(06시 이전) = 5시30분, 1~18 = 정시·30분 두 값 평균, 19(24시 이후) = 00시 두 값 평균(프로토타입 prep.py와 같다).
 * 방향은 `station-key.ts` DIRECTION_BY_SIDE로 맞춘다(2호선 내선 = down).
 * 공휴일 값은 원본에 없어 일요일 값을 쓴다(ADR 0003, 공휴일 처리 미확인).
 */

type Congestion = RouteStop["congestion"];
type PartialByDay = Partial<Record<DayType, number[]>>;

const DAY_LABELS: Record<string, DayType> = { 평일: "weekday", 토요일: "saturday", 일요일: "sunday" };
/** 06시~24시 앞까지 정시·30분 값 쌍의 개수(06~07시 … 23~24시). */
const HOURS_IN_PAIRS = 18;
/** 5시30분 하나 + 정시·30분 쌍 + 00시00분·00시30분. */
const TIME_COLUMNS = 1 + 2 * HOURS_IN_PAIRS + 2;
const MIDNIGHT_COLUMNS = [TIME_COLUMNS - 2, TIME_COLUMNS - 1] as const;

/** 결과 키는 `stationKey`(예: "2호선|201")다. 한 방향에 요일유형 셋이 다 있어야 하고, 빠지면 멈춘다(0으로 채우지 않는다). */
export function refineCongestion(csv: string): Map<string, { name: string; congestion: Congestion }> {
  const partial = new Map<string, { name: string; down: PartialByDay | null; up: PartialByDay | null }>();
  for (const row of parseCsv(csv)) {
    const [dayLabel = "", line = "", code = "", name = "", sideLabel = ""] = row;
    const dayType = DAY_LABELS[dayLabel];
    const direction = DIRECTION_BY_SIDE[sideLabel];
    if (!dayType || !direction) throw new Error(`혼잡도 구분 값을 모른다: ${dayLabel}, ${sideLabel}`);
    const values = row.slice(5, 5 + TIME_COLUMNS).map((v) => Number(v || 0));
    if (values.length !== TIME_COLUMNS) throw new Error(`혼잡도 행의 시간 칸 수가 ${TIME_COLUMNS}이 아니다: ${code}`);

    const key = stationKey(line, code);
    const entry = partial.get(key) ?? { name: baseStationName(name), down: null, up: null };
    partial.set(key, { ...entry, [direction]: { ...entry[direction], [dayType]: toHourly(values) } });
  }

  const result = new Map<string, { name: string; congestion: Congestion }>();
  for (const [key, entry] of partial) {
    result.set(key, { name: entry.name, congestion: { down: complete(key, entry.down), up: complete(key, entry.up) } });
  }
  return result;
}

function complete(key: string, byDay: PartialByDay | null): Congestion["down"] {
  if (!byDay) return null;
  if (DAY_TYPES.some((dayType) => !byDay[dayType])) throw new Error(`${key} 혼잡도에 빠진 요일유형이 있다`);
  return mapDayTypes((dayType) => byDay[dayType] ?? []);
}

function toHourly(values: number[]): number[] {
  const at = (i: number) => values[i] ?? 0;
  const hourly = [at(0)];
  for (let hour = 0; hour < HOURS_IN_PAIRS; hour++) hourly.push(round1((at(1 + 2 * hour) + at(2 + 2 * hour)) / 2));
  hourly.push(round1((at(MIDNIGHT_COLUMNS[0]) + at(MIDNIGHT_COLUMNS[1])) / 2));
  return hourly;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
