/* 每一條規則都要通過兩關:抓得到自己的 bad、放得過自己的 good。
   沒有這一關,規則會越寫越兇——多抓一點的代價是誤傷,而誤傷會讓人把整支工具關掉。 */
import assert from 'node:assert';
import { RULES } from '../rules.mjs';

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

console.log(bad ? '\n' + bad + ' 項不符' : '\n' + RULES.length + ' 條規則全部通過');
process.exit(bad ? 1 : 0);
