import { readFileSync } from "node:fs";
import type { D1Database } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";

/**
 * 설문 함수 테스트용 로컬 D1. Miniflare(workerd)가 메모리에 실제 D1을 띄우고 `migrations/`를 적용한다.
 * `@cloudflare/vitest-pool-workers`는 vitest 4까지만 지원해서 Node 테스트에서 Miniflare를 직접 쓴다.
 */
export async function createLocalD1(): Promise<{ db: D1Database; dispose: () => Promise<void> }> {
  const mf = new Miniflare({ modules: true, script: "export default {};", d1Databases: { DB: "test" } });
  const db = (await mf.getD1Database("DB")) as unknown as D1Database;
  const sql = readFileSync(new URL("../../../migrations/0001_init.sql", import.meta.url), "utf8");
  const statements = sql
    .split(";")
    .map((chunk) => chunk.replace(/^--.*$/gm, "").trim())
    .filter(Boolean);
  for (const statement of statements) await db.prepare(statement).run();
  return { db, dispose: () => mf.dispose() };
}

/** 테스트가 함수에 보내는 요청. 원 IP는 Cloudflare가 넣는 `CF-Connecting-IP` 헤더로 온다. */
export function postRequest(path: string, body: unknown, ip = "203.0.113.7"): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
