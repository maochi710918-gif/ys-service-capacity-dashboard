/* =========================================================================
 * 指標計算引擎（公式集中管理）
 *  1. aggregate：月度明細 → 個人期間指標（與 Excel 服專總覽／出納總覽口徑一致）
 *  2. score：PR、綜合戰力、排名、同證照PR、同年資PR、證照戰力落差、升階準備度、人才類型
 *  3. alerts：異常／管理提醒（門檻取自設定檔）
 * 空值一律為 null，不以 0 代替。
 * ========================================================================= */
(function (root) {
  const CFG = root.APP_CONFIG || (typeof require !== 'undefined' ? require('./config.js') : null);
  const nn = (v) => v !== null && v !== undefined && !(typeof v === 'number' && isNaN(v));
  const num = (v) => (nn(v) && typeof v === 'number' ? v : null);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const mean = (a) => { const b = a.filter(nn); return b.length ? sum(b) / b.length : null; };
  const vals = (rows, k) => rows.map((r) => num(r[k])).filter(nn);
  const sumOrNull = (rows, k) => { const v = vals(rows, k); return v.length ? sum(v) : null; };

  /* ---------------- 1. 月度 → 個人期間指標 ---------------- */
  function trendRatio(rows, key, months) {
    // 近3月趨勢：期間最後3個月平均 ÷ 前3個月平均 − 1（僅計有值月份）
    if (months.length < 6) return null;
    const last = months.slice(-3), prev = months.slice(-6, -3);
    const a = mean(vals(rows.filter((r) => last.indexOf(r.month) >= 0), key));
    const b = mean(vals(rows.filter((r) => prev.indexOf(r.month) >= 0), key));
    return nn(a) && b ? a / b - 1 : null;
  }
  function trendDiff(rows, key, months) {
    // 近3月CSI變化：最後3個月平均 − 前3個月平均（點）
    if (months.length < 6) return null;
    const last = months.slice(-3), prev = months.slice(-6, -3);
    const a = mean(vals(rows.filter((r) => last.indexOf(r.month) >= 0), key));
    const b = mean(vals(rows.filter((r) => prev.indexOf(r.month) >= 0), key));
    return nn(a) && nn(b) ? a - b : null;
  }
  function cv(rows, key) {
    // 波動度：母體標準差 ÷ 平均
    const v = vals(rows, key);
    if (v.length < 2) return null;
    const m = mean(v); if (!m) return null;
    return Math.sqrt(mean(v.map((x) => (x - m) * (x - m)))) / m;
  }
  function completenessOf(rows, role) {
    const F = CFG.COMPLETENESS_FIELDS[role];
    const active = rows.filter((r) => F.some((f) => nn(r[f])));
    if (!active.length) return { validMonths: 0, completeness: 0 };
    let c = 0; active.forEach((r) => F.forEach((f) => { if (nn(r[f])) c++; }));
    return { validMonths: active.length, completeness: c / (F.length * active.length) };
  }

  function aggregate(role, rows, months) {
    rows = rows.filter((r) => months.indexOf(r.month) >= 0);
    const cm = completenessOf(rows, role);
    const o = { validMonths: cm.validMonths, completeness: cm.completeness };
    if (role === 'SA') {
      const tc = sumOrNull(rows, 'cars'), tr = sumOrNull(rows, 'revenue');
      o.totalCars = tc == null ? 0 : tc;
      o.totalRevenue = tr == null ? 0 : tr;
      o.avgCars = mean(vals(rows, 'cars'));
      o.avgRevenue = mean(vals(rows, 'revenue'));
      o.perCar = tc ? (tr || 0) / tc : null;
      const c3 = sumOrNull(rows, 'cars3') || 0, c38 = sumOrNull(rows, 'cars38') || 0, c8 = sumOrNull(rows, 'cars8') || 0;
      o.cars3 = c3; o.cars38 = c38; o.cars8 = c8; o.carsAgeMissing = tc ? tc - c3 - c38 - c8 : 0;
      o.age3 = tc ? c3 / tc : null; o.age38 = tc ? c38 / tc : null; o.age8 = tc ? c8 / tc : null;
      o.ageComplete = tc ? (c3 + c38 + c8) / tc : null;
      ['app', 'a1', 'a2', 'bodyPaint', 'csi', 'csiFirst', 'esSelf', 'esRedesignate'].forEach((k) => { o[k] = mean(vals(rows, k)); });
      o.ngFee = sumOrNull(rows, 'ngFee') || 0; o.ngTime = sumOrNull(rows, 'ngTime') || 0; o.keyUnlock = sumOrNull(rows, 'keyUnlock') || 0;
      o.ngFeePer100 = tc ? o.ngFee / tc * 100 : null;
      o.ngTimePer100 = tc ? o.ngTime / tc * 100 : null;
      o.keyPer100 = tc ? o.keyUnlock / tc * 100 : null;
      o.trendCars = trendRatio(rows, 'cars', months);
      o.trendRevenue = trendRatio(rows, 'revenue', months);
      o.trendCsi = trendDiff(rows, 'csi', months);
      o.volatility = cv(rows, 'cars');
    } else {
      const to = sumOrNull(rows, 'orders');
      o.totalOrders = to == null ? 0 : to;
      o.avgOrders = mean(vals(rows, 'orders'));
      ['esign', 'card', 'csi', 'csiFirst', 'esSelf', 'plantCsiSample'].forEach((k) => { o[k] = mean(vals(rows, k)); });
      o.ngFee = sumOrNull(rows, 'ngFee') || 0; o.keyUnlock = sumOrNull(rows, 'keyUnlock') || 0;
      o.ngFeePer100 = to ? o.ngFee / to * 100 : null;
      o.keyPer100 = to ? o.keyUnlock / to * 100 : null;
      o.trendOrders = trendRatio(rows, 'orders', months);
      o.trendCsi = trendDiff(rows, 'csi', months);
      o.volatility = cv(rows, 'orders');
    }
    return o;
  }

  /* ---------------- 2. 人才盤點屬性（Excel 公式） ---------------- */
  function tenureGroup(years, cfg) {
    if (!nn(years)) return null;
    for (const g of cfg.tenureGroups) if (years < g.max) return g.label;
    return cfg.tenureGroups[cfg.tenureGroups.length - 1].label;
  }
  const L3 = (s) => String(s || '').slice(0, 3), L2 = (s) => String(s || '').slice(0, 2);
  function maturity(role, license, years) {
    if (!license || !nn(years)) return null;
    if (role === 'SA') {
      if (L3(license) === 'MSA' || (L3(license) === 'SSA' && years >= 5) || (L2(license) === 'SA' && years >= 10)) return '高成熟';
      if (L3(license) === 'SSA' || (L2(license) === 'SA' && years >= 3) || (license === '服務助理' && years >= 5)) return '中成熟';
      return '發展期';
    }
    if (String(license).indexOf('高級') >= 0 || years >= 10) return '高成熟';
    if (years >= 3) return '中成熟';
    return '發展期';
  }
  function powerBand(power, cfg) {
    if (!nn(power)) return '資料不足';
    if (power >= cfg.thresholds.highPower) return '高戰力';
    if (power >= cfg.thresholds.midPower) return '中戰力';
    return '低戰力';
  }
  function talentType(power, mat, cfg) {
    if (!nn(power) || !mat) return '資料不足';
    const idx = power >= cfg.thresholds.highPower ? 2 : power >= cfg.thresholds.midPower ? 1 : 0;
    return cfg.grid.types[mat][idx];
  }
  function promotion(p, cfg) {
    const t = cfg.thresholds, P = t.promo;
    if (p.status !== '現行' || !nn(p.power)) return '不評估';
    if (p.completeness < t.promoMinCompleteness) return '資料不足／續觀察';
    const pw = p.power, lp = p.prLicense, sv = p.prService, op = p.prOps;
    const ge = (a, b) => nn(a) && a >= b;
    if (p.role === 'SA') {
      if (L3(p.license) === 'MSA') return (pw >= P.seniorCore.power && ge(sv, P.seniorCore.service) && ge(op, P.seniorCore.ops)) ? '高階核心／帶訓候選' : (pw >= P.seniorStable.power ? '高階穩定' : '高階戰力補強');
      if (L3(p.license) === 'SSA') return (pw >= P.candidate.power && ge(lp, P.candidate.licensePR) && ge(sv, P.candidate.service) && ge(op, P.candidate.ops)) ? 'MSA升階候選' : ((pw >= P.near.power && ge(lp, P.near.licensePR)) ? '接近MSA' : '現階深化');
      if (L2(p.license) === 'SA') return (pw >= P.candidate.power && ge(lp, P.candidate.licensePR) && ge(sv, P.candidate.service) && ge(op, P.candidate.ops)) ? 'SSA升階候選' : ((pw >= P.near.power && ge(lp, P.near.licensePR)) ? '接近SSA' : '現階深化');
      return (pw >= P.assistant.power && ge(p.years, P.assistant.years)) ? 'SA培養候選' : '基礎養成';
    }
    if (String(p.license).indexOf('高級') >= 0) return (pw >= P.seniorCore.power && ge(sv, P.seniorCore.service) && ge(op, P.seniorCore.ops)) ? '核心／帶訓候選' : (pw >= P.seniorStable.power ? '高階穩定' : '高階戰力補強');
    return (pw >= P.candidate.power && ge(lp, P.candidate.licensePR) && ge(sv, P.candidate.service) && ge(op, P.candidate.ops)) ? '高級出納候選' : ((pw >= P.near.power && ge(lp, P.near.licensePR)) ? '接近升階標準' : '現階深化');
  }
  function personType(advice, power, cfg) {
    const first = String(advice || '').split('；')[0];
    for (const t of cfg.personTypes) if (first.indexOf(t.match) >= 0) return t.type;
    return '其他/資料不足';
  }

  /* PR：同職務現行人員中，低於者比例（Excel：count(<x)/(n−1)）；越少越好：1 − 該比例 */
  function prOf(x, pool, dir) {
    if (!nn(x)) return null;
    const n = pool.length; if (n <= 1) return null;
    const below = pool.filter((v) => v < x).length / (n - 1);
    return dir < 0 ? 1 - below : below;
  }
  function groupPR(p, pop, keyFn) {
    const k = keyFn(p);
    if (p.status !== '現行' || !nn(p.power) || k == null) return null;
    const g = pop.filter((q) => keyFn(q) === k && nn(q.power)).map((q) => q.power);
    if (g.length <= 1) return null;
    return g.filter((v) => v < p.power).length / (g.length - 1);
  }

  function score(people, role, cfg) {
    const dims = cfg.dimensions[role], W = cfg.weights[role];
    const pop = people.filter((p) => p.status === '現行');
    const pools = {};
    dims.forEach((d) => d.metrics.forEach(([k]) => { pools[k] = pop.map((p) => p[k]).filter(nn); }));
    people.forEach((p) => {
      p.role = role;
      p.tenureGroup = tenureGroup(p.years, cfg);
      p.maturity = maturity(role, p.license, p.years);
      dims.forEach((d) => {
        if (p.status !== '現行') { p[d.prKey] = null; return; }
        p[d.prKey] = mean(d.metrics.map(([k, dir]) => prOf(p[k], pools[k], dir)));
      });
      let ws = 0, acc = 0;
      dims.forEach((d) => { if (nn(p[d.prKey])) { ws += W[d.key]; acc += W[d.key] * p[d.prKey]; } });
      p.power = (p.status === '現行' && ws > 0 && p.completeness >= cfg.thresholds.scoreMinCompleteness) ? acc / ws * 100 : null;
    });
    const scored = pop.filter((p) => nn(p.power));
    people.forEach((p) => {
      p.rank = (p.status === '現行' && nn(p.power)) ? 1 + scored.filter((q) => q.power > p.power).length : null;
      p.prOverall = (p.status === '現行' && nn(p.power) && scored.length > 1) ? scored.filter((q) => q.power < p.power).length / (scored.length - 1) : null;
      p.prLicense = groupPR(p, pop, (q) => q.license || null);
      p.prTenure = groupPR(p, pop, (q) => q.tenureGroup);
      if (p.status === '現行' && nn(p.power)) {
        const g = scored.filter((q) => q.license === p.license).map((q) => q.power);
        p.licenseGap = g.length ? p.power - mean(g) : null;
      } else p.licenseGap = null;
      p.powerBand = powerBand(p.power, cfg);
      p.talentType = talentType(p.power, p.maturity, cfg);
      p.promotion = promotion(p, cfg);
      p.personType = p.status === '現行' ? personType(p.advice, p.power, cfg) : '非現行';
    });
    return people;
  }

  /* ---------------- 建立全部人員（依期間重算） ---------------- */
  const STATIC_KEYS = ['plant', 'name', 'license', 'years', 'status', 'position', 'advice'];
  function buildPeople(model, cfg, months) {
    const out = {};
    [['SA', model.saPeople, model.saMonthly], ['CA', model.caPeople, model.caMonthly]].forEach(([role, base, monthly]) => {
      const byName = {};
      monthly.forEach((r) => { (byName[r.name] = byName[r.name] || []).push(r); });
      const people = base.map((b) => {
        const p = { id: role + ':' + b.name, excel: b };
        STATIC_KEYS.forEach((k) => { p[k] = b[k]; });
        p.monthly = (byName[b.name] || []).slice().sort((a, c) => (a.month < c.month ? -1 : 1));
        Object.assign(p, aggregate(role, p.monthly, months));
        const hist = p.monthly.filter((r) => r.actualPlant && r.actualPlant !== p.plant).map((r) => r.month + ' ' + r.actualPlant);
        p.plantHistory = hist;
        return p;
      });
      out[role] = score(people, role, cfg);
    });
    return out;
  }

  /* ---------------- 3. 異常／管理提醒 ---------------- */
  function personAlerts(p, ctx, cfg) {
    const t = cfg.thresholds, a = [];
    if (p.status !== '現行') return a;
    const add = (key, label, level, detail) => a.push({ key, label, level, detail, person: p });
    const pctx = ctx[p.role];
    if (nn(p.prVolume) && p.prVolume >= t.highVolumePR && nn(p.prService) && p.prService < t.lowQualityPR) add('highVolLowQ', '高量能但低品質', 'red', '量能PR ' + fmtPct(p.prVolume) + '／服務品質PR ' + fmtPct(p.prService));
    if (nn(p.prService) && p.prService >= t.goodQualityPR && nn(p.prVolume) && p.prVolume < t.lowVolumePR) add('goodQLowVol', '品質佳但量能未釋放', 'yellow', '服務品質PR ' + fmtPct(p.prService) + '／量能PR ' + fmtPct(p.prVolume));
    if (p.role === 'SA' && nn(p.perCar) && nn(pctx.avgPerCar) && p.perCar < pctx.avgPerCar * t.lowPerCarRatio) add('lowPerCar', '單車產值偏低', 'yellow', '單車產值 ' + Math.round(p.perCar).toLocaleString() + '（全公司 ' + Math.round(pctx.avgPerCar).toLocaleString() + '）');
    const tv = p.role === 'SA' ? p.trendCars : p.trendOrders;
    if (nn(tv) && tv <= t.trendDrop) add('volDrop', '近3月量能下降', 'red', '近3月' + (p.role === 'SA' ? '接車' : '結帳') + ' ' + fmtPct(tv));
    if (p.role === 'SA' && nn(p.trendRevenue) && p.trendRevenue <= t.trendDrop) add('revDrop', '近3月業績下降', 'red', '近3月業績 ' + fmtPct(p.trendRevenue));
    if (nn(p.trendCsi) && p.trendCsi <= t.csiDrop) add('csiDrop', '近3月CSI下降', 'red', 'CSI變化 ' + p.trendCsi.toFixed(1) + ' 點');
    if (nn(p.prOps) && p.prOps <= t.ngHighPR) add('ngHigh', '作業NG偏高', 'yellow', '作業品質PR ' + fmtPct(p.prOps));
    if (nn(p.licenseGap) && p.licenseGap <= t.licenseGap) add('licGap', '證照戰力落差過大', 'yellow', '低於同證照平均 ' + p.licenseGap.toFixed(1) + ' 分');
    if (nn(p.power) && p.tenureGroup) {
      const g = pctx.tenureAvg[p.tenureGroup];
      if ((p.tenureGroup === '10年以上' || p.tenureGroup === '5–10年') && nn(g) && p.power < g) add('seniorLow', '高年資但戰力低於同年資平均', 'yellow', '戰力 ' + p.power.toFixed(1) + '／同年資平均 ' + g.toFixed(1));
      if ((p.tenureGroup === '<1年' || p.tenureGroup === '1–3年') && nn(p.prOverall) && p.prOverall >= t.topPR) add('juniorTop', '低年資但戰力進入前段', 'green', '同職務PR ' + fmtPct(p.prOverall));
    }
    if (nn(p.completeness) && p.completeness < t.lowCompleteness) add('lowComplete', '資料完整度不足', 'gray', '資料完整度 ' + fmtPct(p.completeness));
    if (p.validMonths < t.minValidMonths) add('fewMonths', '有效月份不足', 'gray', '有效月份 ' + p.validMonths + ' 個月');
    if (p.plantHistory && p.plantHistory.length) add('plantDiff', '歷史廠別與最新廠別不一致', 'blue', '最新 ' + p.plant + '；' + p.plantHistory.slice(0, 3).join('、') + (p.plantHistory.length > 3 ? '…' : ''));
    return a;
  }
  function fmtPct(v) { return nn(v) ? (v * 100).toFixed(1) + '%' : '—'; }

  function roleContext(people, cfg) {
    const ctx = {};
    ['SA', 'CA'].forEach((role) => {
      const cur = (people[role] || []).filter((p) => p.status === '現行');
      const tenureAvg = {};
      cfg.tenureGroups.forEach((g) => { tenureAvg[g.label] = mean(cur.filter((p) => p.tenureGroup === g.label).map((p) => p.power)); });
      const licenseAvg = {};
      Array.from(new Set(cur.map((p) => p.license))).forEach((l) => { licenseAvg[l] = mean(cur.filter((p) => p.license === l).map((p) => p.power)); });
      ctx[role] = { tenureAvg, licenseAvg, avgPerCar: role === 'SA' ? mean(cur.map((p) => p.perCar)) : null, avgPower: mean(cur.map((p) => p.power)) };
    });
    return ctx;
  }

  const api = { aggregate, score, buildPeople, personAlerts, roleContext, tenureGroup, maturity, powerBand, talentType, promotion, mean, nn, sum };
  root.Engine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
