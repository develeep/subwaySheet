import { STOPS_UNTIL_SEATED_CHOICES } from "@web/constants/survey-copy";

/** "다른 칸에 탔어요" 다음에 고를 칸 번호. 추천 칸은 뺀다(설문 함수도 추천 칸을 다른 칸으로 받지 않는다). */
export function otherCarsOf(carCount: number, picks: number[]): number[] {
  return Array.from({ length: carCount }, (_, i) => i + 1).filter((car) => !picks.includes(car));
}

/** 몇 정거장 뒤에 앉았는지 버튼. 시작값이 구간 정거장 수 이상이면 그 구간에서 고를 수 없는 답이라 숨긴다. */
export function stopChoicesOf(stopCount: number) {
  return STOPS_UNTIL_SEATED_CHOICES.filter((choice) => choice.stops < stopCount);
}
