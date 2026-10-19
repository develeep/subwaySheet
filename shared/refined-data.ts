import { z } from "zod";

/**
 * 정제 데이터 형식 — 배치(`batch/`)가 쓰고 추천 모듈(`web/recommend/`)이 읽는 `public/data/refined-data.json`의 계약.
 * **공식 값(퍼짐·가중치·판정 기준)을 넣지 않는다**(ADR 0001). 원본을 정제한 값과 표시 플래그까지만 담는다.
 * 모양을 바꾸면 배치 출력·추천 모듈·계약 테스트(`batch/contract.test.ts`)를 같이 고친다.
 */

/** 요일유형. `sunday`는 일요일·공휴일이다(CONTEXT.md "요일유형"). */
export const DAY_TYPES = ["weekday", "saturday", "sunday"] as const;
export type DayType = (typeof DAY_TYPES)[number];

/**
 * 방향. 역 순서열의 앞→뒤가 `down`이다. 공공데이터 하행과 같고, 2호선은 하행 = 역번호 증가 = 혼잡도 내선이다
 * (프로토타입 FINDINGS, 스펙 #2 "방향 맞추기"). 한 방향으로만 도는 순서열은 예외다(아래 sequenceSchema).
 */
export type Direction = "down" | "up";

/** 시간대 개수. 0 = 06시 이전, 1 = 06~07시, …, 18 = 23~24시, 19 = 24시 이후(OA-12921 열 구성). */
export const TIME_SLOT_COUNT = 20;

const FACILITY_KINDS = ["stairs", "escalator", "elevator"] as const;
export type FacilityKind = (typeof FACILITY_KINDS)[number];

const slotValuesSchema = z.array(z.number().nonnegative()).length(TIME_SLOT_COUNT);

const byDayType = <T extends z.ZodType>(schema: T) => z.object({ weekday: schema, saturday: schema, sunday: schema });

const facilitySchema = z.object({
  car: z.number().int().min(1),
  door: z.number().int().min(1),
  kind: z.enum(FACILITY_KINDS),
});

/** 한 역·방향의 빠른하차. `isMissing`은 그 방향 행이 통째로 없음, `isElevatorOnly`는 계단·에스컬레이터 없이 엘리베이터뿐임
 * (그 역의 계단 행이 원본에서 빠진 것으로 보고 앱이 칸마다 고르게 퍼뜨린다, 프로토타입 FINDINGS). */
const fastExitSideSchema = z.object({
  isMissing: z.boolean(),
  isElevatorOnly: z.boolean(),
  facilities: z.array(facilitySchema),
});

const carsSchema = z.array(z.number().int().min(1));

/** 순서열 위의 역. 혼잡도는 칸당 정원 대비 %(OA-12928)를 1시간 시간대로 합친 값이고, 없으면 null이다.
 * `down`·`up`은 그 순서열을 앞→뒤·뒤→앞으로 탈 때의 값이다. 갈래마다 승강장이 달라(5호선 강동) 순서열마다 따로 둔다.
 * `transferCars`는 환승역 표(`batch/transfer-passages.ts`)의 환승통로 칸이다. 갈아탈 호선마다 하나씩이고, 표에 없는 역·방향은 빈 배열이다.
 * `isDataless`는 원본이 하나도 없는 정차(코레일 구간·7호선 부천 구간·별내선·진접선, #10)다. 혼잡도·빠른하차가 비어 있고,
 * 같은 이름 역의 승하차(다른 호선 값, 예: 1호선 신도림)가 있어도 앱이 쓰지 않는다. 열차는 지나가므로 정거장 순서에는 든다. */
const routeStopSchema = z.object({
  name: z.string().min(1),
  isDataless: z.boolean(),
  congestion: z.object({ down: byDayType(slotValuesSchema).nullable(), up: byDayType(slotValuesSchema).nullable() }),
  fastExit: z.object({ down: fastExitSideSchema, up: fastExitSideSchema }),
  transferCars: z.object({ down: carsSchema, up: carsSchema }),
});

/** 역 순서열(하행 순서). `oneWay`가 있으면 그 방향으로만 탈 수 있다. 6호선 응암순환은 한 방향으로만 돌아서
 * 순환 구간을 앞에 둔 하행 전용 순서열과, 뒤집어 둔 상행 전용 순서열 둘로 나타낸다. 상행 전용 쪽 순환 구간 역의 `up`에는
 * 실제 운행 방향(하행) 값이 들어간다(`batch/routes.ts`). */
const sequenceSchema = z.object({
  oneWay: z.enum(["down", "up"]).nullable(),
  stops: z.array(routeStopSchema).min(2),
});

/** 노선. 열차가 갈아타지 않고 다니는 길이고 칸 수가 하나다(CONTEXT.md "노선"). 갈라지는 노선(5호선)은 순서열이 여럿이다.
 * `isLoop`는 순서열(하나)의 끝이 처음으로 이어지는 순환(2호선 본선)이다. */
const routeSchema = z.object({
  id: z.string().min(1),
  lineNumber: z.number().int().min(1),
  name: z.string().min(1),
  carCount: z.number().int().min(1),
  isLoop: z.boolean(),
  sequences: z.array(sequenceSchema).min(1),
});

/** 역 단위 값. 승하차는 요일유형별 하루 평균 인원(OA-12921), 환승인원은 일평균과 그 역에서 만나는 노선 수. */
const stationSchema = z.object({
  ridership: byDayType(z.object({ boarding: slotValuesSchema, alighting: slotValuesSchema })).nullable(),
  transfer: z.object({ perDay: byDayType(z.number().nonnegative()), lineCount: z.number().int().min(1) }).nullable(),
});

const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ymSchema = z.string().regex(/^\d{4}-\d{2}$/);

/** 원본별 기준 기간. 화면에는 승하차 기준 기간을 보여준다(스펙 #2 Further Notes). */
const periodsSchema = z.object({
  ridership: z.object({ start: ymdSchema, end: ymdSchema }),
  congestion: ymSchema,
  transfer: ymSchema,
  fastExit: ymdSchema,
});

export const refinedDataSchema = z.object({
  periods: periodsSchema,
  routes: z.array(routeSchema).min(1),
  stations: z.record(z.string(), stationSchema),
});

export type Facility = z.infer<typeof facilitySchema>;
export type FastExitSide = z.infer<typeof fastExitSideSchema>;
export type RouteStop = z.infer<typeof routeStopSchema>;
export type RouteSequence = z.infer<typeof sequenceSchema>;
export type Route = z.infer<typeof routeSchema>;
export type StationData = z.infer<typeof stationSchema>;
export type Periods = z.infer<typeof periodsSchema>;
export type RefinedData = z.infer<typeof refinedDataSchema>;
export type ByDayType<T> = Record<DayType, T>;
