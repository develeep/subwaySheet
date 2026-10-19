import type { D1Database } from "@cloudflare/workers-types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLocalD1, postRequest } from "./fixtures/local-d1";
import { onRequestPost } from "./recommendations";

const SECRET = "test-secret";

const validRecord = {
  routeId: "2-main",
  from: "신도림",
  to: "강남",
  direction: "down",
  departHour: 8,
  dayType: "weekday",
  picks: [3],
  isWeakGap: false,
  hasMissingStations: false,
  period: { start: "2024-01-01", end: "2024-12-31" },
  formulaVersion: "1",
  carCount: 10,
  stopCount: 11,
};

let db: D1Database;
let dispose: () => Promise<void>;

beforeEach(async () => {
  ({ db, dispose } = await createLocalD1());
});

afterEach(async () => {
  await dispose();
});

const post = (body: unknown, ip?: string) =>
  onRequestPost({ request: postRequest("/api/recommendations", body, ip), env: { DB: db, IP_HASH_SECRET: SECRET } });

describe("추천 기록 만들기", () => {
  it("결과 화면 하나를 추천 기록으로 남기고 서버가 만든 id를 돌려준다", async () => {
    const res = await post(validRecord);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; data: { id: string } };
    expect(body.success).toBe(true);
    const row = await db.prepare("SELECT * FROM recommendations WHERE id = ?").bind(body.data.id).first();
    expect(row).toMatchObject({
      route_id: "2-main",
      from_station: "신도림",
      to_station: "강남",
      direction: "down",
      depart_hour: 8,
      day_type: "weekday",
      picks: "[3]",
      is_weak_gap: 0,
      has_missing_stations: 0,
      period_start: "2024-01-01",
      period_end: "2024-12-31",
      formula_version: "1",
    });
    expect(row?.created_at).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
    expect(row).not.toHaveProperty("grade");
  });

  it.each([
    ["JSON이 아닌 본문", "not json"],
    ["빠진 필드", { ...validRecord, isWeakGap: undefined }],
    ["모르는 필드", { ...validRecord, ip: "203.0.113.7" }],
    ["칸 수를 넘는 추천 칸", { ...validRecord, picks: [11] }],
    ["추천 칸 0번", { ...validRecord, picks: [0] }],
    ["같은 추천 칸 두 번", { ...validRecord, picks: [3, 3] }],
    ["추천 칸 세 개", { ...validRecord, picks: [1, 2, 3] }],
    ["24시 이후 시간대", { ...validRecord, departHour: 24 }],
    ["없는 요일유형", { ...validRecord, dayType: "holiday" }],
    ["같은 출발역·도착역", { ...validRecord, to: "신도림" }],
  ])("%s는 400으로 거절하고 내부 정보 없이 고정 문구만 돌려준다", async (_name, body) => {
    const res = await post(body);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: expect.any(String) });
    expect(await db.prepare("SELECT COUNT(*) AS n FROM recommendations").first("n")).toBe(0);
  });

  it("한 IP가 1분에 30번을 넘게 보내면 429로 거절하고, 다른 IP는 그대로 받는다", async () => {
    for (let i = 0; i < 30; i++) expect((await post(validRecord)).status).toBe(201);

    const over = await post(validRecord);
    expect(over.status).toBe(429);
    expect(await over.json()).toEqual({ success: false, error: expect.any(String) });
    expect((await post(validRecord, "198.51.100.20")).status).toBe(201);
    expect(await db.prepare("SELECT COUNT(*) AS n FROM recommendations").first("n")).toBe(31);
  });

  it("D1 어느 표에도 원 IP가 남지 않는다", async () => {
    await post(validRecord, "203.0.113.7");
    await post(validRecord, "2001:db8::1");

    // _cf_로 시작하는 D1 내부 표는 읽기가 막혀 있어 뺀다.
    const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all<{ name: string }>();
    const ourTables = tables.results.map((t) => t.name).filter((name) => !name.startsWith("_cf_"));
    expect(ourTables).toEqual(expect.arrayContaining(["recommendations", "survey_responses", "rate_limits"]));
    const dump = [];
    for (const name of ourTables) dump.push(await db.prepare(`SELECT * FROM "${name}"`).all());
    const text = JSON.stringify(dump);
    expect(text).toContain("신도림");
    expect(text).not.toContain("203.0.113.7");
    expect(text).not.toContain("2001:db8::1");
  });

  it("IP 해시 시크릿이 없으면 저장하지 않고 500으로 막는다", async () => {
    const res = await onRequestPost({
      request: postRequest("/api/recommendations", validRecord),
      env: { DB: db, IP_HASH_SECRET: "" },
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: expect.any(String) });
    expect(await db.prepare("SELECT COUNT(*) AS n FROM recommendations").first("n")).toBe(0);
  });
});
