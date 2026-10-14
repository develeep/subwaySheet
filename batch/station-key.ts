import type { Direction } from "@shared/refined-data";

/**
 * 원본끼리 역·방향을 맞추는 규칙 — 배치 정제 단계(`ridership.ts`·`congestion.ts`·`fast-exit.ts`·`refine.ts`)가 함께 쓴다.
 * 역은 같은 호선 안의 역번호로 잇는다. 원본마다 역 이름 부기명과 역번호 앞자리 0이 달라서다.
 */

/** 원본끼리 같은 역을 가리키는 키. 예: stationKey("2호선", "0201") === "2호선|201". */
export function stationKey(lineLabel: string, code: string): string {
  return `${lineLabel}|${normalizeCode(code)}`;
}

/** 역번호 "0201"·"201"을 같은 값으로 맞춘다. */
export function normalizeCode(code: string): string {
  const trimmed = code.trim().replace(/^0+(?=\d)/, "");
  if (!/^\d+$/.test(trimmed)) throw new Error(`역번호 형식이 숫자가 아니다: ${code}`);
  return trimmed;
}

/** "강변(동서울터미널)" → "강변". 원본마다 부기명 표기가 달라서 괄호 앞만 역 이름으로 쓴다. */
export function baseStationName(name: string): string {
  return name.replace(/\(.*\)/, "").trim();
}

/**
 * 원본의 방향 값 → 방향. 2호선은 하행 = 역번호 증가 = 혼잡도 내선 = down이고(프로토타입 FINDINGS),
 * 다른 호선은 하행·하선 = down이다. 빠른하차는 상행/하행(가끔 내선/외선), 혼잡도는 내선/외선·상선/하선으로 온다.
 */
export const DIRECTION_BY_SIDE: Readonly<Record<string, Direction>> = {
  하행: "down",
  상행: "up",
  내선: "down",
  외선: "up",
  하선: "down",
  상선: "up",
};
