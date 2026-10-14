# Coding Convention

## 목표

- 레포 전반에서 일관된 코드 스타일과 작업 방식을 유지합니다.
- lint, format, import, 네이밍, 주석, 에러 처리, 테스트 규칙을 공통 기준으로 맞춥니다.
- 파일 배치·폴더 경계·훅 분리는 `folder-structure-convention.md`, 브랜치·커밋은 `git-convention.md`가 다룹니다.

## 적용 방식

- 이 문서와 `AGENTS.md`가 다르면 `AGENTS.md`가 우선합니다.
- 각 규칙에는 강제 수단을 표시합니다. **(Biome)**은 도구가 막고, **(리뷰)**는 리뷰 체크리스트입니다.

## 기본 원칙

- 패키지 매니저는 pnpm만 사용합니다.
- lint / format은 **Biome 단일 툴체인**입니다(ESLint·Prettier 병행하지 않음).
- **React Compiler를 켜 둡니다**(`vite.config.ts`의 `reactCompilerPreset`). Rules of React(조건부 훅 금지, 렌더 중 ref 변형 금지 등)를 지키고 `useMemo`·`useCallback`을 습관적으로 쓰지 않습니다.
- 용어는 `CONTEXT.md`를 따릅니다. 코드 이름·화면 문구·테스트 이름에서 _Avoid_로 적힌 말을 쓰지 않습니다(예: "량", "착석 확률") **(리뷰)**.

## 파일 / 코드 규칙

- 다른 최상위 폴더나 `web/` 안의 다른 종류 폴더(`pages`·`hooks`·`components` 등)를 가리킬 때는 별칭(`@web/*`, `@shared/*`, `@batch/*`)을 씁니다. 같은 폴더 안은 `./`로 씁니다 **(리뷰)**.
- 사용하지 않는 import는 허용하지 않습니다 **(Biome `noUnusedImports`)**.
- 타입만 쓰는 import는 `import type`을 사용합니다 **(Biome `useImportType`)**.
- 쓰지 않는 파일·export·상수와 도달하지 않는 분기는 발견 즉시 지웁니다. 호환 alias·재export·주석 처리로 남기지 않습니다. 지우기 전에 참조가 0건인지 검색으로 확인합니다 **(리뷰)**.
- 파일 이동·개명은 `git mv`로 합니다. 이력을 보존하려면 같은 커밋에서 내용까지 크게 바꾸지 않습니다 **(리뷰)**.

## 네이밍 규칙

### 파일·폴더 (Biome)

| 대상 | 규칙 | 예 |
|---|---|---|
| 폴더·파일 | `kebab-case`, ASCII만 | `car-diagram.tsx`, `fast-exit.ts` |
| 컴포넌트 파일 | 컴포넌트 이름의 kebab-case | `CarDiagram` → `car-diagram.tsx` |
| 페이지 파일 | `pages/{화면}-page.tsx` | `seat-finder-page.tsx` |
| hook 파일 | `hooks/use-*.ts` | `use-seat-finder.ts` |
| fetcher 파일 | `api/{대상}-api.ts` | `refined-data-api.ts` |
| 동반 파일 | 대상 파일명 + 접미어 | `car-diagram.module.css`, `fast-exit.test.ts` |

- `useFilenamingConvention`(kebab-case · strictCase · requireAscii)이 `web/`·`shared/`·`batch/`에 적용됩니다. `functions/`는 Pages 파일 라우팅 이름(`[id].ts`, `_middleware.ts`) 때문에 뺐습니다.
- 같은 이름의 `.ts`와 `.tsx`를 한 폴더에 두지 않습니다. import 경로가 어느 파일인지 모호해집니다.

### export (Biome)

- **named export만** 사용합니다(`noDefaultExport`). import 이름이 파일마다 달라지는 것을 막고 rename·검색을 안전하게 합니다.
- 예외: 루트 설정 파일(`*.config.ts`). Pages Function 핸들러는 원래 named export(`onRequestPost`)라 예외가 아닙니다.

### 식별자 (리뷰)

| 대상 | 규칙 | 예 |
|---|---|---|
| 컴포넌트·타입·interface·enum형 객체 | `PascalCase` | `CarDiagram`, `RecommendResult` |
| Props 타입 | `<Component>Props` | `CarDiagramProps` |
| `I`/`T` 접두어 | 쓰지 않음 | `IStation` ✕ → `Station` |
| 함수·변수·hook | `camelCase` | `pickDefaultDirection`, `useRoutePicker` |
| boolean | `is`/`has`/`should`/`can` 접두어 | `isWeakGap`, `hasMissingStations` |
| 컴포넌트 이벤트 prop / 컴포넌트 안 핸들러 | `on*` prop, `handle*` 구현 | `onSwap={handleSwap}` |
| 훅이 반환하는 함수 | 동작 이름. `handle*` 쓰지 않음 | `swapStations`, `submitSurvey` |
| 모듈 레벨 불변 상수 | `CONSTANT_CASE` | `FORMULA_VERSION`, `SEATS_PER_CAR` |
| CSS Modules 클래스 | `camelCase` + `styles.x` 접근 | `.carCell` → `styles.carCell` |
| 식별자 문자 | ASCII만 (한국어 식별자 금지) | `const 칸` ✕ → `car` |

- 훅은 함수를 정의한 이름 그대로 반환합니다. `return { swap: swapStations }`처럼 반환하면서 이름을 바꾸지 않습니다.
- 외부 계약 이름은 **바꾸지 않습니다**. 대상은 공공데이터 필드명(`qckgffVhclDoorNo`), D1 컬럼명, 환경변수, HTTP 헤더입니다. 그래서 `useNamingConvention`은 켜지 않습니다.
- 줄임말도 camelCase 규칙을 따릅니다: `stationId`, `apiUrl` (`stationID`·`APIUrl` ✕).

## 주석 규칙 (리뷰)

저장소 전체 규칙은 `AGENTS.md`·이 문서에 둡니다. **파일 하나에만 해당하는 설명(흐름·상수 근거·같이 고칠 곳)은 그 파일의 머리 주석에 둡니다.** 그 파일을 열 때 읽히고, 코드와 같은 커밋에서 고쳐지기 때문입니다.

- **머리 주석**: 역할이 이름만으로 안 보이는 파일(추천 모듈·배치 단계·설문 함수·화면 훅·로직 있는 페이지)은 import 아래 첫 선언 앞에 `/** */`를 둡니다.
  - 첫 줄은 `이름 — 역할(누가 부르는지)`입니다.
  - 이어서 왜 이렇게 했는지, 어기면 무엇이 깨지는지 적습니다.
  - 꼭 지킬 제약은 `**굵게**`, 같이 고칠 곳은 경로로 적습니다.
- 위임만 하는 진입 파일처럼 이름으로 충분한 파일에는 달지 않습니다.
- 주석만 읽고 이해되게 씁니다. 외부 근거는 찾아갈 수 있는 이름으로 적습니다(예: 데이터셋 번호 `OA-12921`, API 이름 `getFstExit`, 이슈 `#2`, `ADR 0001`).
- 공식의 시작값처럼 추정한 상수는 근거(프로토타입 비교, 추정값 여부)를 옆에 적습니다.
- 코드와 어긋난 주석은 버그입니다. 동작을 바꾸면 같은 커밋에서 주석도 고칩니다. 지금 코드와 무관한 이력·주석 처리한 코드는 남기지 않습니다.
- `~한다`체로 쓰고, 한 블록은 10줄 안팎으로 유지합니다.

## 설문 함수 (`functions/`, 리뷰)

- **요청 하나 = 핸들러 하나.** 핸들러 본문을 위에서 아래로 읽으면 순서가 다 보이게 씁니다: ① 입력 검증 → ② 레이트 리밋 → ③ D1 읽기·쓰기 → ④ 응답. 단계마다 `// ① …` 주석으로 실패하면 어떻게 되는지 적습니다.
- 한 핸들러만 쓰는 단계는 쪼개지 않고 그 핸들러 안에 둡니다. 두 핸들러가 같이 쓰는 것만 공통 함수로 뺍니다.
- 모든 입력은 `shared/`의 zod 스키마로 검증합니다. 노선 칸 수 안의 칸 번호, 구간 정거장 수 안의 정거장 수처럼 서로 걸린 조건까지 검증합니다.
- D1은 prepared statement의 `.bind()`로만 값을 넣습니다. 문자열을 이어 붙여 SQL을 만들지 않습니다.
- 응답 형식은 `{ success, data?, error? }`입니다. `error`에는 고정 문구만 담고 내부 정보(SQL, 스택, 스키마 오류 원문)를 담지 않습니다.
- 원 IP는 저장하지도 로그에 찍지도 않습니다. 레이트 리밋은 IP 해시로만 셉니다.
- 예상 못 한 오류는 `console.error`로 남깁니다(Cloudflare 로그). 이 레포에 따로 오류 수집 도구는 없습니다.

## 화면의 fetch · 에러 처리 (리뷰)

- 화면이 부르는 서버는 우리 설문 함수(`/api/*`)와 정적 정제 데이터(`public/data/`)뿐입니다. 외부 API를 화면에서 직접 부르지 않습니다.
- fetcher는 `web/api/<대상>-api.ts`에 둡니다. 엔드포인트는 `*_ENDPOINT` 상수로 두고 fetch와 테스트가 같은 값을 씁니다.
- fetcher는 **status union**을 돌려줍니다: `ok`, `invalid`(400, 사용자가 고칠 입력), `failed`(그 밖의 실패·네트워크 오류). 400과 장애를 합치면 서버 장애 때 "입력을 확인하세요"라는 거짓 안내가 나갑니다.
- 2xx 본문도 zod로 계약을 검증합니다. 실패하면 `failed`를 돌려줍니다. 기본값으로 조용히 진행하지 않습니다.
- **추천 기록 저장 실패는 화면에 드러내지 않습니다.** 추천 화면은 그대로 보여야 합니다(스펙 #2).
- **설문 제출 실패만 사용자에게 알립니다.** `invalid`와 `failed`는 다른 문구로 보여 줍니다.
- 브라우저 저장소(지난 추천)를 못 쓰는 환경에서도 추천은 정상 동작해야 합니다. 저장소 접근은 try/catch로 감싸고 실패하면 설문 카드만 건너뜁니다.

## 데이터 표시 (리뷰)

- 데이터에 없는 값은 지어내지 않습니다. `?? "2024-01"` 같은 목업 기본값을 쓰지 않습니다. `undefined`로 두고 화면이 빈 값 표기로 보여 줍니다. 목업 값은 테스트 픽스처에만 둡니다.
- 앉을 가능성은 높음·보통·낮음 등급으로만 보여 줍니다. 퍼센트·점수 숫자를 화면에 내지 않습니다(PRD 7.2).
- 결과에는 기준 기간을 함께 적습니다(`CONTEXT.md` "기준 기간").
- 문자열 날짜(`YYYYMMDD` 등)는 `new Date(문자열)`에 넘기지 않습니다. 형식이 맞지 않으면 Invalid Date가 되어 비교가 전부 거짓이 됩니다. 숫자로 잘라 만드는 파서를 두고 테스트합니다.
- 화면 문구가 아직 정해지지 않은 상태(칸 차이 작음, 출발역에서 바로 앉음, 데이터 없는 역, 계산할 수 없음)는 자리표시 문구를 두고 #8에서 바꿉니다.

## 스타일 규칙

- 들여쓰기는 2칸 공백입니다.
- print width(lineWidth)는 120입니다.
- 문자열 quote는 **double quote**를 사용합니다.
- semicolon을 사용합니다.
- import 정렬은 Biome `assist.actions.source.organizeImports`가 자동 처리합니다.
- 수동 포맷보다 `pnpm format`(Biome) 결과를 우선합니다.
- 컴포넌트 스타일은 컴포넌트 옆 `*.module.css`(CSS Modules)에 둡니다. 색·간격·글꼴 값은 `design/tokens.css` 변수만 씁니다. 새 값이 필요하면 `design/tokens.json`에 토큰을 더하고 `tokens.css`를 다시 만듭니다.

## Biome 핵심 규칙 (`biome.json`)

- `linter.rules.preset`: `recommended`
- `linter.domains.react`: `recommended`
- `correctness.noUnusedImports`: error
- `style.useImportType`: error
- `style.noDefaultExport`: error (`*.config.ts` 제외)
- `style.noProcessEnv`: error (`batch/env.ts`·`*.config.ts` 제외)
- `security.noDangerouslySetInnerHtml`: warn
- `a11y.useKeyWithClickEvents`: warn
- `suspicious.noArrayIndexKey`: warn
- `css.parser.cssModules`: true
- `assist.actions.source.organizeImports`: on
- overrides
  - `web/**`·`shared/**`·`batch/**` → `useFilenamingConvention`(kebab-case · strictCase · requireAscii)
  - 폴더별 `noRestrictedImports` → import 방향(`folder-structure-convention.md` "import 방향"). `web/recommend/**`·`shared/**`는 React도 막음
  - `**/*.test.ts` → `noRestrictedImports` 끔(계약 테스트)
- 검사에서 빼는 곳: `design/`, `prototypes/`, `public/data/`, `.agents/`, `.claude/`, `.taste-skill/`, `.gitignore` 대상

## 검증 명령

```bash
pnpm lint             # biome lint .
pnpm format           # biome format --write .
pnpm check            # biome check . (lint + format 진단)
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest run
pnpm test:coverage    # vitest run --coverage (80% 기준)
pnpm build            # tsc --noEmit && vite build
```

## 테스트

### 무엇을 테스트하나 (스펙 #2 "Testing Decisions")

- **겉으로 보이는 동작만** 확인합니다. 입력(역, 시각, 데이터)과 출력(추천 칸, 등급, 표시)만 보고, 내부 함수 나누기나 중간 값은 테스트하지 않습니다. 그래야 공식을 다듬어도 테스트가 버팁니다.
- 테스트 지점은 넷입니다.
  1. **추천 모듈**: 작은 가짜 노선 데이터 + 프로토타입 회귀 시나리오(실제 2호선 데이터).
  2. **배치**: 작은 원본 픽스처 → 정제 데이터 출력. 네트워크는 원본 읽기 경계에서 끊습니다.
  3. **계약 테스트**: 배치 픽스처 출력을 그대로 추천 모듈에 넣어 결과가 나오는지.
  4. **설문 함수**: 로컬 D1로 요청 → 저장. 검증 거절, 중복 응답 거절, 레이트 리밋, 원 IP 미저장. 실행 도구는 #5에서 정합니다.
- **E2E는 Playwright로 핵심 흐름 하나**(역 고르기 → 결과 → "도착했어요" → 설문 제출, 그리고 다시 왔을 때 설문 카드)만 둡니다(#9).
- 화면 컴포넌트는 따로 단위 테스트하지 않습니다. jsdom·React Testing Library·Storybook은 쓰지 않습니다.
- 커버리지는 `shared/`·`batch/`·`web/recommend/`·`web/utils/` 기준 80% 이상입니다(`vite.config.ts` `coverage.thresholds`).

### 위치

- 단위 테스트는 대상 파일 옆(`foo.ts` ↔ `foo.test.ts`)에 둡니다.
- 테스트 전용 픽스처는 쓰는 테스트와 같은 폴더의 `fixtures/`에 둡니다. 런타임 코드에서 import하지 않습니다.
- vitest는 `node` 환경 하나로 돕니다. 테스트 파일은 `*.test.ts`입니다.
