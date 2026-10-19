import type { D1Database } from "@cloudflare/workers-types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLocalD1, postRequest } from "./fixtures/local-d1";
import { onRequestPost as createRecommendation } from "./recommendations";
import { onRequestPost } from "./survey-responses";

const SECRET = "test-secret";

// 10칸 노선, 11정거장 구간, 추천 칸 3·8번.
const record = {
  routeId: "2-main",
  from: "신도림",
  to: "강남",
  direction: "down",
  departHour: 8,
  dayType: "weekday",
  picks: [3, 8],
  isWeakGap: false,
  hasMissingStations: true,
  period: { start: "2024-01-01", end: "2024-12-31" },
  formulaVersion: "1",
  carCount: 10,
  stopCount: 11,
};

let db: D1Database;
let dispose: () => Promise<void>;
let recommendationId: string;

const env = () => ({ DB: db, IP_HASH_SECRET: SECRET });
const answer = (body: unknown, ip?: string) =>
  onRequestPost({ request: postRequest("/api/survey-responses", body, ip), env: env() });
const responseCount = () => db.prepare("SELECT COUNT(*) AS n FROM survey_responses").first("n");

beforeEach(async () => {
  ({ db, dispose } = await createLocalD1());
  const res = await createRecommendation({ request: postRequest("/api/recommendations", record), env: env() });
  recommendationId = ((await res.json()) as { data: { id: string } }).data.id;
});

afterEach(async () => {
  await dispose();
});

describe("설문 응답 만들기", () => {
  it("추천을 따르고 3정거장 뒤 앉은 응답을 저장한다", async () => {
    const res = await answer({ recommendationId, isFollowed: true, isSeated: true, stopsUntilSeated: 3 });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true });
    const row = await db
      .prepare("SELECT * FROM survey_responses WHERE recommendation_id = ?")
      .bind(recommendationId)
      .first();
    expect(row).toMatchObject({ is_followed: 1, other_car: null, is_seated: 1, stops_until_seated: 3 });
  });

  it("다른 칸(5번)에 타서 끝까지 서서 간 응답은 칸 번호만 남기고 정거장 수는 비운다", async () => {
    const res = await answer({ recommendationId, isFollowed: false, otherCar: 5, isSeated: false });

    expect(res.status).toBe(201);
    const row = await db
      .prepare("SELECT * FROM survey_responses WHERE recommendation_id = ?")
      .bind(recommendationId)
      .first();
    expect(row).toMatchObject({ is_followed: 0, other_car: 5, is_seated: 0, stops_until_seated: null });
  });

  it.each([
    ["JSON이 아닌 본문", () => "{"],
    ["uuid가 아닌 추천 기록 id", () => ({ recommendationId: "1", isFollowed: true, isSeated: false })],
    ["따랐는데 다른 칸 번호", () => ({ recommendationId, isFollowed: true, otherCar: 5, isSeated: false })],
    ["다른 칸인데 칸 번호 없음", () => ({ recommendationId, isFollowed: false, isSeated: false })],
    ["노선 칸 수(10)를 넘는 칸 번호", () => ({ recommendationId, isFollowed: false, otherCar: 11, isSeated: false })],
    ["다른 칸이라면서 추천 칸 번호", () => ({ recommendationId, isFollowed: false, otherCar: 8, isSeated: false })],
    ["앉지 않았는데 정거장 수", () => ({ recommendationId, isFollowed: true, isSeated: false, stopsUntilSeated: 0 })],
    ["앉았는데 정거장 수 없음", () => ({ recommendationId, isFollowed: true, isSeated: true })],
    ["구간 정거장 수(11) 이상", () => ({ recommendationId, isFollowed: true, isSeated: true, stopsUntilSeated: 11 })],
    ["음수 정거장 수", () => ({ recommendationId, isFollowed: true, isSeated: true, stopsUntilSeated: -1 })],
  ])("%s는 400으로 거절한다", async (_name, body) => {
    const res = await answer(body());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: expect.any(String) });
    expect(await responseCount()).toBe(0);
  });

  it("없는 추천 기록에는 응답을 받지 않는다", async () => {
    const res = await answer({ recommendationId: crypto.randomUUID(), isFollowed: true, isSeated: false });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ success: false, error: expect.any(String) });
    expect(await responseCount()).toBe(0);
  });

  it("만든 지 24시간이 지난 추천 기록에는 응답을 받지 않고, 24시간 전 직후는 받는다", async () => {
    const at = (ms: number) =>
      db
        .prepare("UPDATE recommendations SET created_at = ? WHERE id = ?")
        .bind(new Date(Date.now() - ms).toISOString(), recommendationId)
        .run();
    const DAY = 24 * 60 * 60 * 1000;

    await at(DAY + 60_000);
    expect((await answer({ recommendationId, isFollowed: true, isSeated: false })).status).toBe(404);
    await at(DAY - 60_000);
    expect((await answer({ recommendationId, isFollowed: true, isSeated: false })).status).toBe(201);
  });

  it("같은 추천 기록의 두 번째 응답은 409로 거절하고 첫 응답을 그대로 둔다", async () => {
    await answer({ recommendationId, isFollowed: true, isSeated: false });
    const second = await answer({
      recommendationId,
      isFollowed: false,
      otherCar: 1,
      isSeated: true,
      stopsUntilSeated: 0,
    });

    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ success: false, error: expect.any(String) });
    expect(await responseCount()).toBe(1);
    const row = await db.prepare("SELECT is_followed FROM survey_responses").first("is_followed");
    expect(row).toBe(1);
  });

  it("추천 기록과 합쳐 한 IP가 1분에 30번을 넘으면 429로 거절한다", async () => {
    // beforeEach의 추천 기록 만들기가 이미 1번이다.
    for (let i = 0; i < 29; i++)
      await answer({ recommendationId: crypto.randomUUID(), isFollowed: true, isSeated: false });

    const over = await answer({ recommendationId, isFollowed: true, isSeated: false });
    expect(over.status).toBe(429);
    expect(await responseCount()).toBe(0);
  });
});
