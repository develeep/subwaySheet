import type { RawSources, RefineConfig } from "../refine";

/**
 * 배치 테스트 픽스처 — 2호선 본선 앞쪽 4개 역(시청~을지로4가)만 담은 작은 원본.
 * 정상 행과 함께 칸 번호 형식 이상, 칸 수 초과, 엘리베이터뿐인 역(을지로3가), 계단 없이 에스컬레이터가 있는 역(을지로4가 하행),
 * 한 방향이 없는 역(을지로4가 상행),
 * 다른 호선 행, 공휴일 날짜를 넣었다. 계약 테스트(`batch/contract.test.ts`)도 이 픽스처를 쓴다.
 */

export const FIXTURE_CONFIG: RefineConfig = {
  routes: [
    {
      id: "2-main",
      lineNumber: 2,
      name: "2호선",
      carCount: 10,
      isLoop: true,
      codes: ["201", "202", "203", "204"],
    },
  ],
  transferLineCounts: { 시청: 2, 을지로3가: 2 },
};

const STATIONS = [
  ["201", "시청"],
  ["202", "을지로입구"],
  ["203", "을지로3가"],
  ["204", "을지로4가(DDP)"],
] as const;

// 평일 2일(03-04, 03-05), 토요일 1일, 일요일 1일 + 평일 공휴일 1일(04-10 총선).
const DATES = ["2024-03-04", "2024-03-05", "2024-03-09", "2024-03-10", "2024-04-10"];

const slots = (base: number) => Array.from({ length: 20 }, (_, i) => base + i);

function ridershipCsv(): string {
  const header =
    "연번,수송일자,호선,역번호,역명,승하차구분,06시이전,06-07시간대,07-08시간대,08-09시간대,09-10시간대,10-11시간대,11-12시간대,12-13시간대,13-14시간대,14-15시간대,15-16시간대,16-17시간대,17-18시간대,18-19시간대,19-20시간대,20-21시간대,21-22시간대,22-23시간대,23-24시간대,24시이후";
  const rows: string[] = [];
  let seq = 1;
  for (const [dayIndex, ymd] of DATES.entries()) {
    for (const [stationIndex, [code, name]] of STATIONS.entries()) {
      // 하차는 날마다 100씩 늘려서 요일유형별 평균을 확인할 수 있게 한다.
      const off = slots(1000 * (stationIndex + 1) + 100 * dayIndex);
      const on = slots(500 * (stationIndex + 1));
      rows.push([seq++, ymd, "2호선", code, name, "승차", ...on].join(","));
      rows.push([seq++, ymd, "2호선", code, name, "하차", ...off].join(","));
    }
    // 다른 호선 행은 2호선 본선에 섞이지 않아야 한다.
    rows.push([seq++, ymd, "4호선", "426", "사당", "하차", ...slots(9999)].join(","));
  }
  return [header, ...rows].join("\n");
}

const CONGESTION_TIMES = [
  "5시30분",
  ...Array.from({ length: 18 }, (_, i) => [`${i + 6}시00분`, `${i + 6}시30분`]).flat(),
  "00시00분",
  "00시30분",
];

function congestionCsv(): string {
  const header = ["구분", "호선", "역번호", "역명", "상하구분", ...CONGESTION_TIMES].join(",");
  const rows: string[] = [];
  for (const dayLabel of ["평일", "토요일", "일요일"]) {
    for (const [code, name] of STATIONS) {
      for (const side of ["내선", "외선"]) {
        // 내선은 30분마다 10씩, 외선은 모두 50. 원본처럼 값 뒤에 공백을 붙인다.
        const values = CONGESTION_TIMES.map((_, i) => (side === "내선" ? `${(i * 10).toFixed(1)} ` : "50.0 "));
        rows.push([dayLabel, "2호선", code, name.replace(/\(.*\)/, ""), side, ...values].join(","));
      }
    }
  }
  return [header, ...rows].join("\n");
}

function transferCsv(): string {
  return ["연번,출발역명,평일,토요일,일요일", "1,시청,52690,42575,29750", "2,을지로3가,69864,54543,37099"].join("\n");
}

// ponytail: getFstExit 응답 중 배치가 읽는 필드만 둔다(fast-exit.ts itemSchema).
function fastExit(code: string, side: string, door: string, kind: string, crtrYmd = "20241231") {
  return { lineNm: "2호선", stnCd: `0${code}`, crtrYmd, upbdnbSe: side, qckgffVhclDoorNo: door, plfmCmgFac: kind };
}

function fastExitItems(): unknown[] {
  return [
    // 시청: 정상 행
    fastExit("201", "하행", "3-2", "계단"),
    fastExit("201", "하행", "8-1", "에스컬레이터"),
    fastExit("201", "상행", "4-3", "계단"),
    fastExit("201", "상행", "6-1", "엘리베이터", "20241130"),
    // 을지로입구: 형식 이상·칸 수 초과 행은 걸러져야 한다.
    fastExit("202", "하행", "3-2,3-3 사이", "계단"),
    fastExit("202", "하행", "NA-NA", "계단"),
    fastExit("202", "하행", "11-1", "계단"),
    fastExit("202", "하행", "7-4", "계단"),
    fastExit("202", "상행", "4-1", "계단"),
    // 을지로3가: 양방향 엘리베이터뿐
    fastExit("203", "하행", "3-1", "엘리베이터"),
    fastExit("203", "상행", "8-4", "엘리베이터"),
    // 을지로4가: 하행은 계단 없이 에스컬레이터·엘리베이터, 상행은 통째로 없음
    fastExit("204", "하행", "5-2", "에스컬레이터"),
    fastExit("204", "하행", "6-1", "엘리베이터"),
    // 다른 호선은 무시
    { ...fastExit("426", "하행", "1-1", "계단"), lineNm: "4호선" },
  ];
}

export function fixtureRawSources(): RawSources {
  return {
    ridershipCsv: ridershipCsv(),
    congestion: { period: "2026-06", csv: congestionCsv() },
    transfer: { period: "2026-06", csv: transferCsv() },
    fastExitItems: fastExitItems(),
  };
}
