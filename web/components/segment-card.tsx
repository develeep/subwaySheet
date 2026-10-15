import styles from "./segment-card.module.css";

export type SegmentCardProps = {
  from: string;
  to: string;
  lineNumber: number | null;
  /** "○○ 방면"의 ○○. 추천할 수 없으면 null. */
  towardStation: string | null;
  canChangeDirection: boolean;
  errorText: string | null;
  clockLabel: string;
  onPickFrom: () => void;
  onPickTo: () => void;
  onSwap: () => void;
  onFlipDirection: () => void;
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
        <span className={styles.chip}>
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
          {props.clockLabel}
        </span>
        {props.errorText ? (
          <p className={styles.error} role="alert">
            {props.errorText}
          </p>
        ) : null}
      </div>
    </section>
  );
}
