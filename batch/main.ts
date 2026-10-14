import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchFastExit } from "./fetch-fast-exit";
import { formatJson } from "./format-json";
import { refine } from "./refine";
import { ROUTE_CONFIG } from "./routes";

/**
 * 배치 진입점 — `pnpm batch`. 원본을 읽고(raw/ 파일 + getFstExit API) `refine`으로 정제해 `public/data/refined-data.json`에 쓴다.
 * 파일 원본은 data.go.kr에서 받아 `raw/`에 이 이름으로 둔다(커밋하지 않음). 자동 다운로드는 #11에서 한다.
 *   - raw/ridership-*.csv          승하차 OA-12921(기준 기간은 파일 안 날짜로 정한다)
 *   - raw/congestion-YYYYMM.csv    혼잡도 OA-12928
 *   - raw/transfer-YYYYMM.csv      환승인원 data.go.kr 15062858
 * 같은 종류가 여럿이면 이름순 마지막 파일을 쓴다. 인코딩은 UTF-8, 아니면 EUC-KR(data.go.kr 기본)로 읽는다.
 */

const RAW_DIR = "raw";
const OUTPUT = join("public", "data", "refined-data.json");

function latestRaw(pattern: RegExp): { path: string; period: string | undefined } {
  const name = readdirSync(RAW_DIR)
    .filter((f) => pattern.test(f))
    .sort()
    .at(-1);
  if (!name) throw new Error(`${RAW_DIR}/에 ${pattern} 파일이 없다`);
  const ym = pattern.exec(name)?.[1];
  return { path: join(RAW_DIR, name), period: ym ? `${ym.slice(0, 4)}-${ym.slice(4, 6)}` : undefined };
}

function readText(path: string): string {
  const bytes = readFileSync(path);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("euc-kr").decode(bytes);
  }
}

function withPeriod(file: { path: string; period: string | undefined }) {
  if (!file.period) throw new Error(`${file.path} 이름에서 기준 월(YYYYMM)을 읽지 못했다`);
  return { period: file.period, csv: readText(file.path) };
}

const ridership = latestRaw(/^ridership-.*\.csv$/);
const congestion = latestRaw(/^congestion-(\d{6})\.csv$/);
const transfer = latestRaw(/^transfer-(\d{6})\.csv$/);
const fastExitItems = await fetchFastExit();
writeFileSync(join(RAW_DIR, "fast-exit.json"), JSON.stringify(fastExitItems));

const data = refine(
  {
    ridershipCsv: readText(ridership.path),
    congestion: withPeriod(congestion),
    transfer: withPeriod(transfer),
    fastExitItems,
  },
  ROUTE_CONFIG,
);
mkdirSync(join("public", "data"), { recursive: true });
writeFileSync(OUTPUT, formatJson(data));
console.info(
  `${OUTPUT}: 노선 ${data.routes.length}개, 역 ${Object.keys(data.stations).length}개, 빠른하차 ${fastExitItems.length}건`,
  data.periods,
);
