/** 0시부터 센 분(추천 입력의 출발 시각)을 "HH:MM"으로 쓴다. */
export function formatClock(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
