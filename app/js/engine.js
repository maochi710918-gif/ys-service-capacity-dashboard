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

  /* ---------------- 1. 月度 → 個人期間指標（1–9月更新版口徑） ----------------
   * 每人、每項只納入有效資料月份；真正 0 實績保留。                              */
  // 有該欄位資料的最後一個月（如考核至8月）→ 以此為趨勢基準月
  function lastDataMonth(rows, key, months) {
    const ms = months.filter((m) => rows.some((r) => r.month === m && nn(r[key])));
    return ms.length ? ms[ms.length - 1] : null;
  }
  function windows(months, endMonth) {
    const i = months.indexOf(endMonth); if (i < 5) return null;
    return { last: months.slice(i - 2, i + 1), prev: months.slice(i - 5, i - 2) };
  }
  function trendRatio(rows, key, months, allRows) {
    // 近3月趨勢：最後3個月平均 ÷ 前3個月平均 − 1；兩段皆需3個月完整資料
    const w = windows(months, months[months.length - 1]); if (!w) return null;
    const a = vals(rows.filter((r) => w.last.indexOf(r.month) >= 0), key), b = vals(rows.filter((r) => w.prev.indexOf(r.month) >= 0), key);
    if (a.length < 3 || b.length < 3) return null;
    const mb = mean(b); return mb ? mean(a) / mb - 1 : null;
  }
  function trendDiff(rows, key, months, endMonth) {
    // CSI 均值差：以考核最新月為基準，近3月平均 − 前3月平均（如 6–8 比 3–5 月）
    const w = windows(months, endMonth); if (!w) return null;
    // 兩段皆需3個月完整資料
    const av = vals(rows.filter((r) => w.last.indexOf(r.month) >= 0), key), bv = vals(rows.filter((r) => w.prev.indexOf(r.month) >= 0), key);
    if (av.length < 3 || bv.length < 3) return null;
    return mean(av) - mean(bv);
  }
  function cv(rows, key) {
    // 波動度：樣本標準差 ÷ 平均
    const v = vals(rows, key);
    if (v.length < 2) return null;
    const m = mean(v); if (!m) return null;
    return Math.sqrt(sum(v.map((x) => (x - m) * (x - m))) / (v.length - 1)) / m;
  }
  // 任職／實績月數：有任職旗標者採旗標月數；否則（他職等）採有量能實績月份
  function employMonthsOf(rows, role) {
    const flagged = rows.filter((r) => r.employedFlag === 1 || r.employedFlag === '1');
    if (flagged.length) return flagged.length;
    const k = role === 'SA' ? 'cars' : 'orders';
    return rows.filter((r) => nn(r[k])).length;
  }
  function completenessOf(rows, role) {
    const F = CFG.COMPLETENESS_FIELDS[role];
    const active = rows.filter((r) => F.some((f) => nn(r[f])));
    if (!active.length) return { validMonths: 0, completeness: null, employMonths: 0 };
    let c = 0; active.forEach((r) => F.forEach((f) => { if (nn(r[f])) c++; }));
    const em = employMonthsOf(rows, role);
    return { validMonths: active.length, employMonths: em, completeness: em ? Math.min(1, c / (F.length * em)) : null };
  }
  // 比率：分子合計 ÷ 分母合計，只取分子有值之月份
  function ratioOn(rows, num, den, scale) {
    // 分子：全部有值月份合計；分母：只取分子有值月份之分母合計（分母缺值以0計）
    const rs = rows.filter((r) => nn(r[num]));
    if (!rs.length) return null;
    const d = sum(rs.map((r) => (nn(r[den]) ? r[den] : 0))); return d ? sum(rs.map((r) => r[num])) / d * (scale || 1) : null;
  }

  function aggregate(role, rows, months, ctx) {
    rows = rows.filter((r) => months.indexOf(r.month) >= 0);
    ctx = ctx || {};
    const cm = completenessOf(rows, role);
    const o = { validMonths: cm.validMonths, employMonths: cm.employMonths, completeness: cm.completeness };
    const csiEnd = ctx.csiEnd || lastDataMonth(rows, 'csi', months);
    if (role === 'SA') {
      const tc = sumOrNull(rows, 'cars'), tr = sumOrNull(rows, 'revenue');
      o.totalCars = tc == null ? 0 : tc;
      o.totalRevenue = tr == null ? 0 : tr;
      o.avgCars = mean(vals(rows, 'cars'));
      o.avgRevenue = mean(vals(rows, 'revenue'));
      o.perCar = ratioOn(rows, 'revenue', 'cars');                       // 分母只取有業績月份
      const c3 = sumOrNull(rows, 'cars3') || 0, c38 = sumOrNull(rows, 'cars38') || 0, c8 = sumOrNull(rows, 'cars8') || 0;
      o.cars3 = c3; o.cars38 = c38; o.cars8 = c8; o.carsAgeMissing = tc ? tc - c3 - c38 - c8 : 0;
      o.age3 = tc ? c3 / tc : null; o.age38 = tc ? c38 / tc : null; o.age8 = tc ? c8 / tc : null;
      o.ageComplete = tc ? (c3 + c38 + c8) / tc : null;
      const hasAppCnt = rows.some((r) => nn(r.appCount) && nn(r.appBase) && r.appBase > 0);
      o.app = hasAppCnt ? ratioOn(rows.filter((r) => r.appBase > 0), 'appCount', 'appBase') : mean(vals(rows, 'app')); // 同來源加權
      ['a1', 'a2', 'bodyPaint', 'csi', 'csiFirst', 'esSelf', 'esRedesignate'].forEach((k) => { o[k] = mean(vals(rows, k)); });
      o.ngFee = sumOrNull(rows, 'ngFee') || 0; o.ngTime = sumOrNull(rows, 'ngTime') || 0; o.keyUnlock = sumOrNull(rows, 'keyUnlock') || 0;
      o.ngFeePer100 = ratioOn(rows, 'ngFee', 'cars', 100);               // 分母只取有該項NG成績月份
      o.ngTimePer100 = ratioOn(rows, 'ngTime', 'cars', 100);
      o.keyPer100 = ratioOn(rows, 'keyUnlock', 'cars', 100);
      o.trendCars = trendRatio(rows, 'cars', months);
      o.trendRevenue = trendRatio(rows, 'revenue', months);
      o.trendCsi = trendDiff(rows, 'csi', months, csiEnd);
      o.volatility = cv(rows, 'cars');
      o.capRateExcel = ratioOn(rows.filter((r) => nn(r.capRate) && r.workdays > 0), 'cars', 'workdays');
    } else {
      const to = sumOrNull(rows, 'orders');
      o.totalOrders = to == null ? 0 : to;
      o.avgOrders = mean(vals(rows, 'orders'));
      ['esign', 'card', 'csi', 'csiFirst', 'esSelf', 'plantCsiSample'].forEach((k) => { o[k] = mean(vals(rows, k)); });
      o.ngFee = sumOrNull(rows, 'ngFee') || 0; o.keyUnlock = sumOrNull(rows, 'keyUnlock') || 0;
      o.ngFeePer100 = ratioOn(rows, 'ngFee', 'orders', 100);
      o.keyPer100 = ratioOn(rows, 'keyUnlock', 'orders', 100);
      o.trendOrders = trendRatio(rows, 'orders', months);
      o.trendCsi = trendDiff(rows, 'csi', months, csiEnd);
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
    if (!nn(power) || !mat) return cfg.labels && cfg.labels.noReview || '資料不足';
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
  function personType(talent, cfg) {
    for (const g of cfg.personGroups) if (g.talents.indexOf(talent) >= 0) return g.type;
    return '加速培育／資料不足';
  }

  /* PR：同職務現行人員中，低於者比例（Excel：count(<x)/(n−1)）；越少越好：1 − 該比例 */
  function prOf(x, pool, dir) {
    if (!nn(x)) return null;
    const n = pool.length; if (n <= 1) return null;
    // 越高越好：低於本人比例；越少越好：高於本人比例（同值不互相加分，1–9月版 Excel 口徑）
    return dir < 0 ? pool.filter((v) => v > x).length / (n - 1) : pool.filter((v) => v < x).length / (n - 1);
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
      // 1–9月版口徑：各構面皆可計算才計分（requireAllDims）；舊版可改為缺構面時依有值權重重配
      const allDims = dims.every((d) => nn(p[d.prKey]));
      const okDims = cfg.thresholds.requireAllDims ? allDims : ws > 0;
      p.power = (p.status === '現行' && okDims && p.completeness >= cfg.thresholds.scoreMinCompleteness) ? acc / ws * 100 : null;
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
      p.personType = p.status === '現行' ? personType(p.talentType, cfg) : '非現行';
      p.coach = p.status === '現行' && cfg.personGroups.some((g) => g.coach && g.talents.indexOf(p.talentType) >= 0);
      p.highVolNeed = p.status === '現行' && nn(p.prVolume) && p.prVolume >= cfg.thresholds.highVolumePR && !(nn(p.prService) && p.prService >= cfg.thresholds.highVolNeedQualityPR);
    });
    return people;
  }

  /* 接車量能達成率＝接車台數 ÷（工作日 × 標準台數／日）；任一有接車月份缺工作日 → null */
  function capacityRate(rows, months, cfg) {
    // 工作日：優先採 Excel 月度「廠工作天數」，其次設定頁填入值；只計有工作日之月份
    const cap = cfg.capacity || {}, wd = cap.workdays || {};
    const day = (r) => (r.workdays > 0 ? r.workdays : wd[r.month] > 0 ? wd[r.month] : null);
    const rs = rows.filter((r) => months.indexOf(r.month) >= 0 && nn(r.cars) && day(r));
    if (!rs.length || !cap.perDay) return null;
    const std = sum(rs.map((r) => day(r) * cap.perDay));
    return std ? sum(rs.map((r) => r.cars)) / std : null;
  }

  /* ---------------- 建立全部人員（依期間重算） ---------------- */
  const STATIC_KEYS = ['plant', 'name', 'license', 'years', 'status', 'position', 'advice'];
  function buildPeople(model, cfg, months) {
    const out = {};
    [['SA', model.saPeople, model.saMonthly], ['CA', model.caPeople, model.caMonthly]].forEach(([role, base, monthly]) => {
      const byName = {};
      monthly.forEach((r) => { (byName[r.name] = byName[r.name] || []).push(r); });
      const csiEnd = lastDataMonth(monthly, 'csi', months);
      const people = base.map((b) => {
        const p = { id: role + ':' + b.name, excel: b };
        STATIC_KEYS.forEach((k) => { p[k] = b[k]; });
        p.monthly = (byName[b.name] || []).slice().sort((a, c) => (a.month < c.month ? -1 : 1));
        Object.assign(p, aggregate(role, p.monthly, months, { csiEnd }));
        if (role === 'SA') { p.capacityRate = capacityRate(p.monthly, months, cfg); p.capacityMonths = p.monthly.filter((r) => months.indexOf(r.month) >= 0 && nn(r.cars) && (r.workdays > 0 || (cfg.capacity.workdays || {})[r.month] > 0)).map((r) => r.month); }
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
