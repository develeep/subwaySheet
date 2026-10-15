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
- 칸 점수는 화면의 추천 모듈(`web/recommend/`)이 계산하고, 배치는 공식 없는 정제 데이터만 만든다(ADR 0001).
- 폴더 배치와 import 방향은 `docs/conventions/folder-structure-convention.md`, 코드 규칙은 `docs/conventions/coding-convention.md`, 브랜치·커밋은 `docs/conventions/git-convention.md`. 용어는 `CONTEXT.md`.

## 우선순위

규칙이 서로 다르면 위에 있는 것이 이긴다: 이 파일 → coding-convention → folder-structure-convention → git-convention → 루트 설정 파일. 결정의 근거와 되돌린 결정은 `docs/adr/`에 있다. 되돌린 것을 다시 제안하기 전에 관련 ADR을 먼저 읽는다.

## 경계 (어기면 데이터·개인정보·배포가 깨진다)

- **시크릿을 커밋하지 않는다.** `DATA_GO_KR_KEY`는 로컬 `.env`(gitignore)와 GitHub Actions 시크릿에만 두고 로그에 찍지 않는다.
- **공식은 `web/recommend/`에만 둔다.** 배치 결과물에 퍼짐·가중치·등급 기준을 넣지 않는다. 시작값이나 모델을 바꾸면 공식 버전 상수를 올린다.
- **`public/data/`는 배치로만 만든다.** 손으로 고치지 않고, 원본 다운로드(`raw/`)는 커밋하지 않는다.
- **설문 함수는 두 요청만 받는다**(추천 기록 만들기, 설문 응답 만들기). 요청을 늘리려면 스펙·ADR을 먼저 고친다.
- **원 IP를 저장하거나 로그에 찍지 않는다.** 레이트 리밋은 IP 해시로만 센다.
- **화면은 추천 모듈 결과를 그리기만 한다.** 칸 점수·등급·노선·방향을 화면에서 다시 판정하지 않는다.

## 확인 후 단정 (에이전트 작업 규칙)

- **이 레포 밖에 있는 사실은 원본을 열어 본 뒤에만 단정한다.** 공공데이터 형식·값은 실제 데이터·API 응답과 데이터셋 문서, Cloudflare·Vite·Vitest 동작은 공식 문서, 디자인 수치는 `design/prototype.html`·`design/tokens.json`, 정책은 PRD·스펙 #2·ADR이 원본이다. 열어 보지 않았으면 "확인 못 함"이라고 쓴다.
- **UI 수치는 측정한 뒤에 고친다.** 같은 배율로 `design/prototype.html` 캡처와 앱 캡처를 비교해 어긋난 원인(폰트·여백·정렬)을 찾은 뒤 고친다.
- **PRD·스펙·디자인과 다르게 구현해야 하거나 원본끼리 상충하면 구현 전에 묻는다.** 화면 동작이 바뀌는 선택을 답변에 적는 것으로 대신하지 않는다.
- **사용자에게 알린 범위·계획대로 실행한다.** 커밋 분할·대상 파일·검사 범위를 바꿔야 하면 실행 전에 다시 알린다.

## 완료 기준

`pnpm check`·`pnpm typecheck`·`pnpm test:coverage`(80% 이상)·`pnpm build`가 모두 통과해야 끝이다. 화면 흐름을 바꿨으면 Playwright E2E도 통과시킨다(#9에서 명령을 더한다).

## 메모

- 공통 규칙은 `AGENTS.md`와 `docs/conventions/*`에 모으고, 도구별 파일(`CLAUDE.md`)은 `@AGENTS.md`만 둔다.
- 결정을 되돌리면 새 ADR을 쓰고, 옛 ADR 머리에 `Superseded by ADR 000N`을 적는다. 규칙(이 문서)과 이력(ADR)을 섞지 않는다.
