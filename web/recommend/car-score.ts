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
 * scoreCars — 구간의 칸 점수를 매겨 추천 칸·앉을 가능성·화면 규칙을 정한다. `recommend.ts`만 부른다.
 * 칸 점수 = Σ(중간 역) 가중치 × 열차당 하차 인원 × 칸 분포 × 앉아 있던 비율 ÷ 출발역에서 그 칸에 서 있는 사람(스펙 #2).
 * - 열차당 하차 인원 = (카드 하차 + 환승 하차 추정) × 방향 몫 × 배차 간격. 환승 하차 = 환승인원 ÷ 노선 수 × 그 역 승하차 시간대 비율.
 * - 칸 분포: 카드 하차는 출입설비 칸에서 퍼진다. 환승 하차는 환승역 표에 그 역·방향의 환승통로 칸(`transferCars`)이 있으면
 *   그 칸들에서 같은 퍼짐으로, 없으면 출입설비 칸에서 퍼진다(#7).
 * - 카드 승하차는 호선을 합친 역 합계라(`batch/ridership.ts`) 그 역을 지나는 정제 데이터 노선 수(`routeCounts`, 지선 포함)로 나눠
 *   노선 하나 몫으로 쓴다. 환승인원의 노선 수(`transfer.lineCount`)는 코레일·민자 노선까지 센 다른 값이다.
 *   나누지 않으면 환승역에서 다른 호선 열차에서 내린 사람까지 세어 환승역 칸이 과하게 유리해진다(#6).
 * - 앞쪽 역 가중치 = 남은 정거장 비례 (total - k) / (total - 1).
 * - 서 있는 사람 = 이미 타고 있던 사람(칸마다 같게) + 출발역에서 탄 사람(출발역 출입설비 쪽으로 몰림).
 *   **이 가정 때문에 양 끝 칸이 늘 불리하다**(1단계에서 감수, 스펙 #2 Further Notes).
 * - 출발역 혼잡도가 없으면 서 있는 사람을 0으로 둔다(프로토타입 그대로). 바꾸는 규칙은 #10에서 정한다.
 */

type Grade = "high" | "mid" | "low";

export type CarScoreInput = {
  carCount: number;
  /** 구간의 역(탈 순서). 처음 = 출발역, 끝 = 도착역. */
  stops: RouteStop[];
  direction: Direction;
  dayType: DayType;
  departMinute: number;
  stations: Record<string, StationData>;
  /** 역 이름 → 그 역을 지나는 노선 수(정제 데이터의 노선, 지선 포함). 승하차를 노선 몫으로 나눌 때 쓴다. */
  routeCounts: Map<string, number>;
};

export type CarScoreResult = {
  /** 추천 칸 번호(1부터, 그 방향 승강장 번호의 앞자리). 1등 칸이 먼저다. */
  picks: number[];
  grade: Grade;
  isWeakGap: boolean;
  canSitAtOrigin: boolean;
  reason: { station: string; stopsAfter: number };
  missingStations: string[];
  evenlySpreadStations: string[];
};

type ScoredStop = { station: string; stopsAfter: number; byCar: number[] };

/** 계산할 중간 역이 하나도 없으면 null. */
export function scoreCars(input: CarScoreInput): CarScoreResult | null {
  const origin = standingAtOrigin(input);
  const seats = freedSeats(input);
  if (seats.scored.length === 0) return null;
  return {
    ...judge(seats.freed, origin.standing, origin.load, seats.scored),
    missingStations: seats.missingStations,
    evenlySpreadStations: seats.evenlySpreadStations,
  };
}

/** 그 역 승하차(요일유형) 중 이 노선 몫. 승하차가 없으면 null. */
function routeShare({ stations, dayType, routeCounts }: CarScoreInput, name: string) {
  const ridership = stations[name]?.ridership?.[dayType];
  if (!ridership) return null;
  const count = routeCounts.get(name) ?? 1;
  return { boarding: ridership.boarding.map((v) => v / count), alighting: ridership.alighting.map((v) => v / count) };
}

/** 출발역에서 칸마다 서 있는 사람 = 이미 타고 있던 사람(칸마다 같게) + 출발역에서 탄 사람(출입설비 쪽으로 몰림). */
function standingAtOrigin(input: CarScoreInput): { standing: number[]; load: number | null } {
  const { carCount, direction, dayType, departMinute } = input;
  const origin = input.stops[0] as RouteStop;
  const slot = slotOfMinute(departMinute);
  const load = loadAt(origin, direction, dayType, slot);
  const standingAverage = load === null ? 0 : Math.max(0, load - SEATS_PER_CAR);
  const ridership = routeShare(input, origin.name);
  const boardingPerCar = ridership
    ? ((ridership.boarding[slot] ?? 0) * FORMULA.directionShare * headway(dayType, slot)) / 60 / carCount
    : 0;
  const boarded = Math.min(standingAverage, boardingPerCar);
  const standing = carSpread(origin.fastExit[direction], carCount).map(
    (share) => standingAverage - boarded + boarded * carCount * share,
  );
  return { standing, load };
}

/** 중간 역마다 칸별로 나는 자리(가중치 × 열차당 하차 × 칸 분포 × 앉아 있던 비율)를 더한다. 데이터 없는 역은 뺀다. */
function freedSeats(input: CarScoreInput) {
  const { carCount, direction, dayType, departMinute, stations } = input;
  const total = input.stops.length - 1;
  const freed = new Array<number>(carCount).fill(0);
  const scored: ScoredStop[] = [];
  const missingStations: string[] = [];
  const evenlySpreadStations: string[] = [];
  for (let k = 1; k < total; k++) {
    const stop = input.stops[k] as RouteStop;
    const fastExitSide = stop.fastExit[direction];
    const station = stations[stop.name];
    const ridership = routeShare(input, stop.name);
    if (!station || !ridership || fastExitSide.isMissing) {
      missingStations.push(stop.name);
      continue;
    }
    if (fastExitSide.isElevatorOnly) evenlySpreadStations.push(stop.name);

    const slot = slotOfMinute(departMinute + k * FORMULA.minutesPerStop);
    const cardAlighting = ridership.alighting[slot] ?? 0;
    const transferring = transferAlighting(station, dayType, slot);
    const toPerTrain = (FORMULA.directionShare * headway(dayType, slot)) / 60;
    const previousLoad = loadAt(input.stops[k - 1] as RouteStop, direction, dayType, slot);
    const seatedShare =
      previousLoad === null ? FORMULA.unknownSeatedShare : Math.min(1, SEATS_PER_CAR / Math.max(previousLoad, 1));
    const weight = (total - k) / (total - 1);
    const spread = carSpread(fastExitSide, carCount);
    const transferCars = stop.transferCars[direction];
    const transferSpread =
      transferCars.length > 0
        ? spreadFrom(
            transferCars.map((car) => ({ car, weight: 1 })),
            carCount,
          )
        : spread;
    const byCar = spread.map(
      (share, car) =>
        weight * toPerTrain * (cardAlighting * share + transferring * (transferSpread[car] ?? 0)) * seatedShare,
    );
    byCar.forEach((value, car) => {
      freed[car] = (freed[car] ?? 0) + value;
    });
    scored.push({ station: stop.name, stopsAfter: k, byCar });
  }
  return { freed, scored, missingStations, evenlySpreadStations };
}

/** 빈자리 ÷ 서 있는 사람으로 추천 칸·앉을 가능성·칸 차이 작음·바로 앉음·이유 역을 정한다. */
function judge(freed: number[], standing: number[], originLoad: number | null, scored: ScoredStop[]) {
  const ratio = freed.map((value, car) => value / Math.max(1, standing[car] ?? 0));
  const order = ratio.map((_, car) => car).sort((a, b) => (ratio[b] ?? 0) - (ratio[a] ?? 0));
  const [top = 0, second = 0] = order;
  const topRatio = ratio[top] ?? 0;
  const picks = [top];
  if (ratio.length > 1 && (ratio[second] ?? 0) >= topRatio * (1 - FORMULA.secondCarWithin)) picks.push(second);

  const canSitAtOrigin = originLoad !== null && originLoad < SEATS_PER_CAR;
  const mean = ratio.reduce((a, b) => a + b, 0) / ratio.length;
  const lift = mean > 0 ? topRatio / mean : 1;
  const reason = scored.reduce((best, s) => ((s.byCar[top] ?? 0) > (best.byCar[top] ?? 0) ? s : best));
  return {
    picks: picks.map((car) => car + 1),
    grade: canSitAtOrigin ? ("high" as const) : gradeOf(topRatio),
    isWeakGap: lift < FORMULA.weakBelow,
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

function transferAlighting(station: StationData, dayType: DayType, slot: number): number {
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

function gradeOf(ratio: number): Grade {
  if (ratio >= FORMULA.gradeHigh) return "high";
  return ratio >= FORMULA.gradeMid ? "mid" : "low";
}
