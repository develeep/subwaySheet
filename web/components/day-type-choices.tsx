import { DAY_TYPES, type DayType } from "@shared/refined-data";
import { DAY_TYPE_LABEL } from "@web/constants/seat-finder-copy";
import styles from "./day-type-choices.module.css";

export type DayTypeChoicesProps = {
  selected: DayType;
  onPick: (dayType: DayType) => void;
};

/** 요일유형 고르기 시트의 선택지. 시트 틀은 BottomSheet, 모양은 설문 시트의 .choice(design/prototype.html)를 따른다. */
export function DayTypeChoices(props: DayTypeChoicesProps) {
  return (
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
  );
}
