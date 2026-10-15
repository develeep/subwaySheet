import { DAY_TYPES, type DayType } from "@shared/refined-data";
import { BottomSheet } from "@web/components/bottom-sheet";
import { DAY_TYPE_LABEL } from "@web/constants/seat-finder-copy";
import styles from "./day-type-sheet.module.css";

export type DayTypeSheetProps = {
  /** 열려 있으면 시트 제목, 닫혀 있으면 null. */
  title: string | null;
  selected: DayType;
  onPick: (dayType: DayType) => void;
  onClose: () => void;
};

/** 요일유형 고르기 바텀시트. 선택지는 설문 시트의 .choice 모양(design/prototype.html)을 따른다. */
export function DayTypeSheet(props: DayTypeSheetProps) {
  return (
    <BottomSheet title={props.title} onClose={props.onClose}>
      <div className={styles.choices}>
        {DAY_TYPES.map((dayType) => (
          <button
            key={dayType}
            className={styles.choice}
            type="button"
            aria-pressed={dayType === props.selected}
            onClick={() => props.onPick(dayType)}
          >
            {DAY_TYPE_LABEL[dayType]}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
