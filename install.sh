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

# 2. Stop hook(只警告不阻擋)
python3 - "$HERE" <<'PY'
import json, os, sys
here = sys.argv[1]
p = os.path.expanduser('~/.claude/settings.json')
cmd = f'node {here}/hook/stop-lint.mjs'
d = {}
if os.path.exists(p):
    try: d = json.load(open(p))
    except Exception:
        print('  ✗ settings.json 讀不動,沒有動它'); raise SystemExit
stop = d.setdefault('hooks', {}).setdefault('Stop', [])
if any('stop-lint.mjs' in c.get('command', '') for m in stop for c in m.get('hooks', [])):
    print('  已設定: Stop hook')
else:
    stop.append({'hooks': [{'type': 'command', 'command': cmd}]})
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=2)
    print(f'  已加入 Stop hook（原有的 {len(stop)-1} 組沒動）')
PY

# 3. 自我驗證
if node "$HERE/test/rules.test.mjs" >/dev/null 2>&1; then
  say "  規則測試通過"
else
  say "  ✗ 規則測試沒過,先修好再用"; exit 1
fi

say ""
say "好了。用法:"
say "  $HERE/bin/speak-tw --public <檔案或目錄>"
say "  在被檢查的 repo 放 .speak-tw.json 設定哪些算對外、哪些排除"
say ""
say "Codex 或其他 agent:沒有技能清單,直接把這行講給它——"
say "  「交稿前跑 $HERE/bin/speak-tw --public <路徑>,exit 1 就照它列的改」"
