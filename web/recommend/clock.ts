import type { DayType } from "@shared/refined-data";

/**
 * clockOf — 화면 훅이 구한 현재 시각(`Date`)을 추천 입력(출발 시각, 요일유형)으로 바꾼다. `web/hooks/use-seat-finder.ts`가 부른다.
 * 추천 모듈은 시계를 직접 읽지 않으므로 `Date`를 인자로 받는다. **공휴일은 아직 반영하지 않는다** — 공휴일 목록은 #4.
 */
export function clockOf(date: Date): { departMinute: number; dayType: DayType } {
  const weekday = date.getDay();
  const dayType: DayType = weekday === 0 ? "sunday" : weekday === 6 ? "saturday" : "weekday";
  return { departMinute: date.getHours() * 60 + date.getMinutes(), dayType };
}
