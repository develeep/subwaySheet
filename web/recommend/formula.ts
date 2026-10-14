/**
 * 칸 점수 공식의 시작값 — `car-score.ts`가 쓴다. 프로토타입 CarScore(prototype/car-score 브랜치 template.html)에서 옮겼다.
 * 3단계에서 설문 결과로 보정할 값이다. **값이나 모델을 바꾸면 FORMULA_VERSION을 올린다**(스펙 #2, ADR 0001).
 * 추천 기록(#5)에 공식 버전이 남아 공식별로 결과를 나눠 비교한다.
 */

export const FORMULA_VERSION = "1";

/** 칸당 좌석(7인석 6개 + 노약자석 3인석 4개). 스펙 #2 "54로 시작". 노선마다 달라지면 노선 값으로 바꾼다. */
export const SEATS_PER_CAR = 54;

/** 혼잡도 100% = 칸당 160명(OA-12928 정원 기준). */
export const FULL_LOAD_PER_CAR = 160;

export const FORMULA = {
  /** 정거장당 소요(분). 중간 역 k의 도착 시각 = 출발 시각 + k × 2분. 추정값, 2.5분으로 바꿔도 프로토타입 결과 같음. */
  minutesPerStop: 2.0,
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
  /** 앉을 가능성 기준: 빈자리 ÷ 서 있는 사람. */
  gradeHigh: 1.0,
  gradeMid: 0.4,
  /** 1등 칸이 칸 평균의 이 배수 미만이면 칸 차이 작음. 이런 구간은 가정값마다 추천이 바뀌었다. */
  weakBelow: 1.15,
  /** 2등 칸이 1등의 (1 - 이 값) 이상이면 함께 추천. */
  secondCarWithin: 0.1,
  /** 혼잡도가 없는 앞 역에서 앉아 있던 비율을 모를 때 쓰는 값. */
  unknownSeatedShare: 0.5,
} as const;
