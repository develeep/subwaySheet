import { surveyResponseRequestSchema } from "@shared/survey-requests";
import { type Context, ERROR, fail, isRateLimited, ok, readJson } from "../lib/request-guard";

/**
 * POST /api/survey-responses — 설문 응답 만들기. 결과 화면의 "도착했어요" 설문이 부른다(`web/api/survey-api.ts`).
 * 응답은 반드시 추천 기록 하나를 가리키고 **추천 기록당 하나뿐**이다(survey_responses PRIMARY KEY). 받은 지 24시간이 지난 추천에는 받지 않는다.
 * 칸 번호·정거장 수는 추천 기록에 저장한 노선 칸 수·구간 정거장 수와 맞춰 본다(스펙 #2 "서버 검증").
 */

const ANSWER_WINDOW_MS = 24 * 60 * 60 * 1000;

type RecommendationRow = { picks: string; car_count: number; stop_count: number; created_at: string };

export async function onRequestPost(context: Context): Promise<Response> {
  try {
    // ① 입력 검증 — 스키마에 맞지 않으면 400.
    const parsed = surveyResponseRequestSchema.safeParse(await readJson(context.request));
    if (!parsed.success) return fail(400, ERROR.invalid);
    const input = parsed.data;

    // ② 레이트 리밋 — 한도를 넘으면 429. 추천 기록을 읽지도 않는다.
    if (await isRateLimited(context)) return fail(429, ERROR.rateLimited);

    // ③ D1 읽기 — 없거나 24시간이 지난 추천 기록이면 404. created_at은 이 함수가 쓴 ISO 문자열이다.
    const db = context.env.DB;
    const recommendation = await db
      .prepare("SELECT picks, car_count, stop_count, created_at FROM recommendations WHERE id = ?")
      .bind(input.recommendationId)
      .first<RecommendationRow>();
    if (!recommendation || Date.parse(recommendation.created_at) < Date.now() - ANSWER_WINDOW_MS)
      return fail(404, ERROR.notFound);

    // ③ 추천 기록과 걸린 검증 — 다른 칸은 노선 칸 수 안이면서 추천 칸이 아니어야 하고, 정거장 수는 구간 정거장 수보다 작아야 한다.
    const picks = JSON.parse(recommendation.picks) as number[];
    if (input.otherCar !== undefined && (input.otherCar > recommendation.car_count || picks.includes(input.otherCar))) {
      return fail(400, ERROR.invalid);
    }
    if (input.stopsUntilSeated !== undefined && input.stopsUntilSeated >= recommendation.stop_count)
      return fail(400, ERROR.invalid);

    // ③ D1 쓰기 — 이미 응답이 있으면 아무것도 바꾸지 않고 409.
    const written = await db
      .prepare(
        "INSERT INTO survey_responses (recommendation_id, is_followed, other_car, is_seated, stops_until_seated, created_at) " +
          "VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (recommendation_id) DO NOTHING",
      )
      .bind(
        input.recommendationId,
        input.isFollowed ? 1 : 0,
        input.otherCar ?? null,
        input.isSeated ? 1 : 0,
        input.stopsUntilSeated ?? null,
        new Date().toISOString(),
      )
      .run();
    if (written.meta.changes === 0) return fail(409, ERROR.duplicate);

    // ④ 응답
    return ok(201);
  } catch (error) {
    console.error("설문 응답을 만들지 못했다", error);
    return fail(500, ERROR.failed);
  }
}
