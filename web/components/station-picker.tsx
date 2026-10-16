import { stationNotFoundText } from "@web/constants/seat-finder-copy";
import type { StationOption } from "@web/recommend/recommend";
import styles from "./station-picker.module.css";

export type StationPickerProps = {
  query: string;
  matches: StationOption[];
  onQueryChange: (query: string) => void;
  onPick: (name: string) => void;
};

/** 역 고르기 시트의 검색·목록. 시트 틀은 BottomSheet, 목록 거르기는 화면 훅이 한다. */
export function StationPicker(props: StationPickerProps) {
  return (
    <>
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
    </>
  );
}
