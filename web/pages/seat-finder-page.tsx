import { BottomSheet } from "@web/components/bottom-sheet";
import { ClockCard } from "@web/components/clock-card";
import { DayTypeChoices } from "@web/components/day-type-choices";
import { SegmentCard } from "@web/components/segment-card";
import { StationPicker } from "@web/components/station-picker";
import { TimeWheel } from "@web/components/time-wheel";
import { TrainCars } from "@web/components/train-cars";
import { VerdictCard } from "@web/components/verdict-card";
import { DAY_TYPE_LABEL, LOAD_FAILED_TEXT } from "@web/constants/seat-finder-copy";
import { useSeatFinder } from "@web/hooks/use-seat-finder";
import type { CSSProperties } from "react";
import styles from "./seat-finder-page.module.css";

/**
 * SeatFinderPage — 구간 선택 → 칸 추천 화면. `web/main.tsx`가 그린다.
 * 화면 훅 `useSeatFinder`를 한 번 부르고 표시 컴포넌트에 값과 동작을 넘긴다. **판정은 훅·추천 모듈이 하고 여기서는 그리기만 한다.**
 * 추천 결과가 없으면(데이터를 읽는 중, 오류) 칸 추천 단계로 넘어가지 않고 구간 선택 단계를 보인다.
 */
export function SeatFinderPage() {
  const finder = useSeatFinder();
  const { success } = finder;
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

      {finder.dataStatus === "failed" ? <p className={styles.notice}>{LOAD_FAILED_TEXT}</p> : null}

      {finder.step === "segment" || !success ? (
        <main className={styles.panel}>
          <section className={styles.hero}>
            <h1>
              덜 붐비는 칸 말고,
              <br />곧 자리가 나는 칸
            </h1>
            <p>내 구간에서 많이 내리는 역과 그 역의 빠른하차 칸으로 계산해요.</p>
          </section>
          <ClockCard
            dayTypeLabel={DAY_TYPE_LABEL[finder.dayType]}
            clockText={finder.clockText}
            onPickDayType={() => finder.openSheet("dayType")}
            onPickTime={() => finder.openSheet("time")}
          />
          <SegmentCard
            from={finder.from}
            to={finder.to}
            lineNumber={success?.route.lineNumber ?? null}
            towardStation={success?.towardStation ?? null}
            canChangeDirection={Boolean(success?.oppositeDirection)}
            errorText={finder.errorText}
            onPickFrom={() => finder.openSheet("from")}
            onPickTo={() => finder.openSheet("to")}
            onSwap={finder.swapStations}
            onFlipDirection={finder.flipDirection}
          />
          <div className={styles.dock}>
            <button
              className={styles.primary}
              type="button"
              disabled={!success}
              onClick={() => finder.setStep("result")}
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
            clockText={finder.clockText}
            onBack={() => finder.setStep("segment")}
          />
          <TrainCars carCount={success.route.carCount} picks={success.picks} />
          <p className={styles.foot}>
            승하차 기준 기간 {success.periods.ridership.start} ~ {success.periods.ridership.end}
          </p>
        </main>
      )}

      <BottomSheet title={finder.sheetTitle} onClose={finder.closeSheet}>
        {finder.sheetTarget === "dayType" ? (
          <DayTypeChoices selected={finder.dayType} onPick={finder.pickDayType} />
        ) : finder.sheetTarget === "time" ? (
          <TimeWheel departMinute={finder.departMinute} onPickNow={finder.pickNowTime} onPick={finder.pickTime} />
        ) : (
          <StationPicker
            query={finder.query}
            matches={finder.matches}
            onQueryChange={finder.setQuery}
            onPick={finder.pickStation}
          />
        )}
      </BottomSheet>
    </div>
  );
}
