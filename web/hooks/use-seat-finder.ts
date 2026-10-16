import type { DayType, Direction, RefinedData } from "@shared/refined-data";
import { fetchRefinedData } from "@web/api/refined-data-api";
import { ERROR_TEXT, SHEET_TITLE } from "@web/constants/seat-finder-copy";
import { clockOf } from "@web/recommend/clock";
import { recommend, stationOptions } from "@web/recommend/recommend";
import { formatClock } from "@web/utils/format-clock";
import { useEffect, useState } from "react";

/**
 * useSeatFinder — 구간 선택 → 칸 추천 화면의 상태와 동작. `web/pages/seat-finder-page.tsx`만 부른다.
 * 정제 데이터를 한 번 읽고, 출발역·도착역·방향·시각·요일유형이 바뀔 때마다 추천 모듈 `recommend`를 다시 부른다(계산은 모두 그쪽).
 * 결과를 성공(`success`)과 오류 문구(`errorText`)로 나눠 주어 페이지는 그리기만 한다.
 * 시각과 요일유형의 기본값은 화면을 연 순간 값이다. 화면을 열어 둔 채 시간이 지나도 "지금"을 다시 읽지 않는다.
 */

type Step = "segment" | "result";
type SheetTarget = "from" | "to" | "dayType" | "time";
type DataState = { status: "loading" } | { status: "ok"; data: RefinedData } | { status: "failed" };

// 디자인 시안(design/prototype.html)의 처음 구간.
const INITIAL_FROM = "신도림";
const INITIAL_TO = "강남";

export function useSeatFinder() {
  const [dataState, setDataState] = useState<DataState>({ status: "loading" });
  const [openedClock] = useState(() => clockOf(new Date()));
  const [departMinute, setDepartMinute] = useState(openedClock.departMinute);
  const [dayType, setDayType] = useState<DayType>(openedClock.dayType);
  const [from, setFrom] = useState(INITIAL_FROM);
  const [to, setTo] = useState(INITIAL_TO);
  const [direction, setDirection] = useState<Direction | undefined>(undefined);
  const [step, setStep] = useState<Step>("segment");
  const [sheetTarget, setSheetTarget] = useState<SheetTarget | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let isActive = true;
    fetchRefinedData().then((result) => {
      if (isActive) setDataState(result);
    });
    return () => {
      isActive = false;
    };
  }, []);

  const data = dataState.status === "ok" ? dataState.data : null;
  const result = data ? recommend({ from, to, direction, departMinute, dayType }, data) : null;
  const success = result?.status === "ok" ? result : null;
  const errorText = result?.status === "error" ? ERROR_TEXT[result.error] : null;
  const sheetTitle = sheetTarget ? SHEET_TITLE[sheetTarget] : null;
  const trimmedQuery = query.trim();
  const matches = data ? stationOptions(data).filter((option) => option.name.includes(trimmedQuery)) : [];

  function openSheet(target: SheetTarget) {
    setQuery("");
    setSheetTarget(target);
  }

  function closeSheet() {
    setSheetTarget(null);
  }

  function pickStation(name: string) {
    if (sheetTarget === "from") setFrom(name);
    if (sheetTarget === "to") setTo(name);
    setDirection(undefined);
    setSheetTarget(null);
  }

  function pickDayType(picked: DayType) {
    setDayType(picked);
    setSheetTarget(null);
  }

  function pickTime(minute: number) {
    setDepartMinute(minute);
    setSheetTarget(null);
  }

  function swapStations() {
    setFrom(to);
    setTo(from);
    setDirection(undefined);
  }

  function flipDirection() {
    if (success?.oppositeDirection) setDirection(success.oppositeDirection);
  }

  return {
    dataStatus: dataState.status,
    dayType,
    departMinute,
    nowMinute: openedClock.departMinute,
    clockText: formatClock(departMinute),
    // 시각·요일유형 둘 다 연 순간 값일 때만 "지금"이다. 공휴일에 평일로 바꾸면 "지금"을 떼어 오늘이 평일로 읽히지 않게 한다.
    isNow: departMinute === openedClock.departMinute && dayType === openedClock.dayType,
    from,
    to,
    success,
    errorText,
    step,
    setStep,
    sheetTarget,
    sheetTitle,
    query,
    setQuery,
    matches,
    openSheet,
    closeSheet,
    pickStation,
    pickDayType,
    pickTime,
    swapStations,
    flipDirection,
  };
}
