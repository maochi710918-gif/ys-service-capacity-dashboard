// 將「接待保留率.xlsx」轉為 app/data/retention.js
// 用法：node build-retention.js <接待保留率.xlsx>
const fs = require('fs'), path = require('path'), XLSX = require('xlsx');
require('../app/js/config.js'); const I = require('../app/js/importer.js');
const f = process.argv[2];
const r = I.parseRetention(XLSX, XLSX.readFile(f), path.basename(f));
if (r.report.errors.length) { console.error(r.report.errors); process.exit(1); }
const meta = { file: path.basename(f), builtAt: new Date(fs.statSync(f).mtime).toISOString().slice(0, 10), defs: r.defs, params: r.params, base: 'CY25 最後定保服專 → CY26 回廠' };
fs.writeFileSync(path.join(__dirname, '../app/data/retention.js'), '/* 自動產生：' + meta.file + ' — 請用 tools/build-retention.js 或系統「資料匯入」更新 */\nwindow.RETENTION_DATA = ' + JSON.stringify({ meta, advisors: r.advisors, plants: r.plants, dealers: r.dealers }) + ';\n');
console.log('advisors', r.advisors.length, 'plants', r.plants.length, 'dealers', r.dealers.map((d) => d.dealer + ' ' + d.plantRate).join(' | '), 'warn', r.report.warnings.length);
console.log('plants', r.plants.map((p) => p.code + ' ' + p.plant + ' ' + (p.plantRate * 100).toFixed(2) + '%').join('、'));
console.log('NG', r.advisors.filter((a) => a.ng).map((a) => a.plant + a.advisor).join('、'));
console.log('defs', r.defs, r.params);
