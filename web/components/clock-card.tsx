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

/** 추천 기준 요일유형·시각 카드. 구간 카드 위에 둔다. 요일유형 칩은 시트를 열고, 시각 칩은 입력이다. */
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
      <label className={styles.chip}>
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
        {props.isNow ? "지금" : null}
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
