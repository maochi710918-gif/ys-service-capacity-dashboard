// 比對新舊資料模型，產生 app/data/update-log.js（本次更新摘要）
// 用法：node diff-update.js <舊 data.js> <新 data.js> <來源說明>
const fs = require('fs'), path = require('path');
const C = require('../app/js/config.js'); const E = require('../app/js/engine.js');
const load = (f) => { const g = {}; new Function('window', fs.readFileSync(f, 'utf8'))(g); return g.RAW_MODEL; };
const [oldF, newF, source] = process.argv.slice(2);
const A = load(oldF), B = load(newF);
const EXCL = C.DEFAULT_CONFIG.excludedPlants;
const cfg = (m) => { const c = JSON.parse(JSON.stringify(C.DEFAULT_CONFIG)); ['SA', 'CA'].forEach((r) => Object.assign(c.weights[r], (m.excelWeights || {})[r] || {})); return c; };
const PA = E.buildPeople(A, cfg(A), A.meta.months), PB = E.buildPeople(B, cfg(B), B.meta.months);
const nn = E.nn, r2 = (v) => nn(v) ? Math.round(v * 100) / 100 : null;
const people = [];
['SA', 'CA'].forEach((role) => PB[role].forEach((b) => {
  const a = PA[role].find((x) => x.name === b.name); if (!a) return;
  const ch = {};
  const cmp = (k, tol) => { const x = a[k], y = b[k]; if ((nn(x) || nn(y)) && !(nn(x) && nn(y) && Math.abs(x - y) <= (tol || 1e-9)) && !(typeof x === 'string' && x === y)) ch[k] = [x, y]; };
  ['totalCars', 'avgCars', 'perCar', 'age3', 'age38', 'age8', 'ageComplete', 'ngFeePer100', 'ngTimePer100', 'keyPer100', 'trendCars', 'volatility', 'prVolume', 'prRevenue', 'prOps', 'power', 'rank', 'prLicense', 'prTenure', 'licenseGap', 'totalOrders'].forEach((k) => cmp(k, 1e-9));
  ['promotion', 'talentType'].forEach((k) => { if (a[k] !== b[k]) ch[k] = [a[k], b[k]]; });
  if (Object.keys(ch).length) people.push({ role, name: b.name, plant: b.plant, status: b.status, ch });
}));
// 廠別（排除撫遠／未辨識）
const plantAgg = (P, m) => {
  const out = {};
  (m.plants || []).filter((r) => EXCL.indexOf(r.plant) < 0).forEach((r) => {
    const sa = P.SA.filter((p) => p.status === '現行' && p.plant === r.plant), ca = P.CA.filter((p) => p.status === '現行' && p.plant === r.plant);
    const cars8 = m.saMonthly.filter((x) => x.actualPlant === r.plant && x.month === m.meta.months[m.meta.months.length - 1]).reduce((s, x) => s + (x.cars || 0), 0);
    out[r.plant] = { saAvgCars: E.mean(sa.map((p) => p.avgCars)), saPerCar: E.mean(sa.map((p) => p.perCar)), saPower: E.mean(sa.map((p) => p.power)), caPower: E.mean(ca.map((p) => p.power)), lastMonthCars: cars8,
      high: sa.concat(ca).filter((p) => nn(p.power) && p.power >= 70).length, types: sa.map((p) => p.talentType).sort().join(',') };
  });
  return out;
};
const ga = plantAgg(PA, A), gb = plantAgg(PB, B);
const plants = Object.keys(gb).map((pl) => { const a = ga[pl] || {}, b = gb[pl]; const ch = {}; ['saAvgCars', 'saPerCar', 'saPower', 'caPower', 'lastMonthCars', 'high'].forEach((k) => { if (nn(a[k]) || nn(b[k])) if (!(nn(a[k]) && nn(b[k]) && Math.abs(a[k] - b[k]) < 1e-9)) ch[k] = [r2(a[k]), r2(b[k])]; }); if (a.types !== b.types) ch.talentMix = ['變動', '變動']; return { plant: pl, ch }; }).filter((x) => Object.keys(x.ch).length);
// 月度直接資料
const last = B.meta.months[B.meta.months.length - 1];
const direct = B.saMonthly.filter((r) => r.month === last).map((b) => { const a = A.saMonthly.find((x) => x.month === last && x.name === b.name) || {}; const ch = {}; ['cars', 'cars3', 'cars38', 'cars8', 'ageComplete', 'actualPlant'].forEach((k) => { if (a[k] !== b[k] && !(nn(a[k]) && nn(b[k]) && Math.abs(a[k] - b[k]) < 1e-9)) ch[k] = [a[k], b[k]]; }); return { name: b.name, plant: b.actualPlant, ch }; }).filter((x) => Object.keys(x.ch).length);
// 未被本次更新修改的原始資料（應完全相同）
const untouched = ['revenue', 'app', 'a1', 'a2', 'bodyPaint', 'csi', 'csiFirst', 'esSelf', 'esRedesignate', 'ngFee', 'ngTime', 'keyUnlock'];
const untouchedDiff = [];
B.saMonthly.forEach((b) => { const a = A.saMonthly.find((x) => x.month === b.month && x.name === b.name); if (!a) return untouchedDiff.push(b.month + ' ' + b.name + ' 新增列'); untouched.forEach((k) => { if (a[k] !== b[k]) untouchedDiff.push(b.month + ' ' + b.name + ' ' + k); }); });
const caSame = JSON.stringify(A.caMonthly.map((r) => { const o = Object.assign({}, r); delete o._row; return o; })) === JSON.stringify(B.caMonthly.map((r) => { const o = Object.assign({}, r); delete o._row; return o; }));
const nonLast = B.saMonthly.filter((b) => b.month !== last).filter((b) => { const a = A.saMonthly.find((x) => x.month === b.month && x.name === b.name) || {}; return a.cars !== b.cars; }).length;
// 異常：同名跨職務／廠別
const anomalies = [];
PB.SA.forEach((p) => { const q = PB.CA.find((x) => x.name === p.name); if (q) anomalies.push(p.name + '：同時出現於服專總覽（' + p.plant + '）與出納總覽（' + q.plant + '）'); });
const sumCars = (m, mo) => m.saMonthly.filter((r) => !mo || r.month === mo).reduce((s, r) => s + (r.cars || 0), 0);
const log = {
  generatedAt: new Date().toISOString(), source, file: B.meta.fileName, month: last,
  totals: { lastMonthCars: [sumCars(A, last), sumCars(B, last)], ytdCars: [sumCars(A), sumCars(B)] },
  counts: {
    directRows: direct.length, people: people.length,
    powerChanged: people.filter((p) => p.ch.power).length, rankChanged: people.filter((p) => p.ch.rank).length,
    talentChanged: people.filter((p) => p.ch.talentType).length, promoChanged: people.filter((p) => p.ch.promotion).length, plants: plants.length
  },
  checks: { nonLastMonthCarsChanged: nonLast, untouchedSourceDiffs: untouchedDiff.length, cashierMonthlyUnchanged: caSame },
  excluded: EXCL, people, plants, direct, anomalies
};
fs.writeFileSync(path.join(__dirname, '../app/data/update-log.js'), '/* 本次更新摘要（自動產生：tools/diff-update.js） */\nwindow.UPDATE_LOG = ' + JSON.stringify(log) + ';\n');
console.log(JSON.stringify({ totals: log.totals, counts: log.counts, checks: log.checks, anomalies, plantsChanged: plants.map((p) => p.plant) }, null, 1));
console.log(people.filter((p) => p.ch.talentType || p.ch.promotion || p.ch.rank).map((p) => p.name + ' ' + JSON.stringify({ r: p.ch.rank, t: p.ch.talentType, pr: p.ch.promotion })).join('\n'));
