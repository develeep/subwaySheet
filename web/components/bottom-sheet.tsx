import { type ReactNode, useId, useLayoutEffect, useRef } from "react";
import styles from "./bottom-sheet.module.css";

export type BottomSheetProps = {
  /** 열려 있으면 시트 제목, 닫혀 있으면 null. */
  title: string | null;
  /** 제목 위에 그릴 것(설문 진행 막대). */
  lead?: ReactNode;
  onClose: () => void;
  children: ReactNode;
};

/** 바텀시트 틀(design/prototype.html dialog·.sheet). `<dialog>`를 열고 닫는 DOM 동기화만 한다. 화면 페이지가 역·요일유형·시각 고르기와 설문에 쓴다. */
export function BottomSheet({ title, lead, onClose, children }: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const isOpen = title !== null;

  // layout effect라 자식의 effect보다 먼저 연다. 자식(시각 휠)이 effect에서 스크롤 위치를 잡으려면 dialog가 보여야 한다.
  useLayoutEffect(() => {
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
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.sheet}>
        <div className={styles.grab} />
        {lead}
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
