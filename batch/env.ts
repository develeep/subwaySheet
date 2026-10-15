import { existsSync } from "node:fs";

/**
 * env — 배치가 쓰는 환경변수. **`process.env`는 이 파일에서만 읽는다**(Biome `noProcessEnv`, AGENTS.md).
 * 로컬은 레포 루트 `.env`(gitignore), GitHub Actions는 시크릿 `DATA_GO_KR_KEY`로 넣는다(#11). 키는 로그에 찍지 않는다.
 */

if (existsSync(".env")) process.loadEnvFile(".env");

export function requireDataGoKrKey(): string {
  const key = process.env.DATA_GO_KR_KEY;
  if (!key) throw new Error("DATA_GO_KR_KEY가 설정되지 않았다(.env 또는 Actions 시크릿)");
  return key;
}
