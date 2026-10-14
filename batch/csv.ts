/**
 * parseCsv — 공공데이터 CSV 텍스트를 행 배열로 바꾼다(머리 행 제외). 배치 정제 단계들이 부른다.
 * 쓰는 원본(OA-12921·OA-12928·환승인원)에는 따옴표로 감싼 칸이 없어서 쉼표로만 나눈다.
 * **따옴표가 보이면 멈춘다** — 조용히 칸이 밀리는 것보다 낫다.
 */
export function parseCsv(text: string): string[][] {
  if (text.includes('"')) throw new Error("따옴표가 든 CSV는 이 파서로 읽을 수 없다");
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  return lines
    .slice(1)
    .filter((line) => line.trim() !== "")
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

/** "강변(동서울터미널)" → "강변". 원본마다 부기명 표기가 달라서 괄호 앞만 역 이름으로 쓴다. */
export function baseStationName(name: string): string {
  return name.replace(/\(.*\)/, "").trim();
}

/** 역번호 "0201"·"201"을 같은 값으로 맞춘다. 원본마다 앞자리 0이 다르다. */
export function normalizeCode(code: string): string {
  const trimmed = code.trim().replace(/^0+(?=\d)/, "");
  if (!/^\d+$/.test(trimmed)) throw new Error(`역번호 형식이 숫자가 아니다: ${code}`);
  return trimmed;
}
