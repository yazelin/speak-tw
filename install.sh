#!/bin/bash
# install.sh — 把 speak-tw 接上這台機器。冪等,重跑會說「已經好了」。
#
#   git clone https://github.com/yazelin/speak-tw ~/speak-tw
#   bash ~/speak-tw/install.sh
#
# 做三件事:
#   1. symlink 進 ~/.claude/skills/ → Claude Code 的技能清單看得到
#   2. 把 Stop hook 加進 ~/.claude/settings.json（加進既有陣列,不蓋掉別的）
#   3. 跑一次測試確認規則沒壞
# 光 clone 是不夠的:那樣只有檔案,agent 不會知道它存在,hook 也不會跑。
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
say() { printf '%s\n' "$*"; }

# 1. skill symlink
mkdir -p "$HOME/.claude/skills"
LINK="$HOME/.claude/skills/speak-tw"
if [ -L "$LINK" ] && [ "$(readlink "$LINK")" = "$HERE" ]; then
  say "  已連結: $LINK"
elif [ -e "$LINK" ]; then
  say "  ✗ $LINK 已存在而且不是指向這裡,沒有動它"
else
  ln -s "$HERE" "$LINK" && say "  已連結: $LINK → $HERE"
fi

# 2. 放進 PATH,才能直接打 speak-tw(不用寫完整路徑)
if [ -d "$HOME/.local/bin" ] || mkdir -p "$HOME/.local/bin"; then
  ln -sf "$HERE/bin/speak-tw" "$HOME/.local/bin/speak-tw"
  if echo "$PATH" | tr ':' '\n' | grep -qx "$HOME/.local/bin"; then
    say "  已放進 PATH: speak-tw"
  else
    say "  已連結到 ~/.local/bin,但它不在 PATH —— 把這行加進 ~/.bashrc:"
    say '    export PATH="$HOME/.local/bin:$PATH"'
  fi
fi

# 3. Stop hook(只警告不阻擋)
# 用 node 不用 python3:node 本來就是這支工具的必要條件,而 Git Bash 沒有內建 python3。
node -e '
const fs = require("fs"), os = require("os"), path = require("path");
const here = process.argv[1];
const p = path.join(os.homedir(), ".claude", "settings.json");
const cmd = `node ${here}/hook/stop-lint.mjs`;
let d = {};
if (fs.existsSync(p)) {
  try { d = JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { console.log("  \u2717 settings.json 讀不動,沒有動它"); process.exit(0); }
}
d.hooks ??= {}; d.hooks.Stop ??= [];
const stop = d.hooks.Stop;
const has = stop.some(m => (m.hooks || []).some(c => (c.command || "").includes("stop-lint.mjs")));
if (has) { console.log("  已設定: Stop hook"); process.exit(0); }
stop.push({ hooks: [{ type: "command", command: cmd }] });
fs.mkdirSync(path.dirname(p), { recursive: true });
fs.writeFileSync(p, JSON.stringify(d, null, 2));
console.log(`  已加入 Stop hook（原有的 ${stop.length - 1} 組沒動）`);
' "$HERE"

# 4. Codex(如果裝了):hooks.json 同格式,外加 AGENTS.md 一行
if [ -d "$HOME/.codex" ]; then
  node -e '
const fs = require("fs"), os = require("os"), path = require("path");
const here = process.argv[1];
const p = path.join(os.homedir(), ".codex", "hooks.json");
if (fs.existsSync(p)) {
  let d = null;
  try { d = JSON.parse(fs.readFileSync(p, "utf8")); } catch {}
  if (d) {
    const h = d.hooks || d;
    h.Stop ??= [];
    const has = h.Stop.some(m => (m.hooks || []).some(c => (c.command || "").includes("stop-lint")));
    if (has) console.log("  已設定: Codex Stop hook");
    else {
      h.Stop.push({ hooks: [{ type: "command", command: `node ${here}/hook/stop-lint.mjs` }] });
      fs.writeFileSync(p, JSON.stringify(d, null, 2));
      console.log("  已加入 Codex Stop hook  ← 要在 Codex 互動介面打 /hooks 審核並 trust 一次才會生效");
    }
  }
}
const a = path.join(os.homedir(), ".codex", "AGENTS.md");
const line = `對外中文寫完交稿前跑:\`${here}/bin/speak-tw --public <路徑>\`,exit 1 就照它列的改。`;
const cur = fs.existsSync(a) ? fs.readFileSync(a, "utf8") : "";
if (!cur.includes("speak-tw")) {
  fs.writeFileSync(a, cur.replace(/\n+$/, "") + "\n" + line + "\n");
  console.log("  已加一行到 ~/.codex/AGENTS.md");
}
' "$HERE"
fi

# 5. 自我驗證
if node "$HERE/test/rules.test.mjs" >/dev/null 2>&1; then
  say "  規則測試通過"
else
  say "  ✗ 規則測試沒過,先修好再用"; exit 1
fi

say ""
say "好了。用法:"
say "  speak-tw --public <檔案或目錄>"
say "  在被檢查的 repo 放 .speak-tw.json 設定哪些算對外、哪些排除"
say ""
say "Codex:hook 加好了,但要在互動介面打 /hooks 審核 trust 一次才會跑(改過 hook 內容也要重 trust)。"
say "其他沒有技能清單的 agent,直接把這行講給它:"
say "  「交稿前跑 speak-tw --public <路徑>(或 $HERE/bin/speak-tw),exit 1 就照它列的改」"
