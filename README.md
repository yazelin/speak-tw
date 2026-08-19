# speak-tw：講人話

用程式掃中文寫作的老毛病。**零相依**（只用 node 內建），任何 agent 都能跑——它只是一支會回傳退出碼的 CLI。 <!-- speak-tw-ok 這一行在示範規則本身 -->

```bash
git clone https://github.com/yazelin/speak-tw ~/speak-tw
bash ~/speak-tw/install.sh          # 進 PATH + skills + 掛 Stop hook（冪等）
speak-tw --public README.md index.html
```

**只 clone 是不夠的。**那樣只有檔案：agent 不會知道它存在，hook 也不會跑。`install.sh` 才會把它接上這台機器。換一台機器、或要給 Codex 用，都要先跑它。

有問題 exit 1：

```
fake-contrast　「不是 X，是 Y」的假對比（1 處）
  直接把 Y 講出來就好。這個句型是用來製造洞見感的，不傳達資訊。
    index.html:156  這不是省錢的小聰明，是整條產線的設計主軸

掃了 1 個檔案，1 處要改
確定某一處是刻意的，就在那一行加 speak-tw-ok
```

## 為什麼要做這個

prompt 型的寫作規範有個死穴：**要靠 agent 想到要用它**。同一種毛病（把比喻當詞用、假對比句型、戲劇化形容）被指正五次都沒根治，就是這樣漏掉的。

一支程式不需要被想起來。放進測試流程、pre-commit、CI，它每次都會跑。

## 用法

```bash
speak-tw <路徑...>              掃 .md/.html/.txt（預設當前目錄）
speak-tw --public <路徑...>     連對外文字專用規則一起套
speak-tw --stdin --public       從 stdin 讀一段檢查
speak-tw --list                 列出所有規則
speak-tw --json                 機器讀的輸出
```

`--public` 會多套三類只對「對外文字」成立的規則：全形標點、破折號、禁用詞。內部筆記不套。

### 設定檔

放 `.speak-tw.json` 在被掃的目錄：

```json
{ "public": ["index.html", "README.md"], "off": ["academic-filler"] }
```

`public` 列到的檔案自動套 public 規則，不必每次加旗標。

### 放行

在那一行加 `speak-tw-ok`（HTML 用 `<!-- speak-tw-ok -->`）。

## 規則

19 條，分三類：

**被指正過的實際案例**（這份清單的價值所在）
`fake-contrast` 不是 X，是 Y ｜ `organic-metaphor` 長出／長成 ｜ `banned-word` 接住／身段 ｜ `luo-wording` 落檔／落下來 ｜ `homework-tone` 改出得意的回來讓我看看 ｜ `drama-word` 對自己不利／管不住 ｜ `metaphor-as-noun` 每一刀 ｜ `ke-classifier` 這顆 bug ｜ `true-x-not-y` 真正的 X 不是… <!-- speak-tw-ok 這一行在示範規則本身 -->

**標點與字元**
`em-dash` 破折號 ｜ `halfwidth-punct` 中文間的半形標點 ｜ `emoji` ｜ `simplified` 簡體字 ｜ `dollar-escape` Markdown 裡跳脫的 $

**常見 AI 味**
`hollow-closing` 空洞收尾 ｜ `false-candor` 說真的／老實說 ｜ `academic-filler` 本質上／說到底 ｜ `cliche-opening` 在當今…的時代 ｜ `vague-authority` 業界專家認為 <!-- speak-tw-ok 這一行在示範規則本身 -->

`speak-tw --list` 看完整說明。

## 加規則

編 `rules.mjs`，每條要有 `bad`（該抓到）和 `good`（不該抓到），然後：

```bash
node test/rules.test.mjs
```

測試會逐條驗：抓得到壞例、放得過好例、**而且不會咬到別條規則的好例**。少了這一關，規則會為了多抓一點越寫越兇，誤傷多了就會有人把整支工具關掉。

## 掛成 hook：連對話也檢查

`hook/stop-lint.mjs` 是 Claude Code 的 `Stop` hook，在回覆結束時檢查那則訊息。

```json
{ "hooks": { "Stop": [ { "hooks": [
  { "type": "command", "command": "node /home/ct/speak-tw/hook/stop-lint.mjs" }
] } ] } }
```

加進**既有的** Stop 陣列，不要蓋掉別的 hook。`install.sh` 會自己做這件事。

### Codex

`install.sh` 也會寫 `~/.codex/hooks.json`（格式跟 Claude 一樣）並在 `~/.codex/AGENTS.md` 加一行。

**但 Codex 的 hook 預設不信任、會被跳過**，要在互動介面打 `/hooks` 審核並 trust 一次才會跑；而且 trust 是綁 hook 內容的雜湊，改過內容要重 trust。

hook 的 payload 欄位名各家不同：Claude 給 `transcript_path`，Codex 這邊沒有樣本可對（這台的 `hooks.json` 從沒設過任何 hook），所以 `stop-lint.mjs` 多試了幾個欄位名，最後退回「`~/.codex/sessions` 裡兩分鐘內的最新 jsonl」。**Codex 這條路還沒實機驗過**，先靠 AGENTS.md 那一行墊著。

輸出兩種格式都給：Claude 讀 `systemMessage`，Codex 讀 `hookSpecificOutput.additionalContext`。

**只警告，不阻擋。**誤判時擋住回覆會很煩，而且誤判率還沒量過。跑一陣子確認夠低，再考慮改成阻擋。

規則只跑這幾條：`fake-contrast`、`drama-word`、`metaphor-as-noun`、`organic-metaphor`、`banned-word`、`luo-wording`、`ke-classifier`。挑的標準是**字面特徵明確、誤判率低**。對話不是對外 prose，全形標點與破折號那幾條不該套；AI 味那幾條在對話裡的誤判率未知，先不放。

hook 撈不到 transcript、或格式改了，就安靜退出，工具壞掉不該打斷工作。

**談論這支工具本身時不檢查。**第一次真的觸發就是誤報：回覆裡在列規則清單（「落檔／落下來」「這顆 bug」），被當成使用那些詞。檔案可以加 `speak-tw-ok`，對話沒地方加，所以訊息裡提到 `speak-tw` 或 `rules.mjs` 就整則跳過。代價是「同時談這支工具又真的犯規」的訊息會漏掉——可接受，**誤報會讓人關掉整個提醒，漏報只是少提醒一次**。

## 跟 speak-human-tw 的差別

[speak-human-tw](https://github.com/Raymondhou0917/speak-human-tw)（MIT）是同一個問題的 prompt 解法：38 種 AI 寫作痕跡、60 多條中國用語對照，由 agent 讀進去之後改寫，會先列問題等你同意。規則覆蓋面比這裡廣很多，值得裝。

這支走的是另一條路：**規則寫成 regex，用退出碼講話**。差別在執行方式：不需要 agent 記得要用它，也不需要模型判斷，放進 CI 就是硬性的。兩個可以並用：那邊負責改寫建議，這邊負責交稿前的最後一道閘。 <!-- speak-tw-ok 這一行在示範規則本身 -->

## 授權

MIT · 林亞澤
