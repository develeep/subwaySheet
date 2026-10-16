import {
  type RecommendationRequest,
  recommendationCreatedSchema,
  type SurveyResponseRequest,
  surveyResponseCreatedSchema,
} from "@shared/survey-requests";
import type { z } from "zod";

/**
 * 설문 함수(`functions/api/`) 호출. `web/hooks/use-seat-finder.ts`가 부른다.
 * status union으로 돌려준다: `ok`, `invalid`(400), `failed`(그 밖의 실패·네트워크 오류). 2xx 본문도 zod로 확인한다(coding-convention "화면의 fetch").
 * 설문 응답만 `closed`(404 없거나 24시간 지난 추천, 409 이미 응답)가 더 있다. 다시 보내도 받지 않으므로 `failed`의 "다시 눌러 주세요"와 나눈다.
 */

const RECOMMENDATIONS_ENDPOINT = "/api/recommendations";
const SURVEY_RESPONSES_ENDPOINT = "/api/survey-responses";

type PostResult<T> = { status: "ok"; data: T } | { status: "invalid" } | { status: "closed" } | { status: "failed" };

export async function createRecommendation(request: RecommendationRequest): Promise<PostResult<{ id: string }>> {
  const result = await post(RECOMMENDATIONS_ENDPOINT, request, recommendationCreatedSchema, []);
  return result.status === "ok" ? { status: "ok", data: result.data.data } : result;
}

export function createSurveyResponse(request: SurveyResponseRequest): Promise<PostResult<unknown>> {
  return post(SURVEY_RESPONSES_ENDPOINT, request, surveyResponseCreatedSchema, [404, 409]);
}

async function post<T>(
  endpoint: string,
  body: unknown,
  schema: z.ZodType<T>,
  closedStatuses: number[],
): Promise<PostResult<T>> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 400) return { status: "invalid" };
    if (closedStatuses.includes(res.status)) return { status: "closed" };
    if (!res.ok) return { status: "failed" };
    const parsed = schema.safeParse(await res.json());
    return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
  } catch (error) {
    console.error("설문 함수를 부르지 못했다", error);
    return { status: "failed" };
  }
}
