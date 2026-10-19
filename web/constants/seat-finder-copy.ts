import type { RecommendError } from "@web/recommend/recommend";

/**
 * 결과 화면 문구. **칸 차이 작음·바로 앉음·데이터 없는 역·추천할 수 없음은 자리표시 문구다**(스펙 #2 "화면") — #8에서 정해 바꾼다.
 * 문구는 CONTEXT.md 용어를 따른다("량"·"착석 확률" 쓰지 않음). 앉을 가능성은 퍼센트로 쓰지 않는다.
 */

export const GRADE_LABEL = { high: "높음", mid: "보통", low: "낮음" } as const;
export const GRADE_PIPS = { high: 3, mid: 2, low: 1 } as const;

export const DAY_TYPE_LABEL = { weekday: "평일", saturday: "토요일", sunday: "일요일·공휴일" } as const;

export const ERROR_TEXT: Record<RecommendError, string> = {
  sameStation: "출발역과 도착역이 같아요.",
  noCommonRoute: "갈아타야 하는 구간이에요. 같은 노선 안의 역만 고를 수 있어요.",
  noStopsToScore: "중간 역이 없거나 데이터가 없어 추천할 수 없어요.",
};

export const SHEET_TITLE = { from: "출발역", to: "도착역", dayType: "요일유형", time: "출발 시각" } as const;

export const WEAK_GAP_TEXT = "칸 차이가 작아요. 어느 칸이든 비슷해요.";
export const CAN_SIT_TEXT = "출발역에서 바로 앉을 수 있을 만큼 한산해요.";
export const missingStationsText = (names: string[]) => `데이터가 없어 계산에서 뺀 역: ${names.join(", ")}`;
export const stationNotFoundText = (query: string) =>
  `"${query}" 역을 찾지 못했어요. 지금은 서울교통공사 1~8호선 역만 고를 수 있어요.`;
export const LOAD_FAILED_TEXT = "데이터를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.";
