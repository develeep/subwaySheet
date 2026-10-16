import {
  CLOSE_TEXT,
  FOLLOWED_CHOICES,
  otherCarLabel,
  SEATED_CHOICES,
  type STOPS_UNTIL_SEATED_CHOICES,
  THANKS_TEXT,
} from "@web/constants/survey-copy";
import type { SurveyStep } from "@web/hooks/use-seat-finder";
import styles from "./survey-choices.module.css";

export type SurveyChoicesProps = {
  step: SurveyStep;
  otherCars: number[];
  stopChoices: (typeof STOPS_UNTIL_SEATED_CHOICES)[number][];
  errorText: string | null;
  isSubmitting: boolean;
  onAnswerFollowed: (isFollowed: boolean) => void;
  onAnswerOtherCar: (car: number) => void;
  onAnswerSeated: (isSeated: boolean) => void;
  onAnswerStops: (stops: number) => void;
  onClose: () => void;
};

/** "도착했어요" 설문 시트의 선택지(design/prototype.html `openSurvey` .choices·.choice). 시트 틀과 문항 제목은 BottomSheet가 그린다. */
export function SurveyChoices(props: SurveyChoicesProps) {
  return (
    <>
      {renderStep(props)}
      {props.errorText ? (
        <p className={styles.error} role="alert">
          {props.errorText}
        </p>
      ) : null}
    </>
  );
}

function renderStep(props: SurveyChoicesProps) {
  const choice = (key: string | number, label: string, onClick: () => void) => (
    <button key={key} className={styles.choice} type="button" disabled={props.isSubmitting} onClick={onClick}>
      {label}
    </button>
  );
  switch (props.step) {
    case "followed":
      return (
        <div className={styles.choices}>
          {FOLLOWED_CHOICES.map((c) => choice(c.label, c.label, () => props.onAnswerFollowed(c.isFollowed)))}
        </div>
      );
    case "otherCar":
      return (
        <div className={`${styles.choices} ${styles.cars}`}>
          {props.otherCars.map((car) => choice(car, otherCarLabel(car), () => props.onAnswerOtherCar(car)))}
        </div>
      );
    case "seated":
      return (
        <div className={styles.choices}>
          {SEATED_CHOICES.map((c) => choice(c.label, c.label, () => props.onAnswerSeated(c.isSeated)))}
        </div>
      );
    case "stopsUntilSeated":
      return (
        <div className={`${styles.choices} ${styles.cols}`}>
          {props.stopChoices.map((c) => choice(c.stops, c.label, () => props.onAnswerStops(c.stops)))}
        </div>
      );
    case "thanks":
      return (
        <>
          <p className={styles.thanks}>{THANKS_TEXT}</p>
          <button className={styles.primary} type="button" onClick={props.onClose}>
            {CLOSE_TEXT}
          </button>
        </>
      );
  }
}

export type SurveyProgressProps = { current: number };

/** 3문항 진행 막대(design/prototype.html .progress). */
export function SurveyProgress({ current }: SurveyProgressProps) {
  return (
    <div
      className={styles.progress}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={3}
      aria-valuenow={current}
      aria-label={`3문항 중 ${current}번째`}
    >
      {[1, 2, 3].map((n) => (
        <span key={n} className={n <= current ? styles.on : undefined} />
      ))}
    </div>
  );
}
