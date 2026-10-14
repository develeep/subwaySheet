import type { Direction, RefinedData } from "@shared/refined-data";
import { fetchRefinedData } from "@web/api/refined-data-api";
import { clockOf } from "@web/recommend/clock";
import { recommend, stationOptions } from "@web/recommend/recommend";
import { useEffect, useState } from "react";

/**
 * useSeatFinder — 구간 선택 → 칸 추천 화면의 상태와 동작. `web/pages/seat-finder-page.tsx`만 부른다.
 * 정제 데이터를 한 번 읽고, 출발역·도착역·방향이 바뀔 때마다 추천 모듈 `recommend`를 다시 부른다(계산은 모두 그쪽).
 * 시각과 요일유형은 화면을 연 순간 값으로 고정한다(#3). 고르기는 #4에서 더한다.
 */

type Tab = "segment" | "result";
type PickerTarget = "from" | "to";
type DataState = { status: "loading" } | { status: "ok"; data: RefinedData } | { status: "failed" };

// 디자인 시안(design/prototype.html)의 처음 구간.
const INITIAL_FROM = "신도림";
const INITIAL_TO = "강남";

export function useSeatFinder() {
  const [dataState, setDataState] = useState<DataState>({ status: "loading" });
  const [clock] = useState(() => clockOf(new Date()));
  const [from, setFrom] = useState(INITIAL_FROM);
  const [to, setTo] = useState(INITIAL_TO);
  const [direction, setDirection] = useState<Direction | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("segment");
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
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
  const result = data ? recommend({ from, to, direction, ...clock }, data) : null;
  const trimmedQuery = query.trim();
  const matches = data ? stationOptions(data).filter((option) => option.name.includes(trimmedQuery)) : [];

  function openPicker(target: PickerTarget) {
    setQuery("");
    setPickerTarget(target);
  }

  function closePicker() {
    setPickerTarget(null);
  }

  function pickStation(name: string) {
    if (pickerTarget === "from") setFrom(name);
    if (pickerTarget === "to") setTo(name);
    setDirection(undefined);
    setPickerTarget(null);
  }

  function swapStations() {
    setFrom(to);
    setTo(from);
    setDirection(undefined);
  }

  function flipDirection() {
    if (result?.status !== "ok") return;
    setDirection(result.direction === "down" ? "up" : "down");
  }

  return {
    dataStatus: dataState.status,
    clock,
    from,
    to,
    result,
    tab,
    setTab,
    pickerTarget,
    query,
    setQuery,
    matches,
    openPicker,
    closePicker,
    pickStation,
    swapStations,
    flipDirection,
  };
}
