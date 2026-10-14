// PROTOTYPE: 버리는 코드. 빠른하차정보(getFstExit) 전체를 받아 raw/fst-exit.json에 저장한다.
// 실행: 레포 루트에서 `bun prototypes/car-score/fetch-fst-exit.ts` (.env의 DATA_GO_KR_KEY 사용)

const key = process.env.DATA_GO_KR_KEY;
if (!key) throw new Error("DATA_GO_KR_KEY가 .env에 없습니다");

const BASE = "https://apis.data.go.kr/B553766/inout/getFstExit";
const ROWS = 1000;

async function page(pageNo: number) {
  // 키가 이미 인코딩된 값일 수도 있어서 URLSearchParams를 거치지 않고 그대로 붙인다.
  const url = `${BASE}?serviceKey=${key}&pageNo=${pageNo}&numOfRows=${ROWS}&dataType=JSON`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`JSON 아님: ${text.slice(0, 300)}`);
  }
}

const first = await page(1);
const body = first.response?.body ?? first.body;
if (!body) throw new Error(`예상 못 한 응답: ${JSON.stringify(first).slice(0, 300)}`);
const total = Number(body.totalCount);
const pick = (b: any) => {
  const it = b.items?.item ?? b.items ?? [];
  return Array.isArray(it) ? it : [it];
};
const items = [...pick(body)];
for (let p = 2; (p - 1) * ROWS < total; p++) {
  const r = await page(p);
  items.push(...pick(r.response?.body ?? r.body));
}
await Bun.write(`${import.meta.dir}/raw/fst-exit.json`, JSON.stringify(items));
console.log(`총 ${total}건 중 ${items.length}건 저장`);
