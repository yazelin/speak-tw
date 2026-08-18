#!/usr/bin/env node
/* stop-lint.mjs — Claude Code / Codex 的 Stop hook:回覆結束時檢查那則訊息有沒有踩老毛病。
 *
 * 只警告,不阻擋。誤判時擋住回覆會很煩,而且誤判率還沒量過。
 * 觀察一陣子確認誤判夠低,再考慮改成 exit 2(阻擋)。
 *
 * 規則只跑 5 條:對話不是對外 prose,全形標點、破折號那些不該套;
 * AI 味那幾條(說到底/老實說/在當今…)在對話裡誤判率未知,先不放。
 *
 * 設定(~/.claude/settings.json,加進既有的 Stop 陣列,不要蓋掉):
 *   { "type": "command", "command": "node /home/ct/speak-tw/hook/stop-lint.mjs" }
 */
import { readFileSync } from 'node:fs';
import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const RULES = 'fake-contrast,drama-word,metaphor-as-noun,organic-metaphor,banned-word';
const BIN = new URL('../bin/speak-tw', import.meta.url).pathname;

let input = '';
try { input = readFileSync(0, 'utf8'); } catch (e) { process.exit(0); }
let ev = {};
try { ev = JSON.parse(input); } catch (e) { process.exit(0); }
/* payload 的欄位名各家不同,而且會變。Claude 給 transcript_path;
   Codex 沒有樣本可看(這台的 hooks.json 從沒設過),所以多試幾個名字,
   最後退回「~/.codex/sessions 裡最新的 jsonl」。找不到就安靜退出。 */
const tp = ev.transcript_path || ev.transcriptPath || ev.conversation_path || ev.rollout_path || newestCodexSession();
if (!tp) process.exit(0);

/* 從 transcript 撈出最後一則 assistant 的純文字。
   格式會變,所以只做「盡量撈得到」——撈不到就安靜退出,不要因為 hook 壞掉打斷工作。 */
function newestCodexSession() {
  try {
    const dir = process.env.HOME + '/.codex/sessions';
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(d + '/' + e.name) : (/\.jsonl$/.test(e.name) ? [d + '/' + e.name] : []));
    const files = walk(dir).map((f) => [f, fs.statSync(f).mtimeMs]).sort((a, b) => b[1] - a[1]);
    return files.length && Date.now() - files[0][1] < 120000 ? files[0][0] : '';
  } catch (e) { return ''; }
}

function lastAssistantText(path) {
  let lines;
  try { lines = readFileSync(path, 'utf8').trim().split('\n'); } catch (e) { return ''; }
  for (let i = lines.length - 1; i >= 0; i--) {
    let o;
    try { o = JSON.parse(lines[i]); } catch (e) { continue; }
    const m = o.message || o;
    if ((o.type || m.role) !== 'assistant' && m.role !== 'assistant') continue;
    const c = m.content;
    const text = typeof c === 'string' ? c
      : Array.isArray(c) ? c.filter((x) => x && x.type === 'text').map((x) => x.text).join('\n')
      : '';
    if (text.trim()) return text;
  }
  return '';
}

const text = lastAssistantText(tp);
if (!text || text.length < 30) process.exit(0);

let out = '';
try {
  execFileSync('node', [BIN, '--stdin', '--public', `--rules=${RULES}`], { input: text, encoding: 'utf8' });
  process.exit(0);                       // 乾淨
} catch (e) {
  out = (e.stdout || '').trim();         // 有中規則:speak-tw 回 exit 1
}
if (!out) process.exit(0);

// 只提醒,不阻擋:輸出 systemMessage、正常退出
const lines = out.split('\n').filter((l) => l.trim() && !/^掃了|^確定某一處/.test(l));
const body = '講人話檢查（只提醒，沒有擋住）：\n' + lines.join('\n')
  + '\n規則在 ~/speak-tw/rules.mjs；確定是刻意的就無視。';
// Claude 讀 systemMessage;Codex 讀 hookSpecificOutput.additionalContext。兩個都給。
console.log(JSON.stringify({
  systemMessage: body,
  hookSpecificOutput: { hookEventName: ev.hook_event_name || 'Stop', additionalContext: body },
}));
process.exit(0);
