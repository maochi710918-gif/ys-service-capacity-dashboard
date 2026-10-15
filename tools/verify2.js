// v2：以附件為基準逐人核對（戰力、排名、同證照／同年資PR、落差、升階、人才類型、九宮格）
// 用法：node verify2.js <Excel>
const XLSX = require('xlsx'); const C = require('../app/js/config.js'); const I = require('../app/js/importer.js'); const E = require('../app/js/engine.js');
const f = process.argv[2]; const { model, report } = I.parseWorkbook(XLSX, XLSX.readFile(f), 'x');
if (report.errors.length) { console.log(report.errors); process.exit(1); }
const cfg = JSON.parse(JSON.stringify(C.DEFAULT_CONFIG)); const P = E.buildPeople(model, cfg, model.meta.months);
const keys = ['power', 'rank', 'prLicense', 'prTenure', 'licenseGap', 'promotion', 'talentType']; const bad = {}; let n = 0;
for (const r of ['SA', 'CA']) for (const p of P[r]) {
  for (const k of keys) {
    const ex = p.excel[k], me = p[k]; n++; let ok;
    if (ex == null || ex === '') ok = me == null || me === '' || (k === 'talentType' && /資料不足/.test(me)) || (k === 'promotion' && me === '不評估');
    else if (typeof ex === 'number') ok = me != null && Math.abs(ex - me) < 1e-6;
    else ok = String(ex) === String(me);
    if (!ok) (bad[k] = bad[k] || []).push(r + ':' + p.name + ' x=' + ex + ' s=' + me);
  }
}
console.log('checked', n); for (const k in bad) console.log(k, bad[k].length, bad[k].slice(0, 5));
for (const r of ['SA', 'CA']) {
  const cur = P[r].filter((p) => p.status === '現行');
  console.log(r, 'formal rank', cur.filter((p) => p.rank != null).length, 'solicit PR valid', cur.filter((p) => p.excel.prSolicit != null && p.excel.prSolicit !== '').length);
  const g = {}; cur.forEach((p) => { g[p.talentType] = (g[p.talentType] || 0) + 1; }); const ref = model.gridRef[r];
  console.log('  grid diffs', Object.keys(ref).filter((k) => ref[k] !== (g[k] || 0)).map((k) => k + ' x' + ref[k] + ' s' + (g[k] || 0)));
}
console.log('solicit rows', model.solicit.length, 'monthlyPower', model.monthlyPower.length, 'warnings', report.warnings.length, report.warnings.slice(0, 3));
