// 比對新舊兩版 Excel 資料模型（以各自 Excel 原值為準，兩版皆經 verify.js 確認系統重算一致），產生 app/data/update-log.js
// 用法：node diff-update.js <舊 data.js> <新 data.js> "<來源說明>"
const fs = require('fs'), path = require('path');
const C = require('../app/js/config.js');
const load = (f) => { const g = {}; new Function('window', fs.readFileSync(f, 'utf8'))(g); return g.RAW_MODEL; };
const [oldF, newF, source] = process.argv.slice(2);
const A = load(oldF), B = load(newF);
const nn = (v) => v !== null && v !== undefined && v !== '';
const EXCL = C.DEFAULT_CONFIG.excludedPlants;
const sumBy = (rows, m, k) => rows.filter((r) => r.month === m).reduce((s, r) => s + (typeof r[k] === 'number' ? r[k] : 0), 0);
const months = Array.from(new Set(A.meta.months.concat(B.meta.months))).sort();
const monthly = months.map((m) => ({ month: m, cars: [A.meta.months.includes(m) ? sumBy(A.saMonthly, m, 'cars') : null, B.meta.months.includes(m) ? sumBy(B.saMonthly, m, 'cars') : null],
  revenue: [A.meta.months.includes(m) ? sumBy(A.saMonthly, m, 'revenue') : null, B.meta.months.includes(m) ? sumBy(B.saMonthly, m, 'revenue') : null],
  orders: [A.meta.months.includes(m) ? sumBy(A.caMonthly, m, 'orders') : null, B.meta.months.includes(m) ? sumBy(B.caMonthly, m, 'orders') : null] }));
const KEYS = ['totalCars', 'avgCars', 'perCar', 'app', 'totalOrders', 'avgOrders', 'esign', 'completeness', 'prVolume', 'prService', 'prOps', 'power', 'rank', 'prLicense', 'licenseGap', 'promotion', 'talentType', 'status', 'plant', 'position', 'license'];
const people = [], added = [], removed = [];
['saPeople', 'caPeople'].forEach((set) => {
  const role = set === 'saPeople' ? 'SA' : 'CA';
  B[set].forEach((b) => {
    const a = A[set].find((x) => x.name === b.name);
    if (!a) { added.push({ role, name: b.name, plant: b.plant, status: b.status }); return; }
    const ch = {};
    KEYS.forEach((k) => { const x = a[k], y = b[k]; if (!nn(x) && !nn(y)) return; if (typeof x === 'number' && typeof y === 'number' ? Math.abs(x - y) > 1e-9 : x !== y) ch[k] = [nn(x) ? x : null, nn(y) ? y : null]; });
    if (Object.keys(ch).length) people.push({ role, name: b.name, plant: b.plant, status: b.status, ch });
  });
  A[set].forEach((a) => { if (!B[set].find((x) => x.name === a.name)) removed.push({ role, name: a.name, plant: a.plant, status: a.status }); });
});
const cur = (p) => p.ch.status ? p.ch.status[1] === '現行' || p.ch.status[0] === '現行' : p.status === '現行';
const plants = (B.plants || []).filter((r) => EXCL.indexOf(r.plant) < 0).map((b) => { const a = (A.plants || []).find((x) => x.plant === b.plant) || {}; const ch = {};
  ['saCount', 'caCount', 'saAvgCars', 'saPerCar', 'saPower', 'caAvgOrders', 'caPower'].forEach((k) => { if ((nn(a[k]) || nn(b[k])) && !(typeof a[k] === 'number' && typeof b[k] === 'number' && Math.abs(a[k] - b[k]) < 1e-9)) ch[k] = [nn(a[k]) ? a[k] : null, nn(b[k]) ? b[k] : null]; });
  return { plant: b.plant, ch }; }).filter((x) => Object.keys(x.ch).length);
const grid = {}; ['SA', 'CA'].forEach((r) => { const ga = (A.gridRef || {})[r] || {}, gb = (B.gridRef || {})[r] || {}; Object.keys(Object.assign({}, ga, gb)).forEach((t) => { if (ga[t] !== gb[t]) (grid[r] = grid[r] || []).push({ type: t, from: ga[t] || 0, to: gb[t] || 0 }); }); });
const sum = (a) => a.reduce((s, x) => s + (x || 0), 0);
const log = {
  generatedAt: new Date().toISOString(), source, fileOld: A.meta.fileName, file: B.meta.fileName, monthsOld: A.meta.months, months: B.meta.months, note: B.meta.note,
  totals: { carsOld: sum(monthly.map((m) => m.cars[0])), cars: sum(monthly.map((m) => m.cars[1])), ordersOld: sum(monthly.map((m) => m.orders[0])), orders: sum(monthly.map((m) => m.orders[1])), revenueOld: sum(monthly.map((m) => m.revenue[0])), revenue: sum(monthly.map((m) => m.revenue[1])) },
  headcount: { SA: [A.saPeople.filter((p) => p.status === '現行').length, B.saPeople.filter((p) => p.status === '現行').length], CA: [A.caPeople.filter((p) => p.status === '現行').length, B.caPeople.filter((p) => p.status === '現行').length],
    rosterSA: [sum((A.plants || []).filter((r) => EXCL.indexOf(r.plant) < 0).map((r) => r.saCount)), sum((B.plants || []).map((r) => r.saCount))], rosterCA: [sum((A.plants || []).filter((r) => EXCL.indexOf(r.plant) < 0).map((r) => r.caCount)), sum((B.plants || []).map((r) => r.caCount))] },
  counts: { people: people.length, added: added.length, removed: removed.length, powerChanged: people.filter((p) => p.ch.power && cur(p)).length, rankChanged: people.filter((p) => p.ch.rank && cur(p)).length,
    talentChanged: people.filter((p) => p.ch.talentType && cur(p)).length, promoChanged: people.filter((p) => p.ch.promotion && cur(p)).length, statusChanged: people.filter((p) => p.ch.status).length, plants: plants.length },
  monthly, people, added, removed, plants, grid, excluded: EXCL
};
fs.writeFileSync(path.join(__dirname, '../app/data/update-log.js'), '/* 本次更新摘要（自動產生：tools/diff-update.js） */\nwindow.UPDATE_LOG = ' + JSON.stringify(log) + ';\n');
console.log(JSON.stringify({ totals: log.totals, headcount: log.headcount, counts: log.counts, grid }, null, 1));
console.log('monthly', monthly.map((m) => m.month + ' 接車 ' + m.cars.join('→') + ' 結帳 ' + m.orders.join('→')).join('\n'));
console.log('status', people.filter((p) => p.ch.status).map((p) => p.name + ':' + p.ch.status.join('→')).join('、'));
console.log('added', added.map((p) => p.name + '(' + p.status + ')').join('、'));
console.log('removed', removed.map((p) => p.name).join('、'));
console.log('rank/talent', people.filter((p) => cur(p) && (p.ch.talentType || p.ch.promotion)).map((p) => p.name + ' ' + JSON.stringify({ t: p.ch.talentType, pr: p.ch.promotion, r: p.ch.rank })).join('\n'));
