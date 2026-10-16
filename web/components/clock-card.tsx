import styles from "./clock-card.module.css";

export type ClockCardProps = {
  dayTypeLabel: string;
  /** 출발 시각 "HH:MM". */
  clockText: string;
  onPickDayType: () => void;
  onPickTime: () => void;
};

/** 추천 기준 요일유형·시각 판. 구간 판 위에 둔다. 왼쪽 칸은 요일유형 시트, 오른쪽 칸은 시각 시트를 연다. */
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
      <button
        className={styles.field}
        type="button"
        aria-label={`출발 시각 ${props.clockText}, 바꾸기`}
        onClick={props.onPickTime}
      >
        <small>출발 시각</small>
        <span className={styles.value}>{props.clockText}</span>
      </button>
    </section>
  );
}
