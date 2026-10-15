import {
  CAN_SIT_TEXT,
  DAY_TYPE_LABEL,
  GRADE_LABEL,
  GRADE_PIPS,
  missingStationsText,
  WEAK_GAP_TEXT,
} from "@web/constants/seat-finder-copy";
import type { RecommendSuccess } from "@web/recommend/recommend";
import styles from "./verdict-card.module.css";

export type VerdictCardProps = {
  from: string;
  to: string;
  result: RecommendSuccess;
  clockText: string;
  onBack: () => void;
};

export function VerdictCard({ from, to, result, clockText, onBack }: VerdictCardProps) {
  return (
    <section className={styles.verdict} aria-live="polite">
      <div className={styles.summary}>
        <button className={styles.back} type="button" aria-label="구간 다시 고르기" onClick={onBack}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </button>
        <div>
          <strong>
            {from} → {to}
          </strong>
          <span className={styles.sub}>
            {result.route.name} {result.towardStation} 방면 · {DAY_TYPE_LABEL[result.dayType]} {clockText} ·{" "}
            {result.stopCount}정거장
          </span>
        </div>
      </div>
      <div>
        <h1 className={styles.cars}>{[...result.picks].sort((a, b) => a - b).join("·")}번째 칸</h1>
        <div className={styles.grade}>
          <div className={styles.pips} aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <span key={n} className={n <= GRADE_PIPS[result.grade] ? styles.pipOn : undefined} />
            ))}
          </div>
          <span>앉을 가능성 {GRADE_LABEL[result.grade]}</span>
        </div>
      </div>
      <p className={styles.reason}>
        <em>
          {result.reason.stopsAfter}정거장 뒤 {result.reason.station}역
        </em>
        에서 이 칸 근처로 많이 내려요.
      </p>
      {result.canSitAtOrigin ? <p className={styles.note}>{CAN_SIT_TEXT}</p> : null}
      {result.isWeakGap ? <p className={styles.note}>{WEAK_GAP_TEXT}</p> : null}
      {result.missingStations.length > 0 ? (
        <p className={styles.note}>{missingStationsText(result.missingStations)}</p>
      ) : null}
    </section>
  );
}
