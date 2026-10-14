import type { StationOption } from "@web/recommend/recommend";
import { useEffect, useRef } from "react";
import { stationNotFoundText } from "./seat-finder-copy";
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

/** 역 고르기 바텀시트. `<dialog>`를 열고 닫는 DOM 동기화만 하고, 목록 거르기는 화면 훅이 한다. */
export function StationSheet(props: StationSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isOpen = props.title !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: 배경을 눌러 닫는 보조 동작이다. 키보드는 dialog 기본 Esc로 닫힌다.
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="station-sheet-title"
      onClose={props.onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <div className={styles.sheet}>
        <div className={styles.grab} />
        <h2 id="station-sheet-title">{props.title}</h2>
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
          {props.matches.length > 0 ? (
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
      </div>
    </dialog>
  );
}
