import { requireDataGoKrKey } from "./env";

/**
 * fetchFastExit — 빠른하차 `getFstExit`(data.go.kr 15143840) 전체 행을 받는다. `batch/main.ts`가 부른다.
 * 네트워크 경계라 단위 테스트하지 않는다(vite.config.ts 커버리지 제외). 정제는 `fast-exit.ts`가 한다.
 * 키는 이미 인코딩된 값일 수 있어 URLSearchParams를 거치지 않고 붙인다(프로토타입 fetch-fst-exit.ts와 같다).
 * **오류 메시지에 URL을 넣지 않는다** — 키가 로그에 남는다.
 */

const ENDPOINT = "https://apis.data.go.kr/B553766/inout/getFstExit";
const ROWS_PER_PAGE = 1000;

type Body = { totalCount?: number | string; items?: { item?: unknown } | unknown[] | "" };

export async function fetchFastExit(): Promise<unknown[]> {
  const first = await fetchPage(1);
  const total = Number(first.totalCount);
  if (!Number.isFinite(total) || total <= 0) throw new Error("빠른하차 totalCount가 없다");
  const items = itemsOf(first);
  for (let page = 2; (page - 1) * ROWS_PER_PAGE < total; page++) items.push(...itemsOf(await fetchPage(page)));
  if (items.length !== total) throw new Error(`빠른하차 ${total}건 중 ${items.length}건만 받았다`);
  return items;
}

async function fetchPage(pageNo: number): Promise<Body> {
  const url = `${ENDPOINT}?serviceKey=${requireDataGoKrKey()}&pageNo=${pageNo}&numOfRows=${ROWS_PER_PAGE}&dataType=JSON`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`빠른하차 ${pageNo}쪽 HTTP ${res.status}`);
  let json: { response?: { body?: Body }; body?: Body };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`빠른하차 ${pageNo}쪽 응답이 JSON이 아니다(키 등록·트래픽 확인): ${text.slice(0, 120)}`);
  }
  const body = json.response?.body ?? json.body;
  if (!body) throw new Error(`빠른하차 ${pageNo}쪽 응답에 body가 없다`);
  return body;
}

function itemsOf(body: Body): unknown[] {
  const items = body.items;
  if (!items) return [];
  if (Array.isArray(items)) return [...items];
  const item = items.item;
  if (item === undefined) return [];
  return Array.isArray(item) ? [...item] : [item];
}
