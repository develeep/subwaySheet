/**
 * "도착했어요" 설문 문구와 선택지(design/prototype.html `openSurvey`). 착석은 "내리기 전 한 번이라도 앉음"이다(CONTEXT.md "착석").
 * 몇 번 칸인지 묻는 화면은 시안에 없어 같은 선택지 모양으로 더했다.
 */

export const ARRIVED_TEXT = "도착했어요";

export const followedTitle = (picks: number[]) => `추천한 ${picks.join("·")}번째 칸에 탔나요?`;

export const SURVEY_TITLE = {
  otherCar: "몇 번째 칸에 탔나요?",
  seated: "가는 동안 한 번이라도 앉았나요?",
  stopsUntilSeated: "몇 정거장 뒤에 앉았나요?",
  thanks: "고마워요",
} as const;

export const FOLLOWED_CHOICES = [
  { label: "탔어요", isFollowed: true },
  { label: "다른 칸에 탔어요", isFollowed: false },
] as const;

export const SEATED_CHOICES = [
  { label: "앉았어요", isSeated: true },
  { label: "끝까지 서서 갔어요", isSeated: false },
] as const;

/** 시안의 구간 버튼. 설문 응답에는 구간의 시작값을 정거장 수로 저장한다. 시작값이 구간 정거장 수 이상인 버튼은 숨긴다. */
export const STOPS_UNTIL_SEATED_CHOICES = [
  { label: "타자마자", stops: 0 },
  { label: "1~2정거장", stops: 1 },
  { label: "3~5정거장", stops: 3 },
  { label: "6정거장 이상", stops: 6 },
] as const;

export const otherCarLabel = (car: number) => `${car}번째 칸`;

export const THANKS_TEXT = "답변은 익명으로 저장돼요. 모인 결과로 추천을 더 정확하게 고칩니다.";
export const CLOSE_TEXT = "닫기";

/** 설문 제출 실패. 400(보낸 답이 맞지 않음)·더는 받지 않는 추천·그 밖의 실패를 다르게 알린다(coding-convention "화면의 fetch"). */
export const SUBMIT_ERROR_TEXT = {
  invalid: "답을 받지 못했어요. 다른 답을 골라 주세요.",
  closed: "이 추천은 이미 답했거나 24시간이 지나 더 받지 않아요.",
  failed: "지금은 답을 보내지 못했어요. 잠시 뒤 다시 눌러 주세요.",
} as const;
