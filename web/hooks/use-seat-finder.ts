import type { DayType, Direction, RefinedData } from "@shared/refined-data";
import { fetchRefinedData } from "@web/api/refined-data-api";
import { createRecommendation, createSurveyResponse } from "@web/api/survey-api";
import { ERROR_TEXT, SHEET_TITLE } from "@web/constants/seat-finder-copy";
import { followedTitle, SUBMIT_ERROR_TEXT, SURVEY_TITLE } from "@web/constants/survey-copy";
import { clockOf } from "@web/recommend/clock";
import { recommend, stationOptions } from "@web/recommend/recommend";
import { formatClock } from "@web/utils/format-clock";
import { otherCarsOf, stopChoicesOf } from "@web/utils/survey-choices";
import { useEffect, useRef, useState } from "react";

/**
 * useSeatFinder — 구간 선택 → 칸 추천 화면의 상태와 동작. `web/pages/seat-finder-page.tsx`만 부른다.
 * 정제 데이터를 한 번 읽고, 출발역·도착역·방향·시각·요일유형이 바뀔 때마다 추천 모듈 `recommend`를 다시 부른다(계산은 모두 그쪽).
 * 결과를 성공(`success`)과 오류 문구(`errorText`)로 나눠 주어 페이지는 그리기만 한다.
 * 시각과 요일유형의 기본값은 화면을 연 순간 값이다. 화면을 열어 둔 채 시간이 지나도 저절로 다시 읽지 않고, 시각 시트의 "지금"을 누를 때만 시계를 다시 읽는다.
 * 결과 단계로 넘어갈 때마다 추천 기록을 남기고(`showResult`), 받은 id로 "도착했어요" 설문을 보낸다.
 * **추천 기록 저장이 실패하면 설문 입구만 숨기고 추천은 그대로 보인다**(스펙 #2). 설문은 기록할 때의 구간 값(`record`)으로 묻는다.
 */

type Step = "segment" | "result";
type SheetTarget = "from" | "to" | "dayType" | "time";
type DataState = { status: "loading" } | { status: "ok"; data: RefinedData } | { status: "failed" };
export type SurveyStep = "followed" | "otherCar" | "seated" | "stopsUntilSeated" | "thanks";
// isSurveyClosed: 답을 받았거나, 서버가 더는 받지 않는 추천(24시간 지남·이미 응답)이다. "도착했어요"를 숨긴다.
type SavedRecord = { id: string; picks: number[]; carCount: number; stopCount: number; isSurveyClosed: boolean };
type RideAnswer = { isFollowed: boolean; otherCar?: number };

// 진행 막대의 몇 번째 문항인지. 몇 번째 칸인지 묻는 것은 첫 문항에 딸린 질문이다.
const SURVEY_PROGRESS = { followed: 1, otherCar: 1, seated: 2, stopsUntilSeated: 3, thanks: null } as const;

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
  const [record, setRecord] = useState<SavedRecord | null>(null);
  // 늦게 온 이전 결과의 추천 기록 응답이 지금 결과의 기록을 덮지 않게 요청마다 번호를 매긴다.
  const recordRequestSeq = useRef(0);
  const [surveyStep, setSurveyStep] = useState<SurveyStep | null>(null);
  const [rideAnswer, setRideAnswer] = useState<RideAnswer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<"invalid" | "closed" | "failed" | null>(null);

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
  const sortedPicks = record ? [...record.picks].sort((a, b) => a - b) : [];
  const surveyTitle =
    !surveyStep || !record ? null : surveyStep === "followed" ? followedTitle(sortedPicks) : SURVEY_TITLE[surveyStep];
  const surveyProgress = surveyStep ? SURVEY_PROGRESS[surveyStep] : null;
  const otherCars = record ? otherCarsOf(record.carCount, record.picks) : [];
  const stopChoices = record ? stopChoicesOf(record.stopCount) : [];
  const surveyErrorText = submitError ? SUBMIT_ERROR_TEXT[submitError] : null;
  const canAnswerSurvey = Boolean(record && !record.isSurveyClosed);

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

  // 시각 시트의 버튼이라 시각만 바꾸고 요일유형은 그대로 둔다.
  function pickNowTime() {
    pickTime(clockOf(new Date()).departMinute);
  }

  function showResult() {
    if (!success) return;
    setStep("result");
    setRecord(null);
    const seq = ++recordRequestSeq.current;
    createRecommendation({
      routeId: success.route.id,
      from,
      to,
      direction: success.direction,
      departHour: Math.floor(departMinute / 60),
      dayType: success.dayType,
      picks: success.picks,
      grade: success.grade,
      isWeakGap: success.isWeakGap,
      hasMissingStations: success.missingStations.length > 0,
      period: success.periods.ridership,
      formulaVersion: success.formulaVersion,
      carCount: success.route.carCount,
      stopCount: success.stopCount,
    }).then((result) => {
      if (result.status !== "ok" || seq !== recordRequestSeq.current) return;
      setRecord({
        id: result.data.id,
        picks: success.picks,
        carCount: success.route.carCount,
        stopCount: success.stopCount,
        isSurveyClosed: false,
      });
    });
  }

  function backToSegment() {
    recordRequestSeq.current++;
    setRecord(null);
    setStep("segment");
  }

  function openSurvey() {
    setRideAnswer(null);
    setSubmitError(null);
    setSurveyStep("followed");
  }

  function closeSurvey() {
    setSurveyStep(null);
  }

  function answerFollowed(isFollowed: boolean) {
    setRideAnswer({ isFollowed });
    setSubmitError(null);
    setSurveyStep(isFollowed ? "seated" : "otherCar");
  }

  function answerOtherCar(car: number) {
    setRideAnswer({ isFollowed: false, otherCar: car });
    setSurveyStep("seated");
  }

  function answerSeated(isSeated: boolean) {
    if (isSeated) setSurveyStep("stopsUntilSeated");
    else submitSurvey(undefined);
  }

  // 앉지 않았으면 stopsUntilSeated 없이 보낸다. 실패하면 같은 문항에 문구를 띄우고, 더는 받지 않는 추천이면 입구를 닫는다.
  function submitSurvey(stopsUntilSeated: number | undefined) {
    if (!record || !rideAnswer || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    createSurveyResponse({
      recommendationId: record.id,
      ...rideAnswer,
      isSeated: stopsUntilSeated !== undefined,
      ...(stopsUntilSeated === undefined ? {} : { stopsUntilSeated }),
    }).then((result) => {
      setIsSubmitting(false);
      if (result.status === "ok" || result.status === "closed") setRecord({ ...record, isSurveyClosed: true });
      if (result.status === "ok") setSurveyStep("thanks");
      else setSubmitError(result.status);
    });
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
    from,
    to,
    success,
    errorText,
    step,
    showResult,
    backToSegment,
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
    canAnswerSurvey,
    surveyStep,
    surveyTitle,
    surveyProgress,
    surveyErrorText,
    isSubmitting,
    otherCars,
    stopChoices,
    openSurvey,
    closeSurvey,
    answerFollowed,
    answerOtherCar,
    answerSeated,
    submitSurvey,
  };
}
