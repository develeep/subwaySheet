import { type RefinedData, refinedDataSchema, type StationData } from "@shared/refined-data";
import { refineCongestion } from "./congestion";
import { parseCsv } from "./csv";
import { mapDayTypes } from "./day-type";
import { refineFastExit, toFastExitSide } from "./fast-exit";
import { refineRidership } from "./ridership";
import { baseStationName, stationKey } from "./station-key";

/**
 * refine — 원본 공공데이터를 공식 없는 정제 데이터(`shared/refined-data.ts`)로 만든다. `batch/main.ts`가 부른다.
 * 원본 읽기(파일·네트워크)는 여기 오기 전에 끝난다. 그래서 테스트는 픽스처 텍스트만 넣어 출력을 확인한다(스펙 #2 테스트 지점 2).
 * 역은 같은 호선 안의 역번호로 원본끼리 잇고(승하차·혼잡도 "201", 빠른하차 "0201"), 이름은 부기명을 뗀 승하차 역명을 쓴다.
 * **마지막에 스키마로 검증한다.** 형식이 어긋난 파일을 `public/data/`에 쓰지 않기 위해서다.
 */

type RouteDefinition = {
  id: string;
  lineNumber: number;
  name: string;
  carCount: number;
  isLoop: boolean;
  /** 하행(down) 순서의 역번호. */
  codes: string[];
};

export type RefineConfig = {
  routes: RouteDefinition[];
  /** 환승역 이름 → 그 역에서 만나는 노선 수(코레일·민자 노선 포함). 환승인원을 노선 몫으로 나눌 때 앱이 쓴다. */
  transferLineCounts: Record<string, number>;
};

export type RawSources = {
  ridershipCsv: string;
  congestion: { period: string; csv: string };
  transfer: { period: string; csv: string };
  fastExitItems: unknown[];
};

export function refine(raw: RawSources, config: RefineConfig): RefinedData {
  const lineLabel = (route: RouteDefinition) => `${route.lineNumber}호선`;
  const wanted = new Set(
    config.routes.flatMap((route) => route.codes.map((code) => stationKey(lineLabel(route), code))),
  );
  const ridership = refineRidership(raw.ridershipCsv, wanted);
  const congestion = refineCongestion(raw.congestion.csv);
  const fastExit = refineFastExit(
    raw.fastExitItems,
    new Map(config.routes.map((route) => [lineLabel(route), route.carCount])),
  );
  const transferPerDay = readTransfer(raw.transfer.csv);

  const stations: Record<string, StationData> = {};
  const routes = config.routes.map((route) => ({
    id: route.id,
    lineNumber: route.lineNumber,
    name: route.name,
    carCount: route.carCount,
    isLoop: route.isLoop,
    stops: route.codes.map((code) => {
      const key = stationKey(lineLabel(route), code);
      const name = ridership.byStation.get(key)?.name ?? congestion.get(key)?.name;
      if (!name) throw new Error(`${key} 역 이름을 어느 원본에서도 찾지 못했다`);
      stations[name] = {
        ridership: ridership.byStation.get(key)?.ridership ?? null,
        transfer: transferOf(name, transferPerDay, config.transferLineCounts),
      };
      const sides = fastExit.byStation.get(key);
      return {
        name,
        congestion: congestion.get(key)?.congestion ?? { down: null, up: null },
        fastExit: { down: toFastExitSide(sides?.down), up: toFastExitSide(sides?.up) },
      };
    }),
  }));

  return refinedDataSchema.parse({
    periods: {
      ridership: ridership.period,
      congestion: raw.congestion.period,
      transfer: raw.transfer.period,
      fastExit: fastExit.period,
    },
    routes,
    stations,
  });
}

/** 환승인원(data.go.kr 15062858): 연번, 출발역명, 평일, 토요일, 일요일. 역 단위 일평균이다. */
function readTransfer(csv: string) {
  // 열 순서(평일, 토요일, 일요일)가 DAY_TYPES 순서와 같다.
  return new Map(
    parseCsv(csv).map(([, name = "", ...perDay]) => [baseStationName(name), mapDayTypes((_, i) => Number(perDay[i]))]),
  );
}

function transferOf(
  name: string,
  perDay: ReturnType<typeof readTransfer>,
  lineCounts: Record<string, number>,
): StationData["transfer"] {
  const found = perDay.get(name);
  if (!found) return null;
  const lineCount = lineCounts[name];
  if (lineCount === undefined) throw new Error(`환승역 ${name}의 노선 수가 batch/routes.ts 표에 없다`);
  return { perDay: found, lineCount };
}
