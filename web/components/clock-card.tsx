import styles from "./clock-card.module.css";

export type ClockCardProps = {
  dayTypeLabel: string;
  /** 출발 시각 "HH:MM". */
  clockText: string;
  onPickDayType: () => void;
  onPickTime: () => void;
};

/** 추천 기준 요일유형·시각 카드. 구간 카드 위에 둔다. 두 칩 모두 고르기 시트를 연다. */
export function ClockCard(props: ClockCardProps) {
  return (
    <section className={styles.clock} aria-label="요일유형과 출발 시각">
      <button
        className={styles.chip}
        type="button"
        aria-label={`요일유형 ${props.dayTypeLabel}, 바꾸기`}
        onClick={props.onPickDayType}
      >
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
      </button>
      <button
        className={styles.chip}
        type="button"
        aria-label={`출발 시각 ${props.clockText}, 바꾸기`}
        onClick={props.onPickTime}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        <span>{props.clockText}</span>
      </button>
    </section>
  );
}
