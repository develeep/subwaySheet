import styles from "./clock-card.module.css";

export type ClockCardProps = {
  dayTypeLabel: string;
  /** 시각 입력 값 "HH:MM". 지우는 중이면 빈 문자열이다. */
  timeValue: string;
  /** 시각·요일유형을 둘 다 화면을 연 순간 그대로 두었으면 "지금"을 붙인다. */
  isNow: boolean;
  onPickDayType: () => void;
  onTimeChange: (text: string) => void;
};

/** 추천 기준 요일유형·시각 판. 구간 판 위에 둔다. 왼쪽 칸은 요일유형 시트를 열고, 오른쪽 칸은 시각 입력이다. */
export function ClockCard(props: ClockCardProps) {
  return (
    <section className={styles.clock} aria-label="요일유형과 출발 시각">
      <button
        className={styles.field}
        type="button"
        aria-label={`요일유형 ${props.dayTypeLabel}, 바꾸기`}
        onClick={props.onPickDayType}
      >
        <small>요일</small>
        <span className={styles.value}>
          {props.dayTypeLabel}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      <label className={styles.field}>
        <small>
          출발 시각
          {props.isNow ? <b className={styles.now}>지금</b> : null}
        </small>
        <input
          className={styles.timeInput}
          type="time"
          aria-label="출발 시각"
          value={props.timeValue}
          onChange={(event) => props.onTimeChange(event.target.value)}
        />
      </label>
    </section>
  );
}
