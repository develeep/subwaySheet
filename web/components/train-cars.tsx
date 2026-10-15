import { useEffect, useRef } from "react";
import styles from "./train-cars.module.css";

export type TrainCarsProps = {
  carCount: number;
  /** 추천 칸 번호(1부터). */
  picks: number[];
};

/**
 * 열차 칸 그림. 왼쪽부터 1번 칸이다. 1번이 진행 방향 맨 앞인지는 데이터로 확인하지 못해(프로토타입 FINDINGS) 문구에 쓰지 않는다(#8). 위 미니맵에 추천 칸 위치를 표시하고,
 * 그림은 1등 추천 칸이 가운데 오도록 가로 스크롤한다(두 칸이 멀면 가운데로 맞출 때 둘 다 화면 밖으로 나간다).
 */
export function TrainCars({ carCount, picks }: TrainCarsProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const topPick = picks[0];
  const cars = Array.from({ length: carCount }, (_, i) => i + 1);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const car = scroller?.querySelector<HTMLElement>(`[data-car="${topPick}"]`);
    if (!scroller || !car) return;
    scroller.scrollTo({ left: car.offsetLeft + car.offsetWidth / 2 - scroller.clientWidth / 2 });
  }, [topPick]);

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h2>열차 칸</h2>
        <span>{carCount}칸 · 왼쪽부터 1번 칸</span>
      </div>
      <div className={styles.mini} aria-hidden="true">
        {cars.map((car) => (
          <span key={car} className={picks.includes(car) ? styles.miniPick : undefined} />
        ))}
      </div>
      <div className={styles.scroller} ref={scrollerRef}>
        <ol className={styles.train}>
          {cars.map((car) => {
            const isPick = picks.includes(car);
            return (
              <li
                key={car}
                className={isPick ? `${styles.car} ${styles.pick}` : styles.car}
                data-car={car}
                aria-label={isPick ? `${car}번째 칸, 추천` : `${car}번째 칸`}
              >
                {isPick ? <span className={styles.pin}>여기 타세요</span> : null}
                <span className={styles.body} aria-hidden="true">
                  <span className={styles.door} />
                  <span className={styles.window} />
                  <span className={styles.door} />
                  <span className={styles.window} />
                  <span className={styles.door} />
                  <span className={styles.window} />
                  <span className={styles.door} />
                  <span className={styles.stripe} />
                </span>
                <span className={styles.label}>{car}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
