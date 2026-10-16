import type { DayType } from "@shared/refined-data";

/**
 * clockOf — 화면 훅이 구한 현재 시각(`Date`)을 추천 입력(출발 시각, 요일유형)으로 바꾼다. `web/hooks/use-seat-finder.ts`가 부른다.
 * 추천 모듈은 시계를 직접 읽지 않으므로 `Date`를 인자로 받는다. 공휴일은 일요일·공휴일 유형이다(스펙 #2).
 * **목록에 없는 해의 공휴일은 요일로만 정해진다** — 해가 바뀌기 전에 그 해 목록을 더한다.
 */

/** 2026 관공서 공휴일(대체공휴일·지방선거일 포함, 노동절·제헌절은 2026 개정으로 더함). 배치의 2024 목록은 `batch/day-type.ts`. */
const HOLIDAYS = new Set([
  "2026-01-01",
  "2026-02-16",
  "2026-02-17",
  "2026-02-18",
  "2026-03-01",
  "2026-03-02",
  "2026-05-01",
  "2026-05-05",
  "2026-05-24",
  "2026-05-25",
  "2026-06-03",
  "2026-06-06",
  "2026-07-17",
  "2026-08-15",
  "2026-08-17",
  "2026-09-24",
  "2026-09-25",
  "2026-09-26",
  "2026-10-03",
  "2026-10-05",
  "2026-10-09",
  "2026-12-25",
]);

export function clockOf(date: Date): { departMinute: number; dayType: DayType } {
  const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const weekday = date.getDay();
  const dayType: DayType = weekday === 0 || HOLIDAYS.has(ymd) ? "sunday" : weekday === 6 ? "saturday" : "weekday";
  return { departMinute: date.getHours() * 60 + date.getMinutes(), dayType };
}
