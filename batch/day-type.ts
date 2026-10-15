import { DAY_TYPES, type DayType } from "@shared/refined-data";

/**
 * 배치의 날짜·요일유형 도우미. dayTypeOfYmd는 날짜(`YYYY-MM-DD`)를 요일유형으로 바꾼다. `ridership.ts`가 승하차 OA-12921의 날짜를 나눌 때 쓴다.
 * 공휴일은 일요일·공휴일 유형으로 묶는다(ADR 0003). **목록에 없는 해의 공휴일은 평일로 잡힌다** —
 * 승하차 원본 연도가 바뀌면 그 해 목록을 더한다. 화면의 오늘 요일유형과 그 공휴일 목록은 #4에서 다룬다.
 */

/** 2024 관공서 공휴일(대체·임시 포함, 프로토타입 prep.py에서 옮김). */
const HOLIDAYS = new Set([
  "2024-01-01",
  "2024-02-09",
  "2024-02-10",
  "2024-02-11",
  "2024-02-12",
  "2024-03-01",
  "2024-04-10",
  "2024-05-05",
  "2024-05-06",
  "2024-05-15",
  "2024-06-06",
  "2024-08-15",
  "2024-09-16",
  "2024-09-17",
  "2024-09-18",
  "2024-10-01",
  "2024-10-03",
  "2024-10-09",
  "2024-12-25",
]);

export function dayTypeOfYmd(ymd: string): DayType {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) throw new Error(`날짜 형식이 YYYY-MM-DD가 아니다: ${ymd}`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error(`없는 날짜다: ${ymd}`);
  if (HOLIDAYS.has(ymd)) return "sunday";
  const weekday = date.getUTCDay();
  if (weekday === 0) return "sunday";
  return weekday === 6 ? "saturday" : "weekday";
}

/** 요일유형마다 값을 만든다. 요일유형 목록은 `DAY_TYPES` 한 곳에서만 나열한다. */
export function mapDayTypes<T>(make: (dayType: DayType, index: number) => T): Record<DayType, T> {
  return Object.fromEntries(DAY_TYPES.map((dayType, i) => [dayType, make(dayType, i)])) as Record<DayType, T>;
}

/** 원본의 "20241231"·"202606"을 "2024-12-31"·"2026-06"으로 쓴다(기준 기간 표기). */
export function hyphenateDate(digits: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})?$/.exec(digits);
  if (!match) throw new Error(`날짜 형식이 YYYYMM(DD)가 아니다: ${digits}`);
  return [match[1], match[2], match[3]].filter(Boolean).join("-");
}
