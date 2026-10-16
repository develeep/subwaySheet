import styles from "./hero-illustration.module.css";

export type HeroIllustrationProps = {
  /** 고른 노선 번호. 추천 결과가 없으면 null이고 방면 표지 글자를 비운다. */
  lineNumber: number | null;
  /** "○○ 방면"의 ○○. 열차 행선 표시기에도 앞 네 글자를 쓴다. */
  towardStation: string | null;
};

/**
 * 첫 화면 그림(design/prototype.html .hero svg): 승강장으로 들어오는 열차와 탑승 위치에서 기다리는 사람.
 * 좌표는 시안 그림 좌표 그대로다. 색은 --color-ill-* 토큰과 선택 노선 색(--color-line-current)만 쓴다.
 */
export function HeroIllustration({ lineNumber, towardStation }: HeroIllustrationProps) {
  const hasSign = lineNumber !== null && towardStation !== null;

  return (
    <svg
      className={styles.illustration}
      viewBox="0 0 360 200"
      role="img"
      aria-label="승강장으로 들어오는 열차와 탑승 위치에서 기다리는 사람"
    >
      <rect width="360" height="140" fill="var(--color-ill-wall1)" />
      <rect y="92" width="360" height="48" fill="var(--color-ill-wall2)" />
      <rect x="18" y="20" width="118" height="32" rx="3" fill="var(--color-ill-sign)" />
      <circle cx="36" cy="36" r="9" fill="var(--color-line-current)" />
      {hasSign ? (
        <>
          <text x="36" y="40" textAnchor="middle" fontSize="11" fill="var(--color-on-line)" className={styles.text}>
            {lineNumber}
          </text>
          <text x="52" y="40.5" fontSize="11.5" fill="var(--color-on-line)" className={styles.text}>
            {towardStation} 방면
          </text>
        </>
      ) : null}
      <path d="M190 140V88a55 55 0 0 1 110 0v52z" fill="var(--color-ill-tunnel-edge)" />
      <path d="M200 140V90a45 45 0 0 1 90 0v50z" fill="var(--color-ill-tunnel-core)" />
      <rect y="140" width="360" height="60" fill="var(--color-ill-floor1)" />
      <path d="M190 140h110l60 60H130z" fill="var(--color-ill-track)" />
      <path
        d="M210 152h70M200 168h92M188 186h116"
        stroke="var(--color-ill-tunnel-core)"
        strokeOpacity=".25"
        strokeWidth="3"
      />
      <path d="M216 140l-38 60M274 140l38 60" stroke="var(--color-ill-rail)" strokeWidth="3" />
      <path d="M0 140h190l-60 60H0z" fill="var(--color-ill-floor1)" />
      <path d="M176 140h10l-60 60h-14z" fill="var(--color-ill-tactile)" />
      <g className={styles.train}>
        <path className={styles.beam} d="M222 128 172 200h56z" fill="var(--color-ill-headlight)" fillOpacity=".22" />
        <path className={styles.beam} d="M268 128 262 200h56z" fill="var(--color-ill-headlight)" fillOpacity=".22" />
        <rect x="200" y="52" width="90" height="88" rx="20" fill="var(--color-ill-body1)" />
        <rect x="200" y="52" width="12" height="88" rx="6" fill="var(--color-ill-body2)" />
        <rect x="278" y="52" width="12" height="88" rx="6" fill="var(--color-ill-body2)" />
        <rect x="208" y="65" width="74" height="37" rx="9" fill="var(--color-ill-glass1)" />
        <rect x="221" y="69" width="48" height="12" rx="2" fill="var(--color-ill-led-bg)" />
        {towardStation !== null ? (
          <text x="245" y="78" textAnchor="middle" fontSize="8" fill="var(--color-ill-led)" className={styles.text}>
            {towardStation.slice(0, 4)}
          </text>
        ) : null}
        <rect x="200" y="108" width="90" height="7" fill="var(--color-line-current)" />
        <circle className={styles.glow} cx="216" cy="124" r="11" fill="var(--color-ill-headlight)" fillOpacity=".35" />
        <circle className={styles.glow} cx="274" cy="124" r="11" fill="var(--color-ill-headlight)" fillOpacity=".35" />
        <circle cx="216" cy="124" r="4.5" fill="var(--color-ill-bulb)" />
        <circle cx="274" cy="124" r="4.5" fill="var(--color-ill-bulb)" />
        <rect x="211" y="132" width="68" height="6" rx="3" fill="var(--color-ill-wheel)" />
      </g>
      <ellipse
        className={styles.marker}
        cx="72"
        cy="186"
        rx="24"
        ry="6"
        fill="var(--color-line-current)"
        fillOpacity=".45"
      />
      <ellipse cx="72" cy="186" rx="17" ry="4" fill="var(--color-line-current)" fillOpacity=".7" />
      <rect x="64" y="158" width="6" height="27" rx="3" fill="var(--color-ill-pants)" />
      <rect x="74" y="158" width="6" height="27" rx="3" fill="var(--color-ill-pants)" />
      <rect x="59" y="126" width="26" height="38" rx="10" fill="var(--color-ill-shirt)" />
      <path d="M62 130l18 26" stroke="var(--color-ill-pants)" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="80" y="132" width="6" height="18" rx="3" fill="var(--color-ill-shirt)" transform="rotate(-35 83 141)" />
      <rect x="85" y="124" width="8" height="12" rx="1.8" fill="var(--color-ill-wheel)" />
      <rect x="86.5" y="125.5" width="5" height="8" rx="1" fill="var(--color-line-current)" fillOpacity=".8" />
      <circle cx="72" cy="115" r="10" fill="var(--color-ill-skin)" />
      <path d="M62 114a10 10 0 0 1 20 0q-5-4-10-3.5T62 114z" fill="var(--color-ill-hair)" />
      <g className={styles.bubble}>
        <rect x="92" y="80" width="88" height="28" rx="4" fill="var(--color-surface)" />
        <path d="M100 104l-8 10 14-6z" fill="var(--color-surface)" />
        <path
          d="M104 87h3v8h7a2 2 0 0 1 2 2v1.5h-2V102h-1.8v-3.5H107V102h-1.8v-3.5H103V89a2 2 0 0 1 1-2z"
          fill="var(--color-line-current)"
        />
        <text x="121" y="98" fontSize="11" fill="var(--color-text)" className={styles.text}>
          곧 자리 날 칸
        </text>
      </g>
    </svg>
  );
}
