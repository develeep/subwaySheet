/** 0시부터 센 분(추천 입력의 출발 시각)을 "HH:MM"으로 쓴다. */
export function formatClock(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

/** 시각 입력(`<input type="time">`)의 "HH:MM"을 0시부터 센 분으로 바꾼다. 비었거나 형식이 맞지 않으면 null. */
export function parseClock(text: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(text);
  if (!match) return null;
  const [hour, minute] = [Number(match[1]), Number(match[2])];
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}
