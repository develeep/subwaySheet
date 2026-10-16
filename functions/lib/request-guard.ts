import type { D1Database } from "@cloudflare/workers-types";

/**
 * 설문 함수의 두 핸들러(`functions/api/recommendations.ts`, `functions/api/survey-responses.ts`)가 같이 쓰는 것.
 * 이 파일은 `onRequest*`를 export하지 않아 Pages 라우트가 되지 않는다.
 * **원 IP는 저장하지도 로그에 찍지도 않는다**(AGENTS.md). 레이트 리밋은 `IP_HASH_SECRET`으로 만든 HMAC으로만 센다.
 * 소금 없는 해시는 IPv4 2^32개를 다 돌려 보면 되돌려지므로 시크릿이 꼭 있어야 한다. 없으면 요청을 500으로 막는다.
 */

type Env = { DB: D1Database; IP_HASH_SECRET: string };
export type Context = { request: Request; env: Env };

/** 한 IP 해시가 1분에 보낼 수 있는 요청 수(두 요청 합). 결과 화면을 여러 번 열어도 넘지 않을 만큼으로 잡은 추정값이다. */
const RATE_LIMIT_PER_MINUTE = 30;
const WINDOW_MS = 60_000;

/** 오류 응답 문구. **내부 정보(SQL·스택·스키마 오류 원문)를 담지 않는다.** */
export const ERROR = {
  invalid: "요청 형식이 올바르지 않습니다.",
  rateLimited: "요청이 너무 많습니다. 잠시 뒤 다시 시도해 주세요.",
  notFound: "설문을 받을 수 없는 추천입니다.",
  duplicate: "이미 응답한 추천입니다.",
  failed: "요청을 처리하지 못했습니다.",
} as const;

export function ok(status: number, data?: unknown): Response {
  return Response.json(data === undefined ? { success: true } : { success: true, data }, { status });
}

export function fail(status: number, error: string): Response {
  return Response.json({ success: false, error }, { status });
}

/** 본문 JSON. 읽지 못하면 undefined라 스키마 검증에서 400이 된다. */
export function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => undefined);
}

/** 이 요청으로 지금 1분 창의 한도를 넘었는지. 세는 것과 지난 창 지우기를 같이 한다. */
export async function isRateLimited({ request, env }: Context): Promise<boolean> {
  if (!env.IP_HASH_SECRET) throw new Error("IP_HASH_SECRET이 설정되지 않았다");
  const ipHash = await hmacHex(env.IP_HASH_SECRET, request.headers.get("CF-Connecting-IP") ?? "unknown");
  const windowStart = Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS;
  const [, counted] = await env.DB.batch<{ count: number }>([
    env.DB.prepare("DELETE FROM rate_limits WHERE window_start < ?").bind(windowStart),
    env.DB.prepare(
      "INSERT INTO rate_limits (ip_hash, window_start, count) VALUES (?, ?, 1) " +
        "ON CONFLICT (ip_hash, window_start) DO UPDATE SET count = count + 1 RETURNING count",
    ).bind(ipHash, windowStart),
  ]);
  return (counted?.results[0]?.count ?? 0) > RATE_LIMIT_PER_MINUTE;
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
