/**
 * parseCsv — 공공데이터 CSV 텍스트를 행 배열로 바꾼다(머리 행 제외). 배치 정제 단계들이 부른다.
 * 쓰는 원본(OA-12921·OA-12928·환승인원)에는 따옴표로 감싼 칸이 없어서 쉼표로만 나눈다.
 * **따옴표가 보이면 멈춘다** — 조용히 칸이 밀리는 것보다 낫다.
 */
export function parseCsv(text: string): string[][] {
  if (text.includes('"')) throw new Error("따옴표가 든 CSV는 이 파서로 읽을 수 없다");
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  return lines
    .slice(1)
    .filter((line) => line.trim() !== "")
    .map((line) => line.split(",").map((cell) => cell.trim()));
}
