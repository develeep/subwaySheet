import { type CSSProperties, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import styles from "./time-wheel.module.css";

export type TimeWheelProps = {
  /** 처음 맞춰 둘 출발 시각. 0시부터 센 분이다. */
  departMinute: number;
  onPick: (minute: number) => void;
};

// 칸 높이는 스크롤 위치 → 고른 값 계산에도 쓰므로 CSS(--wheel-item)로 내려보내 한곳에서 정한다.
const ITEM_HEIGHT = 44;

/**
 * TimeWheel — 시각 고르기 시트의 시·분 휠과 확인 버튼. 시트 틀은 BottomSheet다.
 * 휠은 CSS scroll-snap 목록이고, 가운데 칸이 고른 값이다. 확인을 눌러야 시각이 바뀐다.
 * **처음 위치를 잡는 스크롤은 dialog가 열린 뒤여야 한다** — BottomSheet가 layout effect로 먼저 연다.
 */
export function TimeWheel(props: TimeWheelProps) {
  const [hour, setHour] = useState(Math.floor(props.departMinute / 60));
  const [minute, setMinute] = useState(props.departMinute % 60);

  return (
    <div className={styles.picker} style={{ "--wheel-item": `${ITEM_HEIGHT}px` } as CSSProperties}>
      <div className={styles.wheels}>
        <WheelColumn label="시" count={24} selected={hour} onSelect={setHour} />
        <span className={styles.colon} aria-hidden="true">
          :
        </span>
        <WheelColumn label="분" count={60} selected={minute} onSelect={setMinute} />
      </div>
      <button className={styles.confirm} type="button" onClick={() => props.onPick(hour * 60 + minute)}>
        확인
      </button>
    </div>
  );
}

type WheelColumnProps = {
  label: string;
  /** 칸 수. 칸 i의 값은 i다(0시~23시, 0분~59분). */
  count: number;
  selected: number;
  onSelect: (value: number) => void;
};

/** 휠 한 줄. 고른 값(selected)이 기준이고, 스크롤·탭·화살표 키는 onSelect로 값을 바꾼 뒤 스크롤을 거기에 맞춘다. */
function WheelColumn({ label, count, selected, onSelect }: WheelColumnProps) {
  const clamp = (index: number) => Math.min(count - 1, Math.max(0, index));
  const listRef = useRef<HTMLDivElement>(null);
  const idPrefix = useId();

  // 스크롤로 바뀐 값이면 이미 그 위치에 있어 건드리지 않는다. 처음 열 때·탭·키로 바뀐 값만 스크롤을 옮긴다.
  useEffect(() => {
    const list = listRef.current;
    if (list && Math.round(list.scrollTop / ITEM_HEIGHT) !== selected) list.scrollTop = selected * ITEM_HEIGHT;
  }, [selected]);

  function handleScroll() {
    const list = listRef.current;
    if (!list) return;
    const index = clamp(Math.round(list.scrollTop / ITEM_HEIGHT));
    if (index !== selected) onSelect(index);
  }

  function handleKeyDown(event: KeyboardEvent) {
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    onSelect(clamp(selected + step));
  }

  return (
    <div
      ref={listRef}
      className={styles.column}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-activedescendant={`${idPrefix}-${selected}`}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
    >
      {Array.from({ length: count }, (_, index) => (
        // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/useFocusableInteractive: 포커스는 listbox가 갖고 aria-activedescendant로 고른 칸을 알린다(화살표 키). 탭은 보조 동작이다.
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: 칸 번호가 곧 값이라 순서가 바뀌지 않는다.
          key={index}
          id={`${idPrefix}-${index}`}
          className={styles.item}
          role="option"
          aria-selected={index === selected}
          onClick={() => onSelect(index)}
        >
          {String(index).padStart(2, "0")}
        </div>
      ))}
    </div>
  );
}
