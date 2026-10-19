import type { RefineConfig, StopDefinition } from "./refine";
import { TRANSFER_PASSAGES } from "./transfer-passages";

/**
 * 배치 노선 설정 — `batch/main.ts`가 `refine`에 넘긴다. 손으로 관리하는 표다.
 * 서울교통공사 1~8호선 노선과, 같은 열차가 다니는 코레일 구간·데이터 없는 역(7호선 부천 구간, 별내선, 진접선)을 둔다(#6, #10).
 * 데이터 없는 역은 원본에 역번호가 없어 이름으로 넣는다(`dataless`). 순서와 이름은 위키백과 각 노선 문서의 역 목록·노선도
 * (2026-10-19 확인)를 따랐고, 개통 예정 역(4호선 풍양·과천정보타운, 1호선 부성·풍기)은 뺐다. 급행은 다루지 않는다(완행 정거장).
 * 순서열은 하행(down) 순서의 역번호다. 하행은 빠른하차 `drtnInfo`(다음 역)로 확인했다:
 * 1호선은 청량리 → 서울역(역번호 감소), 성수지선은 신설동 → 성수, 신정지선은 신도림 → 까치산, 6호선 순환은 응암 → 역촌 → … → 구산.
 * 혼잡도는 2호선 내선·다른 호선 하선이 하행이다(종착역의 빈 방향으로 확인, `station-key.ts` DIRECTION_BY_SIDE).
 * 칸 수 근거: docs/research/data-coverage.md "편성당 칸 수".
 */

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
const dataless = (...names: string[]): StopDefinition[] => names.map((datalessName) => ({ datalessName }));

/** 6호선 응암순환을 상행 전용 순서열로 탈 때: 순환 구간 열차는 실제로 하행으로 달리므로 하행 값을 `up` 칸에 읽는다. */
const ridingLoopUp = (code: string): StopDefinition => ({ code, up: { congestionSide: "down", fastExitSide: "down" } });

// 6호선 순환 구간(응암 다음 역부터, 도는 순서)과 본선(응암 → 신내).
const EUNGAM_LOOP = range(2612, 2616);
const LINE_6_MAIN = ["2611", ...range(2617, 2649)];
// 1호선 코레일 구간. 연천 → 청량리(경원선), 서울역 → 구로(경부선)에서 인천(경인선)·신창(경부선·장항선)으로 갈라지고,
// 병점에서 서동탄, 금천구청에서 광명으로 다시 갈라진다.
const LINE_1_NORTH = [
  ...dataless("연천", "전곡", "청산", "소요산", "동두천", "보산", "동두천중앙", "지행", "덕정"),
  ...dataless("덕계", "양주", "녹양", "가능", "의정부", "회룡", "망월사", "도봉산", "도봉"),
  ...dataless("방학", "창동", "녹천", "월계", "광운대", "석계", "신이문", "외대앞", "회기"),
];
// 동묘앞(159)은 나중에 생긴 역이라 동대문과 신설동 사이에 온다.
const LINE_1_SEOUL = ["158", "157", "156", "159", "155", "154", "153", "152", "151", "150"];
const LINE_1_TO_GURO = [
  ...LINE_1_NORTH,
  ...LINE_1_SEOUL,
  ...dataless("남영", "용산", "노량진", "대방", "신길", "영등포", "신도림", "구로"),
];
const LINE_1_TO_GEUMCHEON = [...LINE_1_TO_GURO, ...dataless("가산디지털단지", "독산", "금천구청")];
const LINE_1_TO_BYEONGJEOM = [
  ...LINE_1_TO_GEUMCHEON,
  ...dataless("석수", "관악", "안양", "명학", "금정", "군포", "당정"),
  ...dataless("의왕", "성균관대", "화서", "수원", "세류", "병점"),
];
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
      sequences: [
        {
          stops: [
            ...LINE_1_TO_GURO,
            ...dataless("구일", "개봉", "오류동", "온수", "역곡", "소사", "부천", "중동", "송내", "부개", "부평"),
            ...dataless("백운", "동암", "간석", "주안", "도화", "제물포", "도원", "동인천", "인천"),
          ],
        },
        {
          stops: [
            ...LINE_1_TO_BYEONGJEOM,
            ...dataless("세마", "오산대", "오산", "진위", "송탄", "서정리", "평택지제", "평택", "성환", "직산", "두정"),
            ...dataless("천안", "봉명", "쌍용", "아산", "탕정", "배방", "온양온천", "신창"),
          ],
        },
        { stops: [...LINE_1_TO_BYEONGJEOM, ...dataless("서동탄")] },
        { stops: [...LINE_1_TO_GEUMCHEON, ...dataless("광명")] },
      ],
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
    {
      id: "3",
      lineNumber: 3,
      name: "3호선",
      carCount: 10,
      isLoop: false,
      // 대화~삼송은 코레일 일산선이다.
      sequences: [
        {
          stops: [
            ...dataless("대화", "주엽", "정발산", "마두", "백석", "대곡", "화정", "원당", "원흥", "삼송"),
            ...range(309, 342),
          ],
        },
      ],
    },
    {
      id: "4",
      lineNumber: 4,
      name: "4호선",
      carCount: 10,
      isLoop: false,
      // 진접~별내별가람은 진접선, 선바위 이남은 코레일 과천선·안산선이다.
      // 409 불암산은 승하차 원본에서 옛 이름 당고개다(`station-key.ts` RENAMED_STATIONS).
      sequences: [
        {
          stops: [
            ...dataless("진접", "오남", "별내별가람"),
            ...range(409, 434),
            ...dataless("선바위", "경마공원", "대공원", "과천", "정부과천청사", "인덕원", "평촌"),
            ...dataless("범계", "금정", "산본", "수리산", "대야미", "반월", "상록수", "한대앞"),
            ...dataless("중앙", "고잔", "초지", "안산", "신길온천", "정왕", "오이도"),
          ],
        },
      ],
    },
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
    {
      id: "7",
      lineNumber: 7,
      name: "7호선",
      carCount: 8,
      isLoop: false,
      // 까치울~석남은 혼잡도·빠른하차가 없다. 까치울은 승하차 원본에 2024년 0명 행이 며칠만 있어 데이터 없는 역으로 둔다.
      sequences: [
        {
          stops: [
            ...range(2711, 2752),
            ...dataless("까치울", "부천종합운동장", "춘의", "신중동", "부천시청", "상동", "삼산체육관", "굴포천"),
            ...dataless("부평구청", "산곡", "석남"),
          ],
        },
      ],
    },
    {
      id: "8",
      lineNumber: 8,
      name: "8호선",
      carCount: 6,
      isLoop: false,
      // 별내~장자호수공원은 별내선이다. 남위례(2828)는 복정과 산성 사이에 온다.
      sequences: [
        {
          stops: [
            ...dataless("별내", "다산", "동구릉", "구리", "장자호수공원"),
            ...range(2810, 2821),
            "2828",
            ...range(2822, 2827),
          ],
        },
      ],
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
  transferPassages: TRANSFER_PASSAGES,
};
