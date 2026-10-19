import { type Direction, type RefinedData, refinedDataSchema, type StationData } from "@shared/refined-data";
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
 * 승하차 행이 없는 역번호(3호선 충무로 등)는 혼잡도 역명을 쓴다. 승하차·환승인원은 역 이름 단위로 붙인다.
 * 갈래·지선 승강장은 혼잡도 특수 행과 빠른하차 다음 역으로 가른다(`batch/routes.ts`의 정차 정의).
 * **마지막에 스키마로 검증한다.** 형식이 어긋난 파일을 `public/data/`에 쓰지 않기 위해서다.
 */

/** 정차 한 방향 칸(`down`/`up`)을 원본의 다른 행에서 읽을 때. 없으면 같은 역번호·같은 방향 행이다. */
type SideSource = {
  /** 혼잡도 특수 행 역번호(예: 2호선 9001 성수E). */
  congestionCode?: string;
  congestionSide?: Direction;
  fastExitSide?: Direction;
};

/** 순서열의 정차. 역번호 하나, 또는 방향 칸마다 읽을 원본을 바꾼 정차. */
export type StopDefinition = string | ({ code: string } & Partial<Record<Direction, SideSource>>);

type RouteDefinition = {
  id: string;
  lineNumber: number;
  name: string;
  carCount: number;
  isLoop: boolean;
  /** 하행(down) 순서의 정차. `oneWay`가 있으면 그 방향으로만 탄다. */
  sequences: { oneWay?: Direction; stops: StopDefinition[] }[];
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
  const lineLabels = new Set(config.routes.map(lineLabel));
  const ridership = refineRidership(raw.ridershipCsv, lineLabels);
  const congestion = refineCongestion(raw.congestion.csv);
  const fastExit = refineFastExit(raw.fastExitItems, lineLabels);
  const transferPerDay = readTransfer(raw.transfer.csv);

  const stations: Record<string, StationData> = {};
  const routes = config.routes.map((route) => {
    const line = lineLabel(route);
    const sequences = route.sequences.map((sequence) => {
      const defs = sequence.stops.map((def) => (typeof def === "string" ? { code: def } : def));
      const names = defs.map(({ code }) => {
        const key = stationKey(line, code);
        const name = ridership.nameByKey.get(key) ?? congestion.get(key)?.name;
        if (!name) throw new Error(`${key} 역 이름을 어느 원본에서도 찾지 못했다`);
        stations[name] = {
          ridership: ridership.byName.get(name) ?? null,
          transfer: transferOf(name, transferPerDay, config.transferLineCounts),
        };
        return name;
      });
      // 방향 칸마다 그 방향으로 갈 때 다음 역. 순환 노선은 끝에서 처음으로 이어진다.
      const nextName = (i: number, direction: Direction) => {
        const next = i + (direction === "down" ? 1 : -1);
        return route.isLoop ? names[(next + names.length) % names.length] : names[next];
      };
      const stops = defs.map((def, i) => {
        const side = (direction: Direction) => {
          const source = def[direction] ?? {};
          const congestionKey = stationKey(line, source.congestionCode ?? def.code);
          const facilities = fastExit.byStation.get(stationKey(line, def.code))?.[source.fastExitSide ?? direction];
          return {
            congestion: congestion.get(congestionKey)?.congestion[source.congestionSide ?? direction] ?? null,
            fastExit: toFastExitSide(facilities, nextName(i, direction), route.carCount),
          };
        };
        const down = side("down");
        const up = side("up");
        return {
          name: names[i] ?? "",
          congestion: { down: down.congestion, up: up.congestion },
          fastExit: { down: down.fastExit, up: up.fastExit },
        };
      });
      return { oneWay: sequence.oneWay ?? null, stops };
    });
    return {
      id: route.id,
      lineNumber: route.lineNumber,
      name: route.name,
      carCount: route.carCount,
      isLoop: route.isLoop,
      sequences,
    };
  });

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
