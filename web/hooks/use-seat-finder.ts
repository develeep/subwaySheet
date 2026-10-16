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
 * 시각과 요일유형의 기본값은 화면을 연 순간 값이다. 화면을 열어 둔 채 시간이 지나도 저절로 다시 읽지 않고, 시각 시트의 "지금"을 누를 때만 시계를 다시 읽는다.
 */

type Step = "segment" | "result";
type SheetTarget = "from" | "to" | "dayType" | "time";
type DataState = { status: "loading" } | { status: "ok"; data: RefinedData } | { status: "failed" };

// 디자인 시안(design/prototype.html)의 처음 구간.
const INITIAL_FROM = "신도림";
const INITIAL_TO = "강남";

export function useSeatFinder() {
  const [dataState, setDataState] = useState<DataState>({ status: "loading" });
  const [nowClock, setNowClock] = useState(() => clockOf(new Date()));
  const [departMinute, setDepartMinute] = useState(nowClock.departMinute);
  const [dayType, setDayType] = useState<DayType>(nowClock.dayType);
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

  // 요일유형은 그대로 둔다. 자정을 넘겨 오늘 요일유형이 바뀌었으면 "지금" 표시가 붙지 않아 요일유형을 다시 고르라는 신호가 된다.
  function pickNowTime() {
    const now = clockOf(new Date());
    setNowClock(now);
    pickTime(now.departMinute);
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
    clockText: formatClock(departMinute),
    // 시각·요일유형 둘 다 마지막으로 읽은 지금 값일 때만 "지금"이다. 공휴일에 평일로 바꾸면 "지금"을 떼어 오늘이 평일로 읽히지 않게 한다.
    isNow: departMinute === nowClock.departMinute && dayType === nowClock.dayType,
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
    pickNowTime,
    swapStations,
    flipDirection,
  };
}
