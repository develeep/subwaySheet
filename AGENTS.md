## Agent Answer

에이전트 최종 답변은 반드시 한글로 진행한다.

## Agent skills

### Issue tracker

이슈와 스펙은 GitHub Issues(develeep/subwaySheet)에서 `gh` CLI로 관리한다. See `docs/agents/issue-tracker.md`.

### Triage labels

기본 5개 라벨(needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix)을 그대로 쓴다. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: 루트의 `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

## 프로젝트 한눈에

- 수도권 지하철에서 내 구간에 곧 자리가 날 칸을 추천하는 모바일 웹이다. 제품은 `PRD-subwaySheet.md`, 1단계 범위와 구현 결정은 스펙 이슈 #2가 원본이다.
- 정적 SPA(Vite + React) + Cloudflare Pages Function 하나(설문 함수, D1) + 월별 배치(TypeScript, GitHub Actions cron)다(ADR 0002).
- 칸 점수는 화면의 추천 모듈이 계산하고, 배치는 공식 없는 정제 데이터만 만든다(ADR 0001).
- 폴더: `web/`(화면, `web/recommend/`가 추천 모듈) · `shared/`(공용 데이터 형식) · `batch/` · `functions/` · `public/data/`(정제 데이터). 자세한 배치는 `docs/conventions/folder-structure-convention.md`.

## 우선순위

규칙이 서로 다르면 위에 있는 것이 이긴다.

1. 이 파일
2. `docs/conventions/coding-convention.md`
3. `docs/conventions/folder-structure-convention.md`
4. `docs/conventions/git-convention.md`
5. 저장소 루트 설정 파일 (`biome.json`, `tsconfig.json`, `vite.config.ts`)

결정의 근거와 되돌린 결정은 `docs/adr/`에 있다. 되돌린 것을 다시 제안하기 전에 관련 ADR을 먼저 읽는다.

## 작업 규칙

- 패키지 매니저는 pnpm만 사용한다.
- lint / format은 **Biome 단일 툴체인**을 따른다(ESLint·Prettier 사용하지 않음).
- 커밋 메시지는 `<타입>: <요약>` 형식이다(`docs/conventions/git-convention.md`).
- 빌드 스크립트가 있는 의존성을 더하면 `pnpm-workspace.yaml` `allowBuilds`에 등록한다(지금은 `esbuild`·`simple-git-hooks`).
- **환경변수는 배치만 쓴다.** `batch/env.ts`에서만 `process.env`를 읽고 다른 배치 파일은 그 `env`를 import한다(Biome `noProcessEnv`). 설문 함수는 바인딩(D1·시크릿)을 핸들러의 `context.env`로만 읽는다. 화면은 환경변수를 쓰지 않는다.
- **시크릿을 커밋하지 않는다.** `DATA_GO_KR_KEY`는 로컬 `.env`(gitignore)와 GitHub Actions 시크릿에만 두고 로그에 찍지 않는다.
- **배치 결과물에 공식을 넣지 않는다.** 퍼짐·가중치·등급 기준은 `web/recommend/`에만 있다. 시작값이나 모델을 바꾸면 공식 버전 상수를 올린다(ADR 0001, 스펙 #2).
- `public/data/`는 배치로만 만든다. 손으로 고치지 않는다. 원본 다운로드(`raw/`)는 커밋하지 않는다.
- **설문 함수는 두 요청만 받는다**: 추천 기록 만들기, 설문 응답 만들기(ADR 0002). 요청을 늘리려면 스펙·ADR을 먼저 고친다. 입력은 모두 `shared/`의 zod 스키마로 검증하고, D1은 `.bind()`로만 값을 넣고, 오류 응답에 내부 정보를 담지 않는다.
- **원 IP를 저장하거나 로그에 찍지 않는다.** 레이트 리밋은 IP 해시로만 센다(스펙 #2).
- 화면은 추천 모듈 결과를 그리기만 한다. 칸 점수·등급·노선·방향을 화면에서 다시 판정하지 않는다.

## 구조 규칙

- 서버 렌더링 없는 Vite + React SPA다.
- 다른 최상위 폴더·다른 화면 폴더는 별칭(`@web/*`, `@shared/*`, `@batch/*`)으로, 같은 폴더 안은 `./`로 import한다.
- import 방향은 `web·batch·functions → shared`뿐이다. web ⇄ batch, functions ↔ web·batch, shared → 다른 폴더는 막혀 있다(Biome `noRestrictedImports`). `*.test.ts`만 예외(계약 테스트).
- `web/recommend/`는 순수 TS다. React·`process.env`를 가져오지 않고(Biome), 현재 시각을 직접 읽지 않는다 — 화면 훅이 구해 인자로 넘긴다.
- 화면은 `web/<화면>/`에 Screen(`<화면>-screen.tsx`)·훅(`use-<화면>.ts`)·표시 컴포넌트·`*.module.css`를 둔다. Screen은 훅 호출과 조립만 한다.
- 화면 하나 = 훅 하나다. 버튼 onClick에서 실제 로직까지 Screen → 훅 함수(→ fetcher·추천 모듈) 두 단계 안에 닿게 하고, 오케스트레이터 훅·훅 쪼개기·반환 시 이름 바꾸기를 하지 않는다(`folder-structure-convention.md` "추적성 우선").
- 네이밍은 `docs/conventions/coding-convention.md` "네이밍 규칙"을 따른다. 파일명 kebab-case와 named export는 Biome가 강제한다.
- 용어는 `CONTEXT.md`를 따른다. _Avoid_로 적힌 말을 코드·문구·테스트 이름에 쓰지 않는다.
- 파일 하나에만 해당하는 설명(흐름·상수 근거·같이 고칠 곳)은 그 파일 머리 주석에 두고, 이 문서에는 경로만 남긴다(`coding-convention.md` "주석 규칙").

## 확인 후 단정 (에이전트 작업 규칙)

- **이 레포 밖에 있는 사실은 원본을 열어 본 뒤에만 단정한다.** 공공데이터 형식·값은 실제 데이터·API 응답과 데이터셋 문서, Cloudflare·Vite 동작은 공식 문서, 디자인 수치는 `design/prototype.html`·`design/tokens.json`, 정책은 PRD·스펙 #2·ADR이 원본이다. 열어 보지 않았으면 "확인 못 함"이라고 쓴다.
- **UI 수치는 측정한 뒤에 고친다.** 같은 배율로 `design/prototype.html` 캡처와 앱 캡처를 비교해 어긋난 원인(폰트·여백·정렬)을 찾은 뒤 고친다.
- **PRD·스펙·디자인과 다르게 구현해야 하거나 원본끼리 상충하면 구현 전에 묻는다.** 화면 동작이 바뀌는 선택을 답변에 적는 것으로 대신하지 않는다.
- **사용자에게 알린 범위·계획대로 실행한다.** 커밋 분할·대상 파일·검사 범위를 바꿔야 하면 실행 전에 다시 알린다.

## 검증 흐름

1. 관련 공식 문서(Vite·Vitest·Cloudflare Pages/D1)를 먼저 확인한다.
2. 구현 후 `pnpm check`(Biome lint + format + import 방향)를 실행한다.
3. 구현 후 `pnpm typecheck`를 실행한다.
4. 구현 후 `pnpm test:coverage`를 실행한다. 커버리지 80% 아래면 통과가 아니다.
5. 구현 후 `pnpm build`를 실행한다.
6. 화면 흐름을 바꿨으면 Playwright E2E를 실행한다(#9에서 명령을 더한다).
7. 커밋 때 pre-commit 훅(simple-git-hooks)이 staged 파일에 Biome 검사를 돌린다. 통과해야 커밋된다.

## 검증 명령

```bash
pnpm install
pnpm check
pnpm typecheck
pnpm test:coverage
pnpm build
```

## 메모

- 공통 규칙은 `AGENTS.md`와 `docs/conventions/*`에 모으고, 도구별 파일(`CLAUDE.md`)은 `@AGENTS.md`만 둔다.
- 결정을 되돌리면 새 ADR을 쓰고, 옛 ADR 머리에 `Superseded by ADR 000N`을 적는다. 규칙(이 문서)과 이력(ADR)을 섞지 않는다.
