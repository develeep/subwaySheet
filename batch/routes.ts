import type { RefineConfig, StopDefinition } from "./refine";

/**
 * 배치 노선 설정 — `batch/main.ts`가 `refine`에 넘긴다. 손으로 관리하는 표다.
 * 서울교통공사 1~8호선 중 승하차·혼잡도가 있는 구간만 둔다(#6). 데이터 없는 역과 코레일 구간은 #10에서 더한다.
 * 순서열은 하행(down) 순서의 역번호다. 하행은 빠른하차 `drtnInfo`(다음 역)로 확인했다:
 * 1호선은 청량리 → 서울역(역번호 감소), 성수지선은 신설동 → 성수, 신정지선은 신도림 → 까치산, 6호선 순환은 응암 → 역촌 → … → 구산.
 * 혼잡도는 2호선 내선·다른 호선 하선이 하행이다(종착역의 빈 방향으로 확인, `station-key.ts` DIRECTION_BY_SIDE).
 * 칸 수 근거: docs/research/data-coverage.md "편성당 칸 수".
 */

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i));

/** 6호선 응암순환을 상행 전용 순서열로 탈 때: 순환 구간 열차는 실제로 하행으로 달리므로 하행 값을 `up` 칸에 읽는다. */
const ridingLoopUp = (code: string): StopDefinition => ({ code, up: { congestionSide: "down", fastExitSide: "down" } });

// 6호선 순환 구간(응암 다음 역부터, 도는 순서)과 본선(응암 → 신내).
const EUNGAM_LOOP = range(2612, 2616);
const LINE_6_MAIN = ["2611", ...range(2617, 2649)];
// 5호선 방화 → 천호. 강동에서 하남검단산 방면과 마천 방면으로 갈라진다.
const LINE_5_TRUNK = range(2511, 2548);

export const ROUTE_CONFIG: RefineConfig = {
  routes: [
    {
      id: "1",
      lineNumber: 1,
      name: "1호선",
      carCount: 10,
      isLoop: false,
      // 동묘앞(159)은 나중에 생긴 역이라 동대문과 신설동 사이에 온다.
      sequences: [{ stops: ["158", "157", "156", "159", "155", "154", "153", "152", "151", "150"] }],
    },
    {
      id: "2-main",
      lineNumber: 2,
      name: "2호선",
      carCount: 10,
      isLoop: true,
      // 역번호 201(시청)~243(충정로)이 하행 = 내선 순서다(프로토타입 FINDINGS).
      // 성수 외선 혼잡도는 211 행이 비어 있고 특수 행 9001(성수E)에 있다.
      sequences: [
        { stops: range(201, 243).map((code) => (code === "211" ? { code, up: { congestionCode: "9001" } } : code)) },
      ],
    },
    {
      id: "2-seongsu",
      lineNumber: 2,
      name: "2호선 성수지선",
      carCount: 4,
      isLoop: false,
      // 용두(250)는 신설동과 신답 사이에 온다. 지선 성수 승강장 혼잡도는 특수 행 9002다.
      sequences: [
        {
          stops: [
            "246",
            "250",
            "245",
            "244",
            { code: "211", down: { congestionCode: "9002" }, up: { congestionCode: "9002" } },
          ],
        },
      ],
    },
    {
      id: "2-sinjeong",
      lineNumber: 2,
      name: "2호선 신정지선",
      carCount: 6,
      isLoop: false,
      // 지선 신도림 승강장 혼잡도는 특수 행 9003이다. 까치산(260)은 2호선 승하차 행이 없어 5호선 까치산 승하차를 쓴다.
      sequences: [
        {
          stops: [
            { code: "234", down: { congestionCode: "9003" }, up: { congestionCode: "9003" } },
            "247",
            "248",
            "249",
            "260",
          ],
        },
      ],
    },
    { id: "3", lineNumber: 3, name: "3호선", carCount: 10, isLoop: false, sequences: [{ stops: range(309, 342) }] },
    // 409 불암산은 승하차 원본에서 옛 이름 당고개다(`station-key.ts` RENAMED_STATIONS).
    { id: "4", lineNumber: 4, name: "4호선", carCount: 10, isLoop: false, sequences: [{ stops: range(409, 434) }] },
    {
      id: "5",
      lineNumber: 5,
      name: "5호선",
      carCount: 8,
      isLoop: false,
      // 강동 하행 혼잡도는 하남검단산 방면이 2549(강동(하남검단산)), 마천 방면이 특수 행 9005(강동(마천))다.
      sequences: [
        { stops: [...LINE_5_TRUNK, "2549", ...range(2550, 2554), ...range(2562, 2566)] },
        { stops: [...LINE_5_TRUNK, { code: "2549", down: { congestionCode: "9005" } }, ...range(2555, 2561)] },
      ],
    },
    {
      id: "6",
      lineNumber: 6,
      name: "6호선",
      carCount: 8,
      isLoop: false,
      // 응암순환은 응암 → 역촌 → … → 구산 → 응암 한 방향으로만 돈다. 순환 구간에서 타면 응암을 지나 신내 방면(하행)으로,
      // 신내 방면에서 오면 응암을 지나 순환 구간(상행 전용 순서열을 거꾸로)으로 간다. 순환으로 들어가는 응암 혼잡도는 특수 행 9006(응암S)이다.
      sequences: [
        { oneWay: "down", stops: [...EUNGAM_LOOP, ...LINE_6_MAIN] },
        {
          oneWay: "up",
          stops: [
            ...[...EUNGAM_LOOP].reverse().map(ridingLoopUp),
            { code: "2611", up: { congestionCode: "9006", congestionSide: "down" } },
            ...LINE_6_MAIN.slice(1),
          ],
        },
      ],
    },
    { id: "7", lineNumber: 7, name: "7호선", carCount: 8, isLoop: false, sequences: [{ stops: range(2711, 2752) }] },
    {
      id: "8",
      lineNumber: 8,
      name: "8호선",
      carCount: 6,
      isLoop: false,
      // 남위례(2828)는 복정과 산성 사이에 온다.
      sequences: [{ stops: [...range(2810, 2821), "2828", ...range(2822, 2827)] }],
    },
  ],
  // 그 역에서 만나는 노선 수(코레일·민자 노선과 같은 호선의 지선 포함). 환승인원(역 합계)을 노선 몫으로 나눌 때 쓴다.
  // 서울시 OA-15442(노선별 지하철역 정보)에서 같은 이름 역의 노선을 셌고, 2호선 지선(성수·신도림·신설동·까치산)은 따로 셌다.
  // 총신대입구는 7호선 이수와 같은 역이라 2다(이름이 달라 7호선 쪽에는 환승인원이 붙지 않는다).
  // 강동은 5호선 갈래끼리 갈아타는 역이라 1이다. 환승인원 원본에 있는데 여기 없는 역은 배치가 멈춘다.
  transferLineCounts: {
    가락시장: 2,
    가산디지털단지: 2,
    강남: 2,
    강남구청: 2,
    강동: 1,
    건대입구: 2,
    고속터미널: 3,
    공덕: 4,
    교대: 2,
    군자: 2,
    김포공항: 5,
    까치산: 2,
    노원: 2,
    논현: 2,
    당산: 2,
    대림: 2,
    도곡: 2,
    도봉산: 2,
    동대문: 2,
    동대문역사문화공원: 3,
    동묘앞: 2,
    동작: 2,
    디지털미디어시티: 3,
    모란: 2,
    보라매: 2,
    보문: 2,
    복정: 2,
    불광: 2,
    사당: 2,
    삼각지: 2,
    상봉: 3,
    서울역: 4,
    석계: 2,
    석촌: 2,
    선릉: 2,
    성수: 2,
    성신여대입구: 2,
    수서: 3,
    시청: 2,
    신길: 2,
    신내: 2,
    신당: 2,
    신도림: 3,
    신림: 2,
    신사: 2,
    신설동: 3,
    약수: 2,
    양재: 2,
    여의도: 2,
    연신내: 3,
    영등포구청: 2,
    오금: 2,
    옥수: 2,
    온수: 2,
    올림픽공원: 2,
    왕십리: 4,
    을지로3가: 2,
    을지로4가: 2,
    이촌: 2,
    잠실: 2,
    종로3가: 3,
    종합운동장: 2,
    창동: 2,
    천호: 2,
    청구: 2,
    청량리: 4,
    총신대입구: 2,
    충무로: 2,
    충정로: 2,
    태릉입구: 2,
    합정: 2,
    홍대입구: 3,
    효창공원앞: 2,
  },
};
