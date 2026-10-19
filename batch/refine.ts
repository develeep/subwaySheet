import { type Direction, type RefinedData, refinedDataSchema, type StationData } from "@shared/refined-data";
import { refineCongestion } from "./congestion";
import { parseCsv } from "./csv";
import { mapDayTypes } from "./day-type";
import { refineFastExit, toFastExitSide } from "./fast-exit";
import { refineInterstation } from "./interstation";
import { refineRidership } from "./ridership";
import { baseStationName, stationKey } from "./station-key";

/**
 * refine — 원본 공공데이터를 공식 없는 정제 데이터(`shared/refined-data.ts`)로 만든다. `batch/main.ts`가 부른다.
 * 원본 읽기(파일·네트워크)는 여기 오기 전에 끝난다. 그래서 테스트는 픽스처 텍스트만 넣어 출력을 확인한다(스펙 #2 테스트 지점 2).
 * 역은 같은 호선 안의 역번호로 원본끼리 잇고(승하차·혼잡도 "201", 빠른하차 "0201"), 이름은 부기명을 뗀 승하차 역명을 쓴다.
 * 승하차 행이 없는 역번호(3호선 충무로 등)는 혼잡도 역명을 쓴다. 승하차·환승인원은 역 이름 단위로 붙인다.
 * 갈래·지선 승강장은 혼잡도 특수 행과 빠른하차 다음 역으로 가른다(`batch/routes.ts`의 정차 정의).
 * 환승역 표의 환승통로 칸은 노선·역·방향이 맞는 정차에 붙인다. 어느 정차에도 붙지 않는 행은 오타로 보고 멈춘다.
 * 역 사이 운행시간은 순서열의 이웃 정차 이름으로 찾는다. 데이터 있는 이웃 정차의 값이 없으면 멈춘다(역 이름이 바뀐 것을 놓치지 않으려고).
 * 데이터 없는 역(코레일 구간 등, #10)은 원본에 역번호·이름이 없어 이름으로 정의하고 원본 값을 비운다. 그 역 이름에 데이터 있는
 * 정차가 따로 있으면(1호선 신도림 = 2호선 신도림) 역 단위 값은 그 정차 쪽 것을 그대로 둔다.
 * **마지막에 스키마로 검증한다.** 형식이 어긋난 파일을 `public/data/`에 쓰지 않기 위해서다.
 */

/** 정차 한 방향 칸(`down`/`up`)을 원본의 다른 행에서 읽을 때. 없으면 같은 역번호·같은 방향 행이다. */
type SideSource = {
  /** 혼잡도 특수 행 역번호(예: 2호선 9001 성수E). */
  congestionCode?: string;
  congestionSide?: Direction;
  fastExitSide?: Direction;
};

/** 순서열의 정차. 역번호 하나, 방향 칸마다 읽을 원본을 바꾼 정차, 또는 이름만 있는 데이터 없는 역. */
export type StopDefinition =
  | string
  | ({ code: string } & Partial<Record<Direction, SideSource>>)
  | { datalessName: string };

type RouteDefinition = {
  id: string;
  lineNumber: number;
  name: string;
  carCount: number;
  isLoop: boolean;
  /** 하행(down) 순서의 정차. `oneWay`가 있으면 그 방향으로만 탄다. */
  sequences: { oneWay?: Direction; stops: StopDefinition[] }[];
};

/** 환승역 표 한 행: 그 노선을 그 방향으로 타고 와 그 역에서 `toLine`으로 갈아탈 때 환승통로와 가까운 칸. */
export type TransferPassage = {
  station: string;
  routeId: string;
  direction: Direction;
  toLine: string;
  /** 그 방향 칸 번호(진행 방향 맨 앞이 1번, CONTEXT.md "칸 번호"). */
  car: number;
  /** 어디서 확인했는지(공식 데이터·안내도·현장 확인). `toLine`과 함께 사람이 표를 확인하려고 둔 기록이고 정제 데이터에는 넣지 않는다. */
  source: string;
};

export type RefineConfig = {
  routes: RouteDefinition[];
  /** 환승역 이름 → 그 역에서 만나는 노선 수(코레일·민자 노선 포함). 환승인원을 노선 몫으로 나눌 때 앱이 쓴다. */
  transferLineCounts: Record<string, number>;
  /** 환승역 표(`batch/transfer-passages.ts`). 역마다 채워 나가고, 없는 역·방향은 앱이 빠른하차 칸 분포로 대신한다. */
  transferPassages: TransferPassage[];
};

export type RawSources = {
  ridershipCsv: string;
  congestion: { period: string; csv: string };
  transfer: { period: string; csv: string };
  fastExitItems: unknown[];
  /** 역 사이 운행시간 OA-12034 CSV. */
  interstationCsv: string;
};

export function refine(raw: RawSources, config: RefineConfig): RefinedData {
  const lineLabel = (route: RouteDefinition) => `${route.lineNumber}호선`;
  const lineLabels = new Set(config.routes.map(lineLabel));
  const ridership = refineRidership(raw.ridershipCsv, lineLabels);
  const congestion = refineCongestion(raw.congestion.csv);
  const fastExit = refineFastExit(raw.fastExitItems, lineLabels);
  const transferPerDay = readTransfer(raw.transfer.csv);
  const secondsBetween = refineInterstation(raw.interstationCsv);

  const stations: Record<string, StationData> = {};
  const usedPassages = new Set<TransferPassage>();
  const routes = config.routes.map((route) => {
    const line = lineLabel(route);
    const sequences = route.sequences.map((sequence) => {
      const defs = sequence.stops.map((def) => (typeof def === "string" ? { code: def } : def));
      const names = defs.map((def) => {
        if ("datalessName" in def) {
          stations[def.datalessName] ??= { ridership: null, transfer: null };
          return def.datalessName;
        }
        const key = stationKey(line, def.code);
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
      // 앞 정차에서 이 정차까지 운행시간. 둘 중 하나가 데이터 없는 역이면 비운다.
      const secondsFromPrevious = (i: number) => {
        const previous = i > 0 ? i - 1 : route.isLoop ? defs.length - 1 : -1;
        const previousDef = defs[previous];
        if (!previousDef || "datalessName" in previousDef || "datalessName" in (defs[i] ?? {})) return null;
        const [a = "", b = ""] = [names[previous], names[i]];
        const seconds = secondsBetween(route.lineNumber, a, b);
        if (seconds === undefined) throw new Error(`역 사이 운행시간 원본에 ${line} ${a}~${b} 행이 없다`);
        return seconds;
      };
      const stops = defs.map((def, i) => {
        if ("datalessName" in def) return datalessStop(def.datalessName, route.carCount);
        const side = (direction: Direction) => {
          const source = def[direction] ?? {};
          const congestionKey = stationKey(line, source.congestionCode ?? def.code);
          const facilities = fastExit.byStation.get(stationKey(line, def.code))?.[source.fastExitSide ?? direction];
          return {
            congestion: congestion.get(congestionKey)?.congestion[source.congestionSide ?? direction] ?? null,
            fastExit: toFastExitSide(facilities, nextName(i, direction), route.carCount),
          };
        };
        const transferCars = (direction: Direction) => {
          const rows = config.transferPassages.filter(
            (p) => p.routeId === route.id && p.station === names[i] && p.direction === direction,
          );
          for (const row of rows) {
            if (row.car > route.carCount)
              throw new Error(`환승역 표 ${row.station} ${row.car}번 칸이 ${route.name} 칸 수를 넘는다`);
            usedPassages.add(row);
          }
          return rows.map((p) => p.car);
        };
        const down = side("down");
        const up = side("up");
        return {
          name: names[i] ?? "",
          isDataless: false,
          congestion: { down: down.congestion, up: up.congestion },
          fastExit: { down: down.fastExit, up: up.fastExit },
          transferCars: { down: transferCars("down"), up: transferCars("up") },
          secondsFromPrevious: secondsFromPrevious(i),
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

  const unused = config.transferPassages.find((p) => !usedPassages.has(p));
  if (unused) throw new Error(`환승역 표의 ${unused.routeId} ${unused.station} 행이 어느 정차에도 붙지 않았다`);

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

function datalessStop(name: string, carCount: number) {
  const missing = toFastExitSide(undefined, undefined, carCount);
  return {
    name,
    isDataless: true,
    congestion: { down: null, up: null },
    fastExit: { down: missing, up: missing },
    transferCars: { down: [], up: [] },
    secondsFromPrevious: null,
  };
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
