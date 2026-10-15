/**
 * formatJson — 정제 데이터를 git diff로 비교하기 좋게 쓴다(ADR 0002 "달마다 바뀐 내용을 git 이력으로 비교").
 * 객체는 키마다 줄을 나누고, 시간대 값 같은 숫자 배열은 한 줄로 둔다. 그래야 바뀐 역·시간대가 줄 단위로 보인다.
 */
export function formatJson(value: unknown): string {
  const pretty = JSON.stringify(value, null, 2);
  return `${pretty.replace(/\[\s*(-?[\d.e+-]+(?:,\s*-?[\d.e+-]+)*)\s*\]/g, (_, body: string) => `[${body.split(/,\s*/).join(", ")}]`)}\n`;
}
