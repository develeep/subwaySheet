import type { RecommendSuccess } from "@web/recommend/recommend";
import styles from "./segment-card.module.css";

export type SegmentCardProps = {
  from: string;
  to: string;
  lineNumber: number | null;
  /** 출발역·도착역을 함께 지나는 노선. 둘 이상일 때만 노선 칩으로 보인다. */
  routeChoices: RecommendSuccess["routeChoices"];
  selectedRouteId: string | null;
  /** "○○ 방면"의 ○○. 추천할 수 없으면 null. */
  towardStation: string | null;
  canChangeDirection: boolean;
  errorText: string | null;
  onPickFrom: () => void;
  onPickTo: () => void;
  onSwap: () => void;
  onFlipDirection: () => void;
  onPickRoute: (routeId: string) => void;
};

/** 구간 판: 노선도처럼 노선 색 선에 출발·도착 역이 매달리고, 아래 줄에 노선 칩(공통 노선이 둘 이상일 때)과 방면 안내판을 둔다.
 * 노선 칩은 시안에 없어 시안의 .chip·.ln-dot 모양을 그대로 쓰고, 고른 칩은 요일유형 선택지처럼 탭 선택 면으로 칠한다. */
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
      </div>
      {props.routeChoices.length > 1 ? (
        <fieldset className={styles.routeChips} aria-label="노선">
          {props.routeChoices.map((route) => (
            <button
              key={route.id}
              className={styles.routeChip}
              type="button"
              aria-pressed={route.id === props.selectedRouteId}
              onClick={() => props.onPickRoute(route.id)}
            >
              <i className={styles.lineDot} style={{ background: `var(--color-line-${route.lineNumber})` }}>
                {route.lineNumber}
              </i>
              {route.name}
            </button>
          ))}
        </fieldset>
      ) : null}
      {props.towardStation !== null || props.canChangeDirection || props.errorText ? (
        <div className={styles.meta}>
          {props.towardStation !== null && props.lineNumber !== null ? (
            <span className={styles.lineBadge}>
              <i className={styles.lineDot}>{props.lineNumber}</i>
              {props.lineNumber}호선 · {props.towardStation} 방면
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          ) : null}
          {props.canChangeDirection ? (
            <button className={styles.flip} type="button" onClick={props.onFlipDirection}>
              반대 방향으로
            </button>
          ) : null}
          {props.errorText ? (
            <p className={styles.error} role="alert">
              {props.errorText}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
