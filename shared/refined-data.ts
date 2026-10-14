import { z } from "zod";

/**
 * 정제 데이터 형식 — 배치(`batch/`)가 쓰고 추천 모듈(`web/recommend/`)이 읽는 `public/data/refined-data.json`의 계약.
 * **공식 값(퍼짐·가중치·등급 기준)을 넣지 않는다**(ADR 0001). 원본을 정제한 값과 표시 플래그까지만 담는다.
 * 모양을 바꾸면 배치 출력·추천 모듈·계약 테스트(`batch/contract.test.ts`)를 같이 고친다.
 */

/** 요일유형. `sunday`는 일요일·공휴일이다(CONTEXT.md "요일유형"). */
export const DAY_TYPES = ["weekday", "saturday", "sunday"] as const;
export type DayType = (typeof DAY_TYPES)[number];

/**
 * 방향. 노선 역 순서열의 앞→뒤가 `down`이다. 공공데이터 하행과 같고, 2호선은 하행 = 역번호 증가 = 혼잡도 내선이다
 * (프로토타입 FINDINGS, 스펙 #2 "방향 맞추기").
 */
export type Direction = "down" | "up";

/** 시간대 개수. 0 = 06시 이전, 1 = 06~07시, …, 18 = 23~24시, 19 = 24시 이후(OA-12921 열 구성). */
export const TIME_SLOT_COUNT = 20;

export const FACILITY_KINDS = ["stairs", "escalator", "elevator"] as const;
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

/** 노선 위의 역. 혼잡도는 칸당 정원 대비 %(OA-12928)를 1시간 시간대로 합친 값이고, 없으면 null이다. */
const routeStopSchema = z.object({
  name: z.string().min(1),
  congestion: z.object({ down: byDayType(slotValuesSchema).nullable(), up: byDayType(slotValuesSchema).nullable() }),
  fastExit: z.object({ down: fastExitSideSchema, up: fastExitSideSchema }),
});

const routeSchema = z.object({
  id: z.string().min(1),
  lineNumber: z.number().int().min(1),
  name: z.string().min(1),
  carCount: z.number().int().min(1),
  isLoop: z.boolean(),
  stops: z.array(routeStopSchema).min(2),
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
export type Route = z.infer<typeof routeSchema>;
export type StationData = z.infer<typeof stationSchema>;
export type Periods = z.infer<typeof periodsSchema>;
export type RefinedData = z.infer<typeof refinedDataSchema>;
export type ByDayType<T> = Record<DayType, T>;
