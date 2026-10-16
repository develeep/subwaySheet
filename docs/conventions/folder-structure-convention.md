# Folder Structure Convention

## 적용 범위

- subwaySheet 레포의 폴더·파일 배치 기준입니다. 레포는 패키지 하나에 폴더만 나눕니다.
- 구성은 정적 SPA(Vite + React), Cloudflare Pages Function 하나, 월별 배치(TypeScript)입니다.

## 목표

- 파일 위치를 이름만 보고 예측할 수 있게 합니다.
- 화면·배치·설문 함수가 공유하는 것은 데이터 형식뿐이라는 경계를 지킵니다.
- 칸 점수 계산은 추천 모듈 한 곳에만 있게 합니다.

## 루트 구조

```text
web/            화면 (Vite + React 정적 SPA). recommend/ 밖은 종류별 폴더로 나눈다
  recommend/    추천 모듈 — 순수 TS, 앱의 핵심
  pages/        화면(페이지) 컴포넌트
  hooks/        화면 훅 — 상태·effect·동작, fetcher·추천 모듈 호출
  components/   UI 컴포넌트
  api/          fetcher — 정적 정제 데이터·설문 함수 호출
  constants/    화면 문구·표시용 고정 값
  utils/        React 없는 순수 함수
  styles/       문서 전체 스타일(global.css)
  main.tsx      진입점
shared/         web·batch·functions가 함께 쓰는 데이터 형식·용어 타입·요청 스키마
batch/          월별 배치 (pnpm batch → tsx batch/main.ts)
functions/      Cloudflare Pages Function (설문 함수 하나)
public/data/    배치가 만든 정제 데이터 — 커밋한다, 손으로 고치지 않는다
design/         디자인 원본 — prototype.html, tokens.json(원본) → tokens.css(생성물)
docs/           adr/ · conventions/ · research/ · agents/
prototypes/     데이터 프로토타입 — 앱 코드에서 import하지 않는다
raw/            배치 원본 다운로드 — gitignore, 커밋하지 않는다
scripts/        레포 검사 스크립트(pnpm check가 부른다) — 앱 코드에서 import하지 않는다
```

Playwright E2E 폴더와 D1 마이그레이션 폴더는 처음 만드는 티켓(#9, #5)에서 위치를 정하고 이 표에 더합니다.

## import 방향 (Biome 강제)

```text
web ───────▶ shared
batch ─────▶ shared
functions ─▶ shared
shared ────▶ (없음)

✕ web ⇄ batch      ✕ web·batch ─▶ functions      ✕ functions ─▶ web·batch
✕ web/recommend ─▶ react · react-dom
✕ 앱 코드 ─▶ prototypes/
```

- `biome.json` `overrides`의 `noRestrictedImports`가 별칭(`@batch/*`)과 상대경로(`../batch/...`) 양쪽을 막습니다.
- 예외는 `*.test.ts`입니다. 배치 픽스처 출력을 추천 모듈에 넣는 계약 테스트(스펙 #2)가 batch와 web/recommend를 함께 가져오기 때문입니다.
- 별칭은 `tsconfig.json` `paths` 하나에 정의합니다: `@web/*`, `@shared/*`, `@batch/*`. Vite·Vitest는 `resolve.tsconfigPaths`, tsx는 tsconfig를 직접 읽습니다. 다른 별칭을 따로 만들지 않습니다.

## 폴더별 역할

### `web/recommend/` — 추천 모듈

노선 결정, 방향 기본값, 중간 역, 중간 역별 도착 시간대, 칸 점수, 앉을 가능성, 화면 규칙 판정(칸 차이 작음·출발역에서 바로 앉음·2등 칸)을 모두 여기서 합니다.

- **진입점은 하나**입니다. 입력(출발역·도착역·요일유형·출발 시각·선택한 노선과 방향·정제 데이터)을 받아 결과 하나를 돌려줍니다. 오류(같은 역, 공통 노선 없음, 계산할 중간 역 없음)도 같은 결과 형식으로 돌려줍니다.
- 공식의 시작값(퍼짐·가중치·등급 기준)과 **공식 버전 상수**가 여기 있습니다. 값이나 모델을 바꾸면 공식 버전을 올립니다.
- 순수 TS입니다. `react`·`react-dom` import 금지(Biome), `process.env` 금지(Biome), `new Date()`·`Date.now()` 직접 호출 금지(리뷰). 현재 시각과 오늘 날짜는 화면 훅이 구해 인자로 넘깁니다. 그래야 테스트가 시계에 흔들리지 않습니다.
- 공휴일 목록처럼 계산에 쓰는 정적 표도 여기 둡니다.

### `web/` 종류별 폴더 — 화면

`recommend/` 밖의 화면 코드는 파일 종류로 나눕니다. 화면 이름은 기획 단위 kebab-case입니다(예: `seat-finder`, `survey`).

| 폴더 | 파일 | 둔다 | 두지 않는다 |
|---|---|---|---|
| `pages/` | `<화면>-page.tsx` + `.module.css` | 컴포넌트 조립 및 훅 호출 | 상태, 판정, fetch |
| `hooks/` | `use-<화면>.ts` | `useState`·effect·동작 함수, fetcher·추천 모듈·utils 호출 | JSX, 순수 계산 |
| `components/` | `<컴포넌트>.tsx` + `.module.css` | UI 컴포넌트 | fetch, 판정 |
| `api/` | `<대상>-api.ts` | 정제 데이터·설문 함수 호출(fetcher), `*_ENDPOINT` 상수 | 화면 상태 |
| `constants/` | `<화면>-copy.ts` 등 | 화면 문구, 상수, 매직 메서드 같은 표시용 고정 값 | 계산, 공식 값(→ `recommend/formula.ts`) |
| `utils/` | `<동작>.ts` + `<동작>.test.ts` | React 없는 순수 함수(예: 시각 표기, 지난 추천 24시간 판정) | React import, 칸 점수·등급 판정(→ `recommend/`) |
| `styles/` | `global.css` | 웹 공통 스타일 | 컴포넌트 스타일(→ 옆 `.module.css`) |

- 화면이 칸 점수·등급을 다시 판정하지 않습니다. 추천 모듈 결과를 그리기만 합니다.
- 종류 폴더 안에서는 파일 이름이 화면·대상을 드러내게 짓습니다.
- 다른 종류 폴더는 별칭(`@web/hooks/…`)으로, 같은 폴더 안은 `./`로 가져옵니다.

### UI · 로직 분리 — 추적성 우선

버튼 하나를 눌렀을 때 실제 로직까지 **두 단계 안에** 찾아갈 수 있어야 합니다. 페이지 → `hooks/use-<화면>.ts`의 함수(→ fetcher·추천 모듈·utils) 순서입니다. 표시 컴포넌트의 `on*` prop에 페이지가 훅 함수를 그대로 넘기는 연결은 단계로 세지 않습니다.

- **페이지는 조립만** 합니다. `const finder = useSeatFinder()`를 한 번 호출하고 표시 컴포넌트에 값·핸들러를 넘깁니다.
- **화면 하나 = 훅 하나.** 줄 수를 줄이려고 훅을 쪼개지 않고, 여러 훅을 묶는 오케스트레이터 훅도 만들지 않습니다. `hooks/`는 화면 훅을 모으는 곳이지 훅을 잘게 나누는 곳이 아닙니다.
- 조건 하나를 prop 여러 개로 나눈 래퍼 컴포넌트나 "함수를 고르는 함수"를 만들지 않습니다. 단계별 분기는 `switch` 하나로 모읍니다.
- 훅은 정의한 함수 이름 그대로 반환하고, 이름은 `handle*` 대신 동작 이름(`swapStations`·`submitSurvey`)을 씁니다.

### `shared/`

web·batch·functions가 같은 모양을 알아야 하는 것만 둡니다.

- 정제 데이터 형식(배치 출력 = 추천 모듈 입력). 배치와 추천 모듈이 이 타입 하나로 맞물립니다.
- `CONTEXT.md` 용어를 이름으로 쓰는 공용 타입(요일유형, 방향, 칸 번호 등).
- 추천 기록·설문 응답 요청 스키마(zod). 화면이 보내고 설문 함수가 검증하는 계약입니다.
- React, 다른 최상위 폴더, `process.env`를 가져오지 않습니다(Biome).

### `batch/`

원본 공공데이터를 받아 공식 없는 정제 데이터를 `public/data/`에 씁니다(ADR 0001).

- **원본 읽기(네트워크·파일)를 한 경계에 모읍니다.** 테스트는 그 경계를 픽스처로 바꿔 정제 결과만 확인합니다(스펙 #2 테스트 지점 2).
- 출력에 퍼짐·가중치 같은 공식 값을 넣지 않습니다. 정제(이상값 거르기·방향 맞추기·역 이름 맞추기)와 표시 플래그(엘리베이터뿐, 한 방향 없음)까지만 합니다.
- 환경변수는 `batch/env.ts`에서만 읽습니다(Biome `noProcessEnv`). 다른 배치 파일은 `env`를 import합니다.
- 원본 다운로드는 `raw/`에 둡니다(커밋하지 않음).

### `functions/`

Cloudflare Pages Function입니다. 추천 기록 만들기와 설문 응답 만들기 두 요청만 받습니다(ADR 0002, 스펙 #2 "설문 함수와 저장").

- 파일 이름은 Pages 파일 라우팅을 따릅니다(`[id].ts`, `_middleware.ts` 같은 이름이 필요할 수 있어 kebab-case 검사에서 뺐습니다).
- 바인딩(D1·시크릿)은 핸들러의 `context.env`로만 읽습니다.
- 요청을 늘리려면 스펙·ADR을 먼저 고칩니다.

### `public/data/`

배치만 씁니다. 손으로 고치지 않고, 바꾸려면 배치를 고쳐 다시 돌립니다. 달마다 바뀐 내용을 git 이력으로 비교하려고 커밋합니다(ADR 0002).

### `design/`

화면 디자인의 원본입니다. `tokens.json`이 원본이고 `tokens.css`는 `build-tokens.sh`가 만드는 생성물이라 직접 고치지 않습니다.

## 공유 승격 기준

| 공유되는 것 | 위치 |
|---|---|
| web·batch·functions 중 둘 이상이 쓰는 타입·스키마 | `shared/` |

`web/` 안은 처음부터 종류별 폴더라 화면끼리 공유해도 옮길 필요가 없습니다. `shared/`로는 공유가 실제로 생긴 시점에 옮깁니다. 미리 공용 폴더를 만들지 않습니다.

## 새 파일을 만들 때 판단 순서

1. 칸 점수·등급·노선·방향 판정인가? → `web/recommend/`
2. 원본을 받거나 정제하는가? → `batch/`
3. 서버에서 D1에 쓰는가? → `functions/`
4. 둘 이상의 최상위 폴더가 모양을 알아야 하는가? → `shared/`
5. 화면의 조립인가? → `web/pages/` · 상태·동작인가? → `web/hooks/` · 그리기인가? → `web/components/`
6. fetch인가? → `web/api/` · 문구·표시 값인가? → `web/constants/` · React 없는 순수 함수인가? → `web/utils/`

## 리뷰 체크리스트

- 화면이 추천 모듈 결과를 다시 판정하지 않는가?
- 배치 출력에 공식 값(퍼짐·가중치)이 들어가지 않았는가?
- 페이지가 조립만 하는가? 상태·핸들러는 `hooks/`의 화면 훅에 있는가?
- 버튼 onClick에서 실제 로직까지 두 단계 안에 닿는가? 오케스트레이터 훅·반환 시 이름 바꾸기가 없는가?
- 추천 모듈과 `utils/` 파일에 옆 테스트가 있는가? 시계·환경을 직접 읽지 않는가?
- `shared/`에 한 폴더만 쓰는 코드가 새지 않았는가?
- `public/data/`를 손으로 고치지 않았는가?
