import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * check-comment-paths — 코드 주석에 백틱으로 적은 레포 경로(`web/hooks/use-seat-finder.ts` 같은)가 실제로 있는지 본다. `pnpm check`가 부른다.
 * 파일을 옮기거나 이름을 바꾸고 머리 주석을 고치지 않으면 주석이 없는 파일을 가리킨다(coding-convention "코드와 어긋난 주석은 버그").
 * `<화면>` 같은 자리표시가 든 경로는 실제 경로가 아니라서 검사하지 않는다.
 */

const CODE_DIRS = ["shared", "batch", "web", "functions"];
const REPO_PATH = /`((?:web|batch|shared|functions|public|design|docs|scripts)\/[\w./-]+)`/g;

const files = CODE_DIRS.filter(existsSync).flatMap((dir) =>
  readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => join(dir, file)),
);
const broken = files.flatMap((file) =>
  [...readFileSync(file, "utf8").matchAll(REPO_PATH)]
    .map((match) => match[1] ?? "")
    .filter((path) => !existsSync(path))
    .map((path) => `${file}: ${path}`),
);

if (broken.length > 0) {
  console.error(`주석이 없는 경로를 가리킨다:\n${broken.join("\n")}`);
  process.exit(1);
}
