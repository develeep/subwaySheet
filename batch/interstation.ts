import { parseCsv } from "./csv";
import { baseStationName } from "./station-key";

/**
 * refineInterstation — 역 사이 운행시간(OA-12034 "서울교통공사_역간거리 및 소요시간")을 이웃 역 쌍 → 초로 바꾼다. `refine.ts`가 부른다.
 * 열: 연번, 호선, 역명, 소요시간(mm:ss), 역간거리(km), 호선별누계(km). 한 행의 소요시간은 바로 앞 행 역에서 이 역까지 표준 운행시간이고
 * `00:00`은 새 구간의 시작이다. 방향 구분이 없어 쌍은 순서 없이 찾는다. 원본 조사: docs/research/interstation-time.md.
 */

/** 갈래가 시작되는 행: 앞 행이 아니라 갈라지는 역에서 온 값이다(2024-08-10 파일에서 확인). 키는 "호선|역명". */
const BRANCH_FROM: Readonly<Record<string, string>> = {
  "2|용답": "성수",
  "2|도림천": "신도림",
  "5|둔촌동": "강동",
};

/** 이 원본의 역 이름 → 승하차·혼잡도 원본의 역 이름. */
const RIDERSHIP_NAME: Readonly<Record<string, string>> = { 신내역: "신내" };

/** 부기명·공백을 떼고 옛 이름을 바꾼 뒤(`baseStationName`), 정제 데이터의 역 이름으로 맞춘다. */
const toStationName = (raw: string) => {
  const name = baseStationName(raw);
  return RIDERSHIP_NAME[name] ?? name;
};
const pairKey = (lineNumber: number, a: string, b: string) => `${lineNumber}|${[a, b].sort().join("~")}`;

/** 같은 호선의 두 이웃 역 사이 운행시간(초)을 찾는 함수. 원본에 없으면 undefined. */
export function refineInterstation(csv: string): (lineNumber: number, a: string, b: string) => number | undefined {
  const seconds = new Map<string, number>();
  let previous: { line: number; name: string } | undefined;
  for (const [, lineText = "", rawName = "", time = ""] of parseCsv(csv)) {
    const match = /^(\d{2}):(\d{2})$/.exec(time);
    if (!match) throw new Error(`역 사이 소요시간 형식이 mm:ss가 아니다: ${lineText}호선 ${rawName} ${time}`);
    const line = Number(lineText);
    const name = toStationName(rawName);
    const value = Number(match[1]) * 60 + Number(match[2]);
    const from = BRANCH_FROM[`${line}|${name}`] ?? (previous?.line === line ? previous.name : undefined);
    if (value > 0 && from) seconds.set(pairKey(line, from, name), value);
    previous = { line, name };
  }
  return (lineNumber, a, b) => seconds.get(pairKey(lineNumber, a, b));
}
