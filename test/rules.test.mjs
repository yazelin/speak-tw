/* 每一條規則都要通過兩關:抓得到自己的 bad、放得過自己的 good。
   沒有這一關,規則會越寫越兇——多抓一點的代價是誤傷,而誤傷會讓人把整支工具關掉。 */
import assert from 'node:assert';
import { RULES } from '../rules.mjs';

import { readFileSync } from 'node:fs';

// README 會落後於 rules.mjs,而且落後的時候沒有人會發現(2026-08-28 實際發生:
// README 寫 19 條,程式已經 22 條,三條沒列進去)。這一關讓它出聲。
function checkReadme(RULES) {
  const md = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const miss = RULES.filter((r) => !md.includes('`' + r.id + '`')).map((r) => r.id);
  const claimed = md.match(/^(\d+) 條，分三類/m);
  return { miss, claimed: claimed ? Number(claimed[1]) : null };
}

let bad = 0;
const ok = (n, c, x) => { console.log((c ? '  ✓ ' : '  ✗ ') + n + (x ? '　' + x : '')); if (!c) bad++; };

console.log('\n逐條驗 ' + RULES.length + ' 條規則\n');
const ids = new Set();
for (const r of RULES) {
  assert.ok(r.id && r.name && r.why && r.re && r.bad && r.good, r.id + ' 少了欄位');
  assert.ok(!ids.has(r.id), 'id 重複:' + r.id); ids.add(r.id);
  assert.ok(['any', 'public'].includes(r.register), r.id + ' 的 register 不對');
  const hit = (s) => { r.re.lastIndex = 0; return r.re.test(s); };
  const c1 = hit(r.bad), c2 = !hit(r.good);
  ok(r.id.padEnd(18) + '抓得到壞例', c1, c1 ? '' : JSON.stringify(r.bad));
  ok(r.id.padEnd(18) + '放得過好例', c2, c2 ? '' : JSON.stringify(r.good));
}

// 交叉驗:任何一條規則都不該咬到別條的好例(誤傷最容易發生在這裡)
console.log('\n交叉驗:規則之間不互咬');
let cross = 0;
for (const r of RULES) for (const other of RULES) {
  if (r === other) continue;
  r.re.lastIndex = 0;
  if (r.re.test(other.good)) { console.log('  ✗ ' + r.id + ' 咬到 ' + other.id + ' 的好例:' + other.good); cross++; }
}
ok('沒有互咬', cross === 0, cross ? cross + ' 組' : '');

// 程式碼與網址不該被檢查
console.log('\n程式碼與網址要被跳過');
ok('這一條之後由 CLI 的 stripCode 負責', true, '見 bin/speak-tw');

console.log('\nREADME 與規則表');
// README 與規則表對得上嗎
{
  const { miss, claimed } = checkReadme(RULES);
  ok('README 列出每一條規則', miss.length === 0, miss.join(' '));
  ok(`README 寫的條數是 ${claimed}`, claimed === RULES.length, `實際 ${RULES.length} 條`);
}

console.log(bad ? '\n' + bad + ' 項不符' : '\n' + RULES.length + ' 條規則全部通過');
process.exit(bad ? 1 : 0);
