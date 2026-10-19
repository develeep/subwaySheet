/**
 * 칸 점수 공식의 시작값 — `car-score.ts`가 쓴다. 프로토타입 CarScore(prototype/car-score 브랜치 template.html)에서 옮겼다.
 * 3단계에서 설문 결과로 보정할 값이다. **값이나 모델을 바꾸면 FORMULA_VERSION을 올린다**(스펙 #2, ADR 0001).
 * 추천 기록(#5)에 공식 버전이 남아 공식별로 결과를 나눠 비교한다.
 */

export const FORMULA_VERSION = "8";

/**
 * 칸당 좌석. 혼잡도 산정 기준의 좌석 수다(스펙 #2 "54로 시작"). OA-12928은 "승차인과 좌석수가 일치할 경우를 혼잡도 34%"로 정해
 * 아래 160명과 맞는다(160 × 0.34 ≈ 54). 실제 칸은 일반석(6~7인석) 6개 + 교통약자석(3인석) 4개라 48~54석일 수 있다
 * (https://mediahub.seoul.go.kr/archives/2011776). 어느 호선·칸이 6인석인지는 확인 못 했다. 노선마다 달라지면 노선 값으로 바꾼다.
 */
export const SEATS_PER_CAR = 54;

/** 혼잡도 100% = 칸당 160명(좌석 54 + 통로 54 + 출입문 52, https://www.ytn.co.kr/_ln/0103_202311011641366494). */
export const FULL_LOAD_PER_CAR = 160;

export const FORMULA = {
  /** 역 사이 운행시간(OA-12034)이 없는 구간의 정거장당 소요(분). 데이터 없는 역에 닿은 구간(코레일 구간 등)에 쓴다. 추정값.
   * 서울교통공사 1~8호선 역 사이는 1~4.5분이고 1분 30초가 가장 많다(`docs/research/interstation-time.md`). */
  minutesPerStop: 2.0,
  /** 탄 사람 가운데 내릴 역의 출입설비를 보고 칸을 고르는 몫 p_c. 나머지는 탄 역의 출입설비 쪽에 선다. 런던 오전 첨두 추정치
   * 44%(Fang 외 2019, `docs/research/boarding-car-choice.md`)로 시작한다. 0.3·0.6과의 비교는 ADR 0007. */
  destinationShare: 0.44,
  /** 출입설비 칸에서 몇 칸 떨어지면 1/e로 줄어드는지. 0.5~1.5칸으로 바꿔도 강한 구간의 추천 칸은 같았다. */
  spreadCars: 0.8,
  /** 출입설비와 상관없이 고르게 퍼지는 몫. */
  uniformShare: 0.3,
  /** 계단·에스컬레이터 1 대비 엘리베이터 가중치. */
  elevatorWeight: 0.2,
  /** 승하차에 방향 구분이 없어 반반으로 나눈다. 혼잡도 비례로 바꿔도 추천은 같았다. */
  directionShare: 0.5,
  /** 시간대별 배차 간격(분). 추정값, 미검증(스펙 #2 Further Notes). */
  headway: { peak: 2.5, shoulder: 4, day: 5.5, night: 8 },
  /** 평일 첨두·준첨두 시(그 시의 1시간), 심야가 시작하는 시. 06시 이전도 심야로 본다. 주말은 첨두 없이 평시. */
  peakHours: [7, 8, 18] as readonly number[],
  shoulderHours: [6, 9, 17, 19] as readonly number[],
  nightFromHour: 22,
  /** 1등 칸이 평균 칸보다 서서 가는 시간(1 - 칸 점수)을 이 몫만큼도 줄이지 못하면 칸 차이 작음. 추정값.
   * 구간 길이별 칸 차이 작음 비율은 ADR 0006에 있다(정거장 기준 공식으로 잰 값이다). */
  weakBelowCut: 0.1,
  /** 2등 칸이 1등의 (1 - 이 값) 이상이면 함께 추천. */
  secondCarWithin: 0.1,
  /** 혼잡도가 없는 앞 역에서 앉아 있던 비율을 모를 때 쓰는 값. */
  unknownSeatedShare: 0.5,
} as const;
