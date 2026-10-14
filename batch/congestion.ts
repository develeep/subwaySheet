import type { DayType, Direction, RouteStop } from "@shared/refined-data";
import { TIME_SLOT_COUNT } from "@shared/refined-data";
import { baseStationName, normalizeCode, parseCsv } from "./csv";

/**
 * refineCongestion — 혼잡도 OA-12928(30분 단위, 칸당 정원 대비 %)을 역·방향·요일유형별 1시간 시간대로 합친다. `refine`이 부른다.
 * 열: 구분(평일/토요일/일요일), 호선, 역번호, 역명, 상하구분, 5시30분 … 00시30분(39칸).
 * 시간대 0(06시 이전) = 5시30분, 1~18 = 정시·30분 두 값 평균, 19(24시 이후) = 00시 두 값 평균(프로토타입 prep.py와 같다).
 * 방향: 2호선은 내선 = 하행(down) = 역번호 증가(프로토타입 FINDINGS), 다른 호선은 하선 = down.
 * 공휴일 값은 원본에 없어 일요일 값을 쓴다(ADR 0003, 공휴일 처리 미확인).
 */

type Congestion = RouteStop["congestion"];

const DAY_LABELS: Record<string, DayType> = { 평일: "weekday", 토요일: "saturday", 일요일: "sunday" };
const SIDES: Record<string, Direction> = { 내선: "down", 외선: "up", 하선: "down", 상선: "up" };
const TIME_COLUMNS = 1 + 2 * 18 + 2;

/** 결과 키는 "호선|역번호"(예: "2호선|201")다. */
export function refineCongestion(csv: string): Map<string, { name: string; congestion: Congestion }> {
  const result = new Map<string, { name: string; congestion: Congestion }>();
  for (const row of parseCsv(csv)) {
    const [dayLabel = "", line = "", code = "", name = "", side = ""] = row;
    const dayType = DAY_LABELS[dayLabel];
    const direction = SIDES[side];
    if (!dayType || !direction) throw new Error(`혼잡도 구분 값을 모른다: ${dayLabel}, ${side}`);
    const values = row.slice(5, 5 + TIME_COLUMNS).map((v) => Number(v || 0));
    if (values.length !== TIME_COLUMNS) throw new Error(`혼잡도 행의 시간 칸 수가 ${TIME_COLUMNS}이 아니다: ${code}`);

    const key = `${line}|${normalizeCode(code)}`;
    const entry = result.get(key) ?? { name: baseStationName(name), congestion: { down: null, up: null } };
    result.set(key, entry);
    const byDay = entry.congestion[direction] ?? { weekday: zeros(), saturday: zeros(), sunday: zeros() };
    entry.congestion[direction] = { ...byDay, [dayType]: toHourly(values) };
  }
  return result;
}

function toHourly(values: number[]): number[] {
  const at = (i: number) => values[i] ?? 0;
  const hourly = [at(0)];
  for (let hour = 0; hour < 18; hour++) hourly.push(round1((at(1 + 2 * hour) + at(2 + 2 * hour)) / 2));
  hourly.push(round1((at(37) + at(38)) / 2));
  return hourly;
}

const zeros = () => new Array(TIME_SLOT_COUNT).fill(0);
const round1 = (v: number) => Math.round(v * 10) / 10;
