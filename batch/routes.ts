import type { RefineConfig } from "./refine";

/**
 * 배치 노선 설정 — `batch/main.ts`가 `refine`에 넘긴다. 손으로 관리하는 표다.
 * 지금은 2호선 본선만 둔다(#3). 1~8호선·지선·5호선 갈래는 #6에서 더한다.
 * 칸 수 근거: docs/research/data-coverage.md "편성당 칸 수".
 */

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i));

export const ROUTE_CONFIG: RefineConfig = {
  routes: [
    // 2호선 본선 순환. 역번호 201(시청)~243(충정로)이 하행 = 내선 순서다(프로토타입 FINDINGS).
    { id: "2-main", lineNumber: 2, name: "2호선", carCount: 10, isLoop: true, codes: range(201, 243) },
  ],
  // 그 역에서 만나는 노선 수(코레일·민자 노선과 같은 호선의 지선 포함). 프로토타입 CarScore의 LINES_AT에서 옮겼다.
  // 환승인원(역 합계)을 노선 몫으로 나눌 때 쓴다. 환승인원 원본에 있는데 여기 없는 역은 배치가 멈춘다.
  transferLineCounts: {
    시청: 2,
    을지로3가: 2,
    을지로4가: 2,
    동대문역사문화공원: 3,
    신당: 2,
    왕십리: 4,
    성수: 2,
    건대입구: 2,
    잠실: 2,
    종합운동장: 2,
    선릉: 2,
    강남: 2,
    교대: 2,
    사당: 2,
    신림: 2,
    대림: 2,
    신도림: 3,
    영등포구청: 2,
    당산: 2,
    합정: 2,
    홍대입구: 3,
    충정로: 2,
  },
};
