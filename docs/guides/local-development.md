# 로컬 개발: 화면과 설문 함수 띄우기

## 어느 쪽을 쓰나

| 확인할 것 | 명령 | 주소 |
|---|---|---|
| 추천 화면만(역 고르기 → 결과) | `pnpm dev` | http://localhost:5173 |
| "도착했어요" 설문과 D1 저장까지 | 아래 `wrangler pages dev` 순서 | http://localhost:8788 |

- `pnpm dev`(Vite)는 `functions/`를 돌리지 않습니다. `/api/*`가 404라 추천 기록 저장이 실패하고, 설계대로 **"도착했어요" 버튼이 숨습니다.** 고장이 아닙니다.
- 설문까지 보려면 Cloudflare 로컬 실행 도구 wrangler로 빌드 결과(`dist/`), 설문 함수, 로컬 D1을 함께 띄웁니다.
- 아래 명령은 wrangler 4.151.0으로 확인했습니다. wrangler는 레포 의존성이 아니라 `pnpm dlx`로 그때그때 받습니다.

## 처음 세팅 (새 컴퓨터에서 한 번)

Node는 `.nvmrc`(24.13.0), pnpm은 `package.json`의 `packageManager`(pnpm@12.11.2)로 고정합니다.

```bash
nvm install && nvm use
corepack enable
pnpm install
cp .env.example .env
```

- `corepack enable`이 `packageManager`에 적힌 pnpm 버전을 씁니다. `pnpm -v`가 12.11.2인지 확인합니다.
- `pnpm install`이 커밋 전 검사 훅(`simple-git-hooks`)도 겁니다.
- `.env`의 `DATA_GO_KR_KEY`는 배치(`pnpm batch`)에만 필요합니다. 화면·테스트는 비워 둬도 됩니다.
- Claude Code 플러그인은 `.claude/settings.json`에 있습니다. 레포를 처음 열면 설치·신뢰를 묻습니다.

## 준비 (터미널마다)

레포 폴더에서 `nvm use`로 `.nvmrc`의 Node를 잡습니다. WSL에서는 Windows의 node가 먼저 잡히면 `tsc`가 깨지므로 `which node`가 WSL 쪽 경로인지 확인합니다.

```bash
nvm use
```

## 1. 로컬 D1 설정 파일 (처음 한 번)

마이그레이션을 적용하려면 wrangler 설정 파일에 D1 바인딩 `DB`가 있어야 합니다. 없으면 `Couldn't find a D1 DB with the name or binding 'DB'` 오류가 납니다.
배포 설정 파일은 #12에서 정하므로, 로컬용은 레포 밖(홈 폴더)에 둡니다.

레포 폴더에서 실행합니다(`$PWD`가 레포 경로로 들어갑니다).

```bash
cat > ~/subway-wrangler.toml <<EOF
name = "subway-sheet"
compatibility_date = "2026-07-01"

[[d1_databases]]
binding = "DB"
database_name = "subway-sheet"
database_id = "local-dev"
migrations_dir = "$PWD/migrations"
EOF
```

`database_id = "local-dev"`는 로컬용 이름일 뿐이고 실제 Cloudflare D1과 연결되지 않습니다.

## 2. 로컬 D1에 표 만들기 (처음 한 번, 마이그레이션이 늘면 다시)

```bash
pnpm dlx wrangler@4.151.0 d1 migrations apply DB --local --config ~/subway-wrangler.toml --persist-to ~/.subway-d1-state
```

- `0001_init.sql ✅`가 나오면 `migrations/0001_init.sql`의 표가 생긴 것입니다. 적용한 파일은 D1 안의 `d1_migrations` 표에 기록됩니다.
- DB 파일은 `~/.subway-d1-state`에 남습니다. 레포 안 `.wrangler/`는 wrangler 임시 폴더라 `.gitignore`로 뺐습니다.

## 3. 빌드하고 띄우기

```bash
pnpm build
pnpm dlx wrangler@4.151.0 pages dev dist --d1 DB=local-dev --binding IP_HASH_SECRET=local-dev-secret --persist-to ~/.subway-d1-state --compatibility-date 2026-07-01
```

- `Ready on http://localhost:8788`이 나오면 브라우저로 엽니다.
- **`--d1 DB=local-dev`의 id와 `--persist-to` 경로는 2단계와 같아야 합니다.** 다르면 표 없는 빈 DB가 새로 생겨 저장이 500이 되고 "도착했어요"가 숨습니다.
- `IP_HASH_SECRET`은 IP를 HMAC으로 바꿀 때 쓰는 키입니다(`functions/lib/request-guard.ts`). 로컬에서는 아무 값이나 되지만, 빠지면 두 요청이 500이 됩니다.

## 4. 저장된 데이터 보기

서버를 띄운 채 다른 터미널에서(준비 단계 먼저):

```bash
pnpm dlx wrangler@4.151.0 d1 execute DB --local --config ~/subway-wrangler.toml --persist-to ~/.subway-d1-state --command "SELECT * FROM survey_responses"
```

표 이름을 `recommendations`, `rate_limits`로 바꿔 볼 수 있습니다. `--json`을 붙이면 한글이 깨지지 않게 JSON으로 나옵니다.

## 주의

- **코드를 고치면 다시 빌드합니다.** `dist/`를 띄우는 방식이라 자동 새로고침이 없습니다. Ctrl+C로 끄고 3단계를 다시 합니다.
- **한 IP가 1분에 30번을 넘기면 429로 막힙니다.** 결과 화면을 빠르게 여러 번 열면 "도착했어요"가 숨습니다. 1분 뒤 풀립니다.
- **추천 기록 하나에는 한 번만 답할 수 있습니다.** 다시 해 보려면 뒤로 가서 "앉을 칸 찾기"를 다시 눌러 새 추천 기록을 만듭니다.
- **DB를 처음 상태로 되돌리려면** `~/.subway-d1-state`를 지우고 2단계를 다시 합니다.
- **wrangler는 레포의 `.env`도 읽습니다.** 띄울 때 `Using secrets defined in .env`가 나오고 `DATA_GO_KR_KEY`가 로컬 함수 환경에 `(hidden)`으로 들어갑니다. 설문 함수는 이 키를 읽지 않고 값이 로그에 찍히지도 않습니다. Cloudflare 문서("Pages Functions bindings")에 따르면 `.dev.vars`가 있으면 `.env`를 읽지 않으므로, `.dev.vars`를 쓰려면 먼저 `.gitignore`에 더합니다.
