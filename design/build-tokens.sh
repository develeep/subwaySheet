#!/usr/bin/env bash
# tokens.json → tokens.css 재생성.
# 생성기는 다크 모드를 .dark 클래스로만 내보내므로, 아티팩트 테마 규칙(시스템 설정 + data-theme 토글)에 맞게 블록을 바꿔 끼운다.
set -euo pipefail
cd "$(dirname "$0")"
GEN="${DS_SKILL:-$HOME/.claude/plugins/cache/ui-ux-pro-max-skill/ui-ux-pro-max/2.15.0/.claude/skills/design-system}/scripts/generate-tokens.cjs"
node "$GEN" -c tokens.json -o tokens.css >/dev/null
python3 - <<'PY'
import re
css = open("tokens.css").read()
m = re.search(r"\.dark \{\n(.*?)\n\}", css, re.S)
body = m.group(1) + "\n  color-scheme: dark;"
indented = "\n".join("  " + l for l in body.splitlines())
dark = ('@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n' + indented + "\n  }\n}\n"
        ':root[data-theme="dark"] {\n' + body + "\n}")
css = css[:m.start()] + dark + css[m.end():]
css += '\n/* 선택 노선 색: <html class="lineN"> */\n' + "".join(f":root.line{n} {{ --color-line-current: var(--color-line-{n}); }}\n" for n in range(1, 9))
open("tokens.css", "w").write(css)
PY
echo "Generated: design/tokens.css"
