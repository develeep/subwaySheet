import { z } from "zod";
import { DAY_TYPES } from "./refined-data";

/**
 * 설문 함수 요청·응답 계약 — 화면(`web/api/survey-api.ts`)이 보내고 설문 함수(`functions/api/`)가 검증한다.
 * 모르는 필드는 거절한다(strict). 추천 기록과 걸린 조건(칸 수·정거장 수 안)은 설문 함수가 저장된 추천 기록과 맞춰 본다.
 * 모양을 바꾸면 `migrations/` D1 표와 두 핸들러 테스트를 같이 고친다.
 */

const stationName = z.string().min(1).max(40);
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** 추천 기록 만들기(POST /api/recommendations). 결과 화면 하나의 요약이다. */
export const recommendationRequestSchema = z
  .strictObject({
    routeId: z.string().min(1).max(40),
    from: stationName,
    to: stationName,
    direction: z.enum(["down", "up"]),
    departHour: z.int().min(0).max(23),
    dayType: z.enum(DAY_TYPES),
    picks: z.array(z.int().min(1)).min(1).max(2),
    isWeakGap: z.boolean(),
    hasMissingStations: z.boolean(),
    period: z.strictObject({ start: ymd, end: ymd }),
    formulaVersion: z.string().min(1).max(20),
    carCount: z.int().min(1).max(20),
    stopCount: z.int().min(1).max(100),
  })
  .refine((r) => r.from !== r.to)
  .refine((r) => new Set(r.picks).size === r.picks.length && r.picks.every((car) => car <= r.carCount));

/**
 * 설문 응답 만들기(POST /api/survey-responses). 추천을 따르지 않았을 때만 `otherCar`, 앉았을 때만 `stopsUntilSeated`가 있다.
 * `stopsUntilSeated`는 시안의 구간 버튼(타자마자·1~2·3~5·6 이상)의 시작값이다(`web/constants/survey-copy.ts`).
 */
export const surveyResponseRequestSchema = z
  .strictObject({
    recommendationId: z.uuid(),
    isFollowed: z.boolean(),
    otherCar: z.int().min(1).optional(),
    isSeated: z.boolean(),
    stopsUntilSeated: z.int().min(0).optional(),
  })
  .refine((r) => r.isFollowed === (r.otherCar === undefined))
  .refine((r) => r.isSeated === (r.stopsUntilSeated !== undefined));

/** 성공 응답 본문. 실패는 `{ success: false, error }`이고 error는 고정 문구다. */
export const recommendationCreatedSchema = z.object({ success: z.literal(true), data: z.object({ id: z.uuid() }) });
export const surveyResponseCreatedSchema = z.object({ success: z.literal(true) });

export type RecommendationRequest = z.infer<typeof recommendationRequestSchema>;
export type SurveyResponseRequest = z.infer<typeof surveyResponseRequestSchema>;
