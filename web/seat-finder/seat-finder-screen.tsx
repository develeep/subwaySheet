import type { CSSProperties } from "react";
import { DAY_TYPE_LABEL, ERROR_TEXT, LOAD_FAILED_TEXT } from "./seat-finder-copy";
import styles from "./seat-finder-screen.module.css";
import { SegmentCard } from "./segment-card";
import { StationSheet } from "./station-sheet";
import { TrainCars } from "./train-cars";
import { useSeatFinder } from "./use-seat-finder";
import { VerdictCard } from "./verdict-card";

const formatClock = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

export function SeatFinderScreen() {
  const finder = useSeatFinder();
  const success = finder.result?.status === "ok" ? finder.result : null;
  const errorText = finder.result?.status === "error" ? ERROR_TEXT[finder.result.error] : null;
  const clockText = formatClock(finder.clock.departMinute);
  // 선택 노선 색: 하위 요소가 쓰는 --color-line-current를 노선 색으로 바꾼다(design/tokens.css :root.lineN과 같은 값).
  const lineStyle = success
    ? ({ "--color-line-current": `var(--color-line-${success.route.lineNumber})` } as CSSProperties)
    : undefined;

  return (
    <div className={styles.app} style={lineStyle}>
      <header className={styles.brand}>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <rect x="4" y="3" width="16" height="14" rx="3" />
          <path d="M4 11h16M8 21l2-4M16 21l-2-4" />
        </svg>
        subwaySheet
      </header>

      <div className={styles.tabs} role="tablist" aria-label="단계">
        <button
          role="tab"
          type="button"
          aria-selected={finder.tab === "segment"}
          onClick={() => finder.setTab("segment")}
        >
          구간 선택
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={finder.tab === "result"}
          disabled={!success}
          onClick={() => finder.setTab("result")}
        >
          칸 추천
        </button>
      </div>

      {finder.dataStatus === "failed" ? <p className={styles.notice}>{LOAD_FAILED_TEXT}</p> : null}

      {finder.tab === "segment" || !success ? (
        <main className={styles.panel}>
          <section className={styles.hero}>
            <h1>
              덜 붐비는 칸 말고,
              <br />곧 자리가 나는 칸
            </h1>
            <p>내 구간에서 많이 내리는 역과 그 역의 빠른하차 칸으로 계산해요.</p>
          </section>
          <SegmentCard
            from={finder.from}
            to={finder.to}
            lineNumber={success?.route.lineNumber ?? null}
            towardStation={success?.towardStation ?? null}
            canChangeDirection={success?.canChangeDirection ?? false}
            errorText={errorText}
            clockLabel={`${DAY_TYPE_LABEL[finder.clock.dayType]} · 지금 ${clockText}`}
            onPickFrom={() => finder.openPicker("from")}
            onPickTo={() => finder.openPicker("to")}
            onSwap={finder.swapStations}
            onFlipDirection={finder.flipDirection}
          />
          <div className={styles.dock}>
            <button
              className={styles.primary}
              type="button"
              disabled={!success}
              onClick={() => finder.setTab("result")}
            >
              앉을 칸 찾기
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
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </main>
      ) : (
        <main className={styles.panel}>
          <VerdictCard
            from={finder.from}
            to={finder.to}
            result={success}
            clockText={clockText}
            onBack={() => finder.setTab("segment")}
          />
          <TrainCars carCount={success.route.carCount} picks={success.picks} />
          <p className={styles.foot}>
            승하차 기준 기간 {success.periods.ridership.start} ~ {success.periods.ridership.end}
          </p>
        </main>
      )}

      <StationSheet
        title={finder.pickerTarget === "from" ? "출발역" : finder.pickerTarget === "to" ? "도착역" : null}
        query={finder.query}
        matches={finder.matches}
        onQueryChange={finder.setQuery}
        onPick={finder.pickStation}
        onClose={finder.closePicker}
      />
    </div>
  );
}
