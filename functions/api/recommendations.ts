import { recommendationRequestSchema } from "@shared/survey-requests";
import { type Context, ERROR, fail, isRateLimited, ok, readJson } from "../lib/request-guard";

/**
 * POST /api/recommendations — 추천 기록 만들기. 화면이 결과를 보여줄 때마다 부른다(`web/api/survey-api.ts`).
 * 설문 응답률(KR3)의 분모이고, 설문 응답은 여기서 돌려준 id를 가리킨다(ADR 0002).
 * 화면은 이 요청이 실패해도 추천을 그대로 보인다. 그래서 여기서 실패를 감추지 않고 상태 코드로 정직하게 돌려준다.
 */
export async function onRequestPost(context: Context): Promise<Response> {
  try {
    // ① 입력 검증 — 스키마에 맞지 않으면 400. 스키마 오류 원문은 돌려주지 않는다.
    const parsed = recommendationRequestSchema.safeParse(await readJson(context.request));
    if (!parsed.success) return fail(400, ERROR.invalid);
    const input = parsed.data;

    // ② 레이트 리밋 — 한도를 넘으면 429. 저장하지 않는다.
    if (await isRateLimited(context)) return fail(429, ERROR.rateLimited);

    // ③ D1 쓰기 — 실패하면 catch에서 500.
    const id = crypto.randomUUID();
    await context.env.DB.prepare(
      "INSERT INTO recommendations (id, route_id, from_station, to_station, direction, depart_hour, day_type, picks, " +
        "is_weak_gap, has_missing_stations, period_start, period_end, formula_version, car_count, stop_count, " +
        "created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        id,
        input.routeId,
        input.from,
        input.to,
        input.direction,
        input.departHour,
        input.dayType,
        JSON.stringify(input.picks),
        input.isWeakGap ? 1 : 0,
        input.hasMissingStations ? 1 : 0,
        input.period.start,
        input.period.end,
        input.formulaVersion,
        input.carCount,
        input.stopCount,
        new Date().toISOString(),
      )
      .run();

    // ④ 응답 — 설문 응답이 가리킬 id.
    return ok(201, { id });
  } catch (error) {
    console.error("추천 기록을 만들지 못했다", error);
    return fail(500, ERROR.failed);
  }
}
