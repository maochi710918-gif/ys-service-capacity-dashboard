// 將 CSI 服務戰情系統 records.js 彙總為 app/data/csi.js
// 用法：node build-csi.js [records.js 路徑]（預設下載 https://maochi710918-gif.github.io/csi-service-dashboard/records.js 後指定路徑）
const fs = require('fs'), path = require('path');
const src = process.argv[2];
if (!src) { console.error('請指定 records.js 路徑'); process.exit(1); }
global.window = {}; eval(fs.readFileSync(src, 'utf8'));
const { meta, records } = window.CSI_DATA;
const DIMS = ['o', 'r', 'k', 'x', 'l', 'g'];
const agg = {}; // key: month|plant|advisor
records.forEach((r) => {
  const month = r.y.slice(0, 4) + '/' + r.y.slice(4, 6);
  const plant = r.f ? r.f + '廠' : '未辨識';
  const k = month + '|' + plant + '|' + (r.a || '');
  const o = agg[k] = agg[k] || { m: month, p: plant, a: r.a || '', n: 0, s: {}, c: {}, lo: 0, lk: 0, voc: 0 };
  o.n++;
  DIMS.forEach((d) => { if (r[d] != null) { o.s[d] = (o.s[d] || 0) + r[d]; o.c[d] = (o.c[d] || 0) + 1; } });
  if (r.o != null && r.o < 5) o.lo++;
  if (r.k != null && r.k < 5) o.lk++;
  if (r.v) o.voc++;
});
const rows = Object.values(agg).map((o) => { const x = { m: o.m, p: o.p, a: o.a, n: o.n, lo: o.lo, lk: o.lk, voc: o.voc }; DIMS.forEach((d) => { if (o.c[d]) { x[d] = +o.s[d].toFixed(4); x[d + 'n'] = o.c[d]; } }); return x; });
const voc = records.filter((r) => r.v && r.y >= '202601').map((r) => ({ m: r.y.slice(0, 4) + '/' + r.y.slice(4, 6), p: r.f + '廠', a: r.a, e: r.e, o: r.o, k: r.k, vc: r.vc, v: r.v }));
const out = '/* 自動產生：CSI 服務戰情系統彙總（' + meta.generated_at + '，' + meta.total + ' 份問卷）— 請用 tools/build-csi.js 更新 */\nwindow.CSI_SUMMARY = ' +
  JSON.stringify({ meta: { total: meta.total, generatedAt: meta.generated_at, months: meta.months.map((m) => m.slice(0, 4) + '/' + m.slice(4, 6)), source: 'https://maochi710918-gif.github.io/csi-service-dashboard/' }, rows, voc }) + ';\n';
fs.writeFileSync(path.join(__dirname, '../app/data/csi.js'), out);
console.log('rows', rows.length, 'voc', voc.length, (out.length / 1024).toFixed(0) + 'KB');
