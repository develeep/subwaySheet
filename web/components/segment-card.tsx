import styles from "./segment-card.module.css";

export type SegmentCardProps = {
  from: string;
  to: string;
  lineNumber: number | null;
  /** "○○ 방면"의 ○○. 추천할 수 없으면 null. */
  towardStation: string | null;
  canChangeDirection: boolean;
  errorText: string | null;
  dayTypeLabel: string;
  /** 시각 입력 값 "HH:MM". 지우는 중이면 빈 문자열이다. */
  timeValue: string;
  /** 시각·요일유형을 둘 다 화면을 연 순간 그대로 두었으면 "지금"을 붙인다. */
  isNow: boolean;
  onPickFrom: () => void;
  onPickTo: () => void;
  onSwap: () => void;
  onFlipDirection: () => void;
  onPickDayType: () => void;
  onTimeChange: (text: string) => void;
};

export function SegmentCard(props: SegmentCardProps) {
  return (
    <section className={styles.segment} aria-label="구간">
      <div className={styles.stops}>
        <button className={styles.stopButton} type="button" onClick={props.onPickFrom}>
          <small>출발</small>
          <span>{props.from}역</span>
        </button>
        <button className={styles.stopButton} type="button" onClick={props.onPickTo}>
          <small>도착</small>
          <span>{props.to}역</span>
        </button>
      </div>
      <button className={styles.swap} type="button" aria-label="출발역과 도착역 바꾸기" onClick={props.onSwap}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" />
        </svg>
      </button>
      <div className={styles.meta}>
        {props.towardStation !== null && props.lineNumber !== null ? (
          <span className={styles.lineBadge}>
            <i className={styles.lineDot}>{props.lineNumber}</i>
            {props.lineNumber}호선 · {props.towardStation} 방면
          </span>
        ) : null}
        {props.canChangeDirection ? (
          <button className={styles.chip} type="button" onClick={props.onFlipDirection}>
            반대 방향으로
          </button>
        ) : null}
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
        {props.errorText ? (
          <p className={styles.error} role="alert">
            {props.errorText}
          </p>
        ) : null}
      </div>
    </section>
  );
}
