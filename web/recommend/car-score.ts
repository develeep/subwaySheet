import {
  type DayType,
  type Direction,
  type FastExitSide,
  type RouteStop,
  type StationData,
  TIME_SLOT_COUNT,
} from "@shared/refined-data";
import { FORMULA, FULL_LOAD_PER_CAR, SEATS_PER_CAR } from "./formula";

/**
 * scoreCars — 구간의 칸 점수를 매겨 추천 칸·화면 규칙(칸 차이 작음·바로 앉음·2등 칸)을 정한다. `recommend.ts`만 부른다.
 * 칸 점수 = 1 − 서서 가는 기대 시간 ÷ 구간 소요 시간이다(0~1, `rideAlong`). Jenelius의 "서서 가는 기대 시간" 지표와 같은 꼴이다
 * (https://www.worldtransitresearch.info/research/7934).
 * 중간 역마다 내린 자리를 그때 그 칸에 서 있는 사람이 나눠 앉고, 그 역에서 탄 사람이 다음 경쟁자가 된다(ADR 0006).
 * - 열차당 승하차 = (카드 승하차 + 환승 추정) × 방향 몫 × 배차 간격. 환승 추정 = 환승인원 ÷ 노선 수 × 그 역 승하차 시간대 비율.
 * - 칸 분포: 카드 승하차는 출입설비 칸에서 퍼진다. 환승객은 환승역 표에 그 역·방향의 환승통로 칸(`transferCars`)이 있으면
 *   그 칸들에서 같은 퍼짐으로, 없으면 출입설비 칸에서 퍼진다(#7).
 * - 카드 승하차는 호선을 합친 역 합계라(`batch/ridership.ts`) 그 역에 데이터 있는 정차로 서는 노선 수(`routeCounts`, 지선 포함)로 나눠
 *   노선 하나 몫으로 쓴다. 환승인원의 노선 수(`transfer.lineCount`)는 코레일·민자 노선까지 센 다른 값이다.
 *   나누지 않으면 환승역에서 다른 호선 열차에서 내린 사람까지 세어 환승역 칸이 과하게 유리해진다(#6).
 * - 탄 사람의 칸 분포는 두 집단을 섞는다(#23): 몫 p_c(`destinationShare`)는 내릴 역의 하차 칸 분포를, 나머지는 탄 역의 분포를 따른다.
 *   내릴 역 j의 비중 P(j | i)는 OD 없이 i 아래쪽 역(도착역 너머 `beyond`까지, `reach`정거장 안)의 하차 인원 비중으로 근사한다.
 * - 시간은 역 사이 운행시간(`secondsFromPrevious`)으로 센다. 값이 없는 구간(데이터 없는 역에 닿은 구간)은 정거장당 `minutesPerStop`분이다(#25).
 *   중간 역 도착 시각 = 출발 시각 + 그 역까지 걸린 시간. 앞쪽 역 가중치 = 그 역에서 도착역까지 남은 시간 ÷ 구간 소요 시간.
 *   역 사이가 긴 구간 뒤에서 앉으면 그만큼 덜 앉아 간다.
 * - 출발역에서 서 있는 사람 = 이미 타고 있던 사람(칸마다 같게) + 출발역에서 탄 사람(위의 섞은 분포로 몰림).
 * - 출발역 혼잡도가 없으면(코레일 구간 출발 등) 혼잡도가 있는 첫 중간 역의 값(그 역 도착 시간대)으로 서 있는 사람을 잡는다.
 *   0으로 두면 첫 중간 역에서 모두 앉는 것으로 계산돼 칸 차이가 사라진다(#10). 실제 데이터에서 점수에 드는 중간 역은 모두 혼잡도가 있어 대신할 값이 늘 있다.
 *   바로 앉음은 출발역 자체 혼잡도로만 판정한다.
 * - 데이터 없는 역(`isDataless` 정차, 승하차·빠른하차가 없는 중간 역)은 점수에서 빼지만 정거장 순서(도착 시간대·가중치)에는 센다.
 *   빠진 역은 출발·도착역(`isDataless`일 때)까지 이어진 범위로 묶어 돌려준다.
 */

/** 도착역 너머 역과 출발역부터 정거장 수·걸린 시간(분, `minutesAlong`). */
export type BeyondStop = { stop: RouteStop; stopsAfter: number; minutesAfter: number };

export type CarScoreInput = {
  carCount: number;
  /** 구간의 역(탈 순서). 처음 = 출발역, 끝 = 도착역. */
  stops: RouteStop[];
  /** 갈래 노선은 여러 갈래의 역이 섞여 순서가 없다. */
  beyond: BeyondStop[];
  /** 한 역에서 탄 사람이 가는 가장 먼 정거장 수. 순환 노선은 반 바퀴, 아니면 Infinity. */
  reach: number;
  direction: Direction;
  dayType: DayType;
  departMinute: number;
  stations: Record<string, StationData>;
  /** 역 이름 → 그 역에 데이터 있는 정차로 서는 노선 수(지선 포함). 승하차를 노선 몫으로 나눌 때 쓴다. */
  routeCounts: Map<string, number>;
};

export type CarScoreResult = {
  /** 추천 칸 번호(1부터, 그 방향 승강장 번호의 앞자리). 1등 칸이 먼저다. */
  picks: number[];
  isWeakGap: boolean;
  canSitAtOrigin: boolean;
  reason: { station: string; stopsAfter: number };
  /** 계산에서 빠진 역을 이어진 범위로 묶은 것(탈 순서). 범위 하나는 역 이름 목록이다. */
  missingRanges: string[][];
  evenlySpreadStations: string[];
};

/** 점수에 든 중간 역. `freedByCar`는 칸마다 앉아 있던 사람이 내려 난 자리(앞쪽 역 가중)이고 이유 역을 고를 때 쓴다. */
type ScoredStop = { station: string; stopsAfter: number; freedByCar: number[] };

/** 계산할 중간 역이 하나도 없으면 null. */
export function scoreCars(input: CarScoreInput): CarScoreResult | null {
  const minutes = minutesAlong(input.stops, input.direction);
  const exits = exitsAhead(input, minutes);
  const origin = standingAtOrigin(input, minutes, exits(0));
  const ride = rideAlong(input, minutes, origin.standing, exits);
  if (ride.scored.length === 0) return null;
  return {
    ...judge(ride, origin.load),
    missingRanges: rangesOf(input.stops, ride.isMissing),
    evenlySpreadStations: ride.evenlySpreadStations,
  };
}

/**
 * 탈 순서로 놓인 정차마다 처음 정차부터 걸린 시간(분). 하행은 뒤 정차의 `secondsFromPrevious`, 상행은 앞 정차의 값이 그 사이 시간이다
 * (순서열 앞 정차에서 온 값이라서). 값이 없으면 정거장당 `minutesPerStop`분이다. `recommend.ts`가 도착역 너머 역에도 쓴다.
 */
export function minutesAlong(stops: RouteStop[], direction: Direction): number[] {
  let elapsed = 0;
  return stops.map((stop, k) => {
    const seconds = k === 0 ? 0 : (direction === "down" ? stop : stops[k - 1])?.secondsFromPrevious;
    elapsed += seconds == null ? FORMULA.minutesPerStop : seconds / 60;
    return elapsed;
  });
}

/** 그 정차 승하차(요일유형) 중 이 노선 몫. 승하차가 없거나 데이터 없는 정차면 null(1호선 신도림의 승하차는 2호선 값이다). */
function routeShare({ stations, dayType, routeCounts }: CarScoreInput, stop: RouteStop) {
  const ridership = stations[stop.name]?.ridership?.[dayType];
  if (stop.isDataless || !ridership) return null;
  const count = routeCounts.get(stop.name) ?? 1;
  return { boarding: ridership.boarding.map((v) => v / count), alighting: ridership.alighting.map((v) => v / count) };
}

/**
 * 그 정차의 칸별 시간당 하차·승차(카드 + 환승)와 출입설비 분포. 데이터 없는 정차·승하차 없음·그 방향 빠른하차 없음이면 null.
 * 카드 승하차는 출입설비 칸에서, 환승객은 환승통로 칸(표에 없으면 출입설비 칸)에서 퍼진다. 환승객은 내리는 만큼 탄다고 본다.
 */
function flowAt(input: CarScoreInput, stop: RouteStop, minutesAfter: number) {
  const { carCount, direction, dayType, departMinute } = input;
  const side = stop.fastExit[direction];
  const station = input.stations[stop.name];
  const ridership = routeShare(input, stop);
  if (!station || !ridership || side.isMissing) return null;
  const slot = slotOfMinute(departMinute + minutesAfter);
  const spread = carSpread(side, carCount);
  const transferCars = stop.transferCars[direction];
  const transferSpread =
    transferCars.length > 0
      ? spreadFrom(
          transferCars.map((car) => ({ car, weight: 1 })),
          carCount,
        )
      : spread;
  const transferring = transferPerHour(station, dayType, slot);
  const byCar = (hourly: number[]) =>
    spread.map((share, car) => (hourly[slot] ?? 0) * share + transferring * (transferSpread[car] ?? 0));
  return { side, slot, alighting: byCar(ridership.alighting), boarding: byCar(ridership.boarding) };
}

/**
 * 구간의 k번째 역에서 탄 사람이 내릴 역들의 칸별 하차를 합친 분포(합 1)를 돌려주는 함수. 아래쪽 역은 k 뒤의 구간 역과 도착역 너머 역 중
 * `reach`정거장 안이고, 각 역의 하차는 그 역 도착 시간대 값이다. 데이터 있는 아래쪽 역이 없으면 null(탄 역 분포만 쓴다).
 */
function exitsAhead(input: CarScoreInput, minutes: number[]): (k: number) => number[] | null {
  const stops = input.stops.map((stop, k) => ({ stop, stopsAfter: k, minutesAfter: minutes[k] ?? 0 }));
  const ahead = [...stops, ...input.beyond].flatMap(({ stop, stopsAfter, minutesAfter }) => {
    const flow = flowAt(input, stop, minutesAfter);
    return flow ? [{ stopsAfter, alighting: flow.alighting }] : [];
  });
  return (k) => {
    const sum = new Array<number>(input.carCount).fill(0);
    for (const { stopsAfter, alighting } of ahead) {
      if (stopsAfter <= k || stopsAfter - k > input.reach) continue;
      alighting.forEach((value, car) => {
        sum[car] = (sum[car] ?? 0) + value;
      });
    }
    const total = sum.reduce((a, b) => a + b, 0);
    return total > 0 ? sum.map((value) => value / total) : null;
  };
}

/** 칸마다 탄 사람을 섞는다. 전체 인원은 두고, 몫 p_c는 내릴 역 분포(`exits`)로 옮긴다. */
function towardExits(boarding: number[], exits: number[] | null): number[] {
  if (!exits) return boarding;
  const total = boarding.reduce((a, b) => a + b, 0);
  const share = FORMULA.destinationShare;
  return boarding.map((value, car) => (1 - share) * value + share * total * (exits[car] ?? 0));
}

/** 출발역에서 칸마다 서 있는 사람 = 이미 타고 있던 사람(칸마다 같게) + 출발역에서 탄 사람(출입설비·내릴 역 쪽으로 몰림). */
function standingAtOrigin(
  input: CarScoreInput,
  minutes: number[],
  exits: number[] | null,
): { standing: number[]; load: number | null } {
  const { carCount, direction, dayType, departMinute } = input;
  const origin = input.stops[0] as RouteStop;
  const slot = slotOfMinute(departMinute);
  const load = loadAt(origin, direction, dayType, slot);
  const standingAverage = Math.max(0, (load ?? firstMiddleLoad(input, minutes) ?? 0) - SEATS_PER_CAR);
  const ridership = routeShare(input, origin);
  const boardingPerCar = ridership
    ? ((ridership.boarding[slot] ?? 0) * FORMULA.directionShare * headway(dayType, slot)) / 60 / carCount
    : 0;
  const boarded = Math.min(standingAverage, boardingPerCar);
  const standing = towardExits(carSpread(origin.fastExit[direction], carCount), exits).map(
    (share) => standingAverage - boarded + boarded * carCount * share,
  );
  return { standing, load };
}

/** 혼잡도가 있는 첫 중간 역의 칸당 인원(그 역 도착 시간대). 출발역 혼잡도가 없을 때 대신 쓴다. 하나도 없으면 null. */
function firstMiddleLoad({ stops, direction, dayType, departMinute }: CarScoreInput, minutes: number[]): number | null {
  for (let k = 1; k < stops.length - 1; k++) {
    const load = loadAt(stops[k] as RouteStop, direction, dayType, slotOfMinute(departMinute + (minutes[k] ?? 0)));
    if (load !== null) return load;
  }
  return null;
}

/**
 * 출발역에서 그 칸에 서 있던 나를 태우고 중간 역마다 칸별로 걷는다. 데이터 없는 역은 건너뛴다(서 있는 사람도 그대로 둔다).
 * 역마다: 서 있던 사람 일부가 내리고 → 앉아 있던 사람이 내린 자리를 지금 서 있는 사람이 나눠 앉고 → 탄 사람이 출입설비·내릴 역 쪽에 선다.
 * 서 있는 사람의 칸별 모양은 이 걷기로, 규모는 그 역을 떠나는 혼잡도로 맞춘다(혼잡도가 없으면 걷기 값 그대로).
 * 칸 점수 = Σ 가중치 × 그 역에서 처음 앉는 몫 = 1 − 서서 가는 기대 시간 ÷ 구간 소요 시간이다.
 */
function rideAlong(
  input: CarScoreInput,
  minutes: number[],
  standingAtStart: number[],
  exits: (k: number) => number[] | null,
) {
  const { carCount, direction, dayType } = input;
  const total = input.stops.length - 1;
  const totalMinutes = minutes[total] ?? 0;
  const standing = [...standingAtStart];
  const stillStanding = new Array<number>(carCount).fill(1);
  const expected = new Array<number>(carCount).fill(0);
  const freedTotal = new Array<number>(carCount).fill(0);
  const scored: ScoredStop[] = [];
  // 정차마다 계산에서 빠졌는지. 출발·도착역은 데이터 없는 정차일 때만 빠진 것으로 본다.
  const isMissing = input.stops.map((stop) => stop.isDataless);
  const evenlySpreadStations: string[] = [];
  for (let k = 1; k < total; k++) {
    const stop = input.stops[k] as RouteStop;
    const flow = flowAt(input, stop, minutes[k] ?? 0);
    if (!flow) {
      isMissing[k] = true;
      continue;
    }
    if (flow.side.isElevatorOnly) evenlySpreadStations.push(stop.name);

    const { slot } = flow;
    const toPerTrain = (FORMULA.directionShare * headway(dayType, slot)) / 60;
    const previousLoad = loadAt(input.stops[k - 1] as RouteStop, direction, dayType, slot);
    const seatedShare =
      previousLoad === null ? FORMULA.unknownSeatedShare : Math.min(1, SEATS_PER_CAR / Math.max(previousLoad, 1));
    const weight = (totalMinutes - (minutes[k] ?? 0)) / totalMinutes;
    const boardingByCar = towardExits(flow.boarding, exits(k));

    const freedByCar = new Array<number>(carCount).fill(0);
    for (let car = 0; car < carCount; car++) {
      // 열차 한 대·칸 하나에서 내리고 타는 사람.
      const alighting = toPerTrain * (flow.alighting[car] ?? 0);
      const freed = alighting * seatedShare;
      const standingNow = Math.max(0, (standing[car] ?? 0) - alighting * (1 - seatedShare));
      // 서 있는 사람이 없으면 빈자리가 있다는 뜻이라 바로 앉는다.
      const take = standingNow > 0 ? Math.min(1, freed / standingNow) : 1;
      const seatedHere = (stillStanding[car] ?? 0) * take;
      stillStanding[car] = (stillStanding[car] ?? 0) - seatedHere;
      expected[car] = (expected[car] ?? 0) + weight * seatedHere;
      freedByCar[car] = weight * freed;
      freedTotal[car] = (freedTotal[car] ?? 0) + weight * freed;
      const leftoverSeats = Math.max(0, freed - standingNow);
      const boarding = toPerTrain * (boardingByCar[car] ?? 0);
      standing[car] = standingNow - Math.min(freed, standingNow) + Math.max(0, boarding - leftoverSeats);
    }
    scaleToLoad(standing, loadAt(stop, direction, dayType, slot));
    scored.push({ station: stop.name, stopsAfter: k, freedByCar });
  }
  return { expected, freedTotal, scored, isMissing, evenlySpreadStations };
}

/** 칸별 서 있는 사람의 모양은 두고 평균을 그 역 혼잡도의 서 있는 사람(칸당 인원 - 좌석)에 맞춘다. 혼잡도가 없으면 그대로. */
function scaleToLoad(standing: number[], load: number | null) {
  if (load === null) return;
  const target = Math.max(0, load - SEATS_PER_CAR);
  const mean = standing.reduce((a, b) => a + b, 0) / standing.length;
  standing.forEach((value, car) => {
    standing[car] = mean > 0 ? (value * target) / mean : target;
  });
}

/** 빠진 정차를 이어진 범위로 묶는다. */
function rangesOf(stops: RouteStop[], isMissing: boolean[]): string[][] {
  const ranges: string[][] = [];
  stops.forEach((stop, k) => {
    if (!isMissing[k]) return;
    const last = ranges.at(-1);
    if (last && isMissing[k - 1]) last.push(stop.name);
    else ranges.push([stop.name]);
  });
  return ranges;
}

/**
 * 칸 점수(앉아 갈 것으로 기대되는 몫)로 추천 칸·칸 차이 작음·바로 앉음·이유 역을 정한다.
 * 점수가 같으면(모두 바로 앉는 한산한 열차) 자리가 많이 나는 칸을 앞세운다. 이유 역은 1등 칸에서 자리가 가장 많이 나는 역이다.
 */
function judge({ expected: score, freedTotal, scored }: ReturnType<typeof rideAlong>, originLoad: number | null) {
  const order = score
    .map((_, car) => car)
    .sort((a, b) => (score[b] ?? 0) - (score[a] ?? 0) || (freedTotal[b] ?? 0) - (freedTotal[a] ?? 0));
  const [top = 0, second = 0] = order;
  const topScore = score[top] ?? 0;
  const picks = [top];
  if (score.length > 1 && (score[second] ?? 0) >= topScore * (1 - FORMULA.secondCarWithin)) picks.push(second);

  const canSitAtOrigin = originLoad !== null && originLoad < SEATS_PER_CAR;
  const mean = score.reduce((a, b) => a + b, 0) / score.length;
  // 서서 가는 시간 = (1 - 점수) × 구간 소요 시간. 1등 칸이 평균 칸보다 이를 얼마나 줄이는지. 첫 구간은 누구나 서서 가서 점수 < 1이다.
  const standingCut = (topScore - mean) / (1 - mean);
  const reason = scored.reduce((best, s) => ((s.freedByCar[top] ?? 0) > (best.freedByCar[top] ?? 0) ? s : best));
  return {
    picks: picks.map((car) => car + 1),
    isWeakGap: standingCut < FORMULA.weakBelowCut,
    canSitAtOrigin,
    reason: { station: reason.station, stopsAfter: reason.stopsAfter },
  };
}

/** 분(0시 기준)을 시간대 인덱스로. 0 = 06시 이전, 1 = 06~07시, …, 18 = 23~24시, 19 = 24시 이후(0시대). */
function slotOfMinute(minute: number): number {
  const hour = Math.floor((((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY) / 60);
  if (hour === 0) return AFTER_MIDNIGHT_SLOT;
  return hour < FIRST_HOUR ? 0 : hour - FIRST_HOUR + 1;
}

const MINUTES_PER_DAY = 24 * 60;
/** 시간대 1이 시작하는 시(06시). 그 앞은 시간대 0(06시 이전)이다. */
const FIRST_HOUR = 6;
const AFTER_MIDNIGHT_SLOT = TIME_SLOT_COUNT - 1;
const hourOfSlot = (slot: number) => slot + FIRST_HOUR - 1;

function headway(dayType: DayType, slot: number): number {
  const hour = hourOfSlot(slot);
  if (slot === 0 || hour >= FORMULA.nightFromHour) return FORMULA.headway.night;
  if (dayType !== "weekday") return FORMULA.headway.day;
  if (FORMULA.peakHours.includes(hour)) return FORMULA.headway.peak;
  if (FORMULA.shoulderHours.includes(hour)) return FORMULA.headway.shoulder;
  return FORMULA.headway.day;
}

/** 그 역을 떠나는 열차의 칸당 인원(혼잡도 기준). 혼잡도가 없으면 null. */
function loadAt(stop: RouteStop, direction: Direction, dayType: DayType, slot: number): number | null {
  const percent = stop.congestion[direction]?.[dayType][slot];
  return percent === undefined ? null : (percent / 100) * FULL_LOAD_PER_CAR;
}

/** 그 역 그 시간대에 갈아타는 사람(시간당, 노선 하나 몫). 역 일평균을 그 역 승하차의 시간대 비율로 나눈다. */
function transferPerHour(station: StationData, dayType: DayType, slot: number): number {
  const ridership = station.ridership?.[dayType];
  if (!station.transfer || !ridership) return 0;
  const both = ridership.boarding.map((on, i) => on + (ridership.alighting[i] ?? 0));
  const daily = both.reduce((a, b) => a + b, 0) || 1;
  return (station.transfer.perDay[dayType] * (both[slot] ?? 0)) / daily / station.transfer.lineCount;
}

/** 출입설비 칸에서 칸별로 퍼지는 하차 분포(합 1). 엘리베이터뿐이거나 설비가 없으면 칸마다 고르게.
 * 엘리베이터뿐인 역은 계단 행이 빠진 것이라 분포를 믿을 수 없다(을지로3가를 그대로 쓰면 홍대입구→잠실 추천이 바뀐다, 프로토타입 FINDINGS). */
function carSpread(side: FastExitSide, carCount: number): number[] {
  if (side.isElevatorOnly || side.facilities.length === 0) return new Array<number>(carCount).fill(1 / carCount);
  const sources = side.facilities.map((f) => ({
    car: f.car,
    weight: f.kind === "elevator" ? FORMULA.elevatorWeight : 1,
  }));
  return spreadFrom(sources, carCount);
}

/** 칸(가중치)들에서 퍼지는 분포(합 1). 출입설비와 환승통로가 같은 퍼짐을 쓴다. */
function spreadFrom(sources: { car: number; weight: number }[], carCount: number): number[] {
  const kernel = new Array<number>(carCount).fill(0);
  for (const source of sources) {
    for (let car = 1; car <= carCount; car++) {
      kernel[car - 1] =
        (kernel[car - 1] ?? 0) + source.weight * Math.exp(-Math.abs(car - source.car) / FORMULA.spreadCars);
    }
  }
  const sum = kernel.reduce((a, b) => a + b, 0);
  return kernel.map((v) => ((1 - FORMULA.uniformShare) * v) / sum + FORMULA.uniformShare / carCount);
}
