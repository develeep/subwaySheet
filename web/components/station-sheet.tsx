import { BottomSheet } from "@web/components/bottom-sheet";
import { stationNotFoundText } from "@web/constants/seat-finder-copy";
import type { StationOption } from "@web/recommend/recommend";
import styles from "./station-sheet.module.css";

export type StationSheetProps = {
  /** 열려 있으면 "출발역"·"도착역" 제목, 닫혀 있으면 null. */
  title: string | null;
  query: string;
  matches: StationOption[];
  onQueryChange: (query: string) => void;
  onPick: (name: string) => void;
  onClose: () => void;
};

/** 역 고르기 바텀시트. 목록 거르기는 화면 훅이 한다. */
export function StationSheet(props: StationSheetProps) {
  return (
    <BottomSheet title={props.title} onClose={props.onClose}>
      <input
        className={styles.search}
        type="search"
        placeholder="역 이름 검색"
        autoComplete="off"
        aria-label="역 이름 검색"
        value={props.query}
        onChange={(event) => props.onQueryChange(event.target.value)}
      />
      <ul className={styles.list} aria-label="역 목록">
        {props.matches.length > 0 || props.query.trim() === "" ? (
          props.matches.map((option) => (
            <li key={option.name}>
              <button type="button" onClick={() => props.onPick(option.name)}>
                {option.lineNumbers.map((line) => (
                  <span key={line} className={styles.lineDot} style={{ background: `var(--color-line-${line})` }}>
                    {line}
                  </span>
                ))}
                {option.name}역
              </button>
            </li>
          ))
        ) : (
          <li className={styles.empty}>{stationNotFoundText(props.query)}</li>
        )}
      </ul>
    </BottomSheet>
  );
}
