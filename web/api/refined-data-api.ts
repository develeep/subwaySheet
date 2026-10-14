import { type RefinedData, refinedDataSchema } from "@shared/refined-data";

/**
 * fetchRefinedData — 배치가 만든 정적 정제 데이터(`public/data/refined-data.json`)를 읽는다. `web/hooks/use-seat-finder.ts`가 부른다.
 * 본문은 zod로 계약을 검증하고, 실패하면 기본값으로 진행하지 않고 `failed`를 돌려준다(coding-convention "화면의 fetch").
 */

export const REFINED_DATA_ENDPOINT = "/data/refined-data.json";

export type RefinedDataResult = { status: "ok"; data: RefinedData } | { status: "failed" };

export async function fetchRefinedData(): Promise<RefinedDataResult> {
  try {
    const res = await fetch(REFINED_DATA_ENDPOINT);
    if (!res.ok) return { status: "failed" };
    const parsed = refinedDataSchema.safeParse(await res.json());
    return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
  } catch (error) {
    console.error("정제 데이터를 읽지 못했다", error);
    return { status: "failed" };
  }
}
