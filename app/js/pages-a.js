/* =========================================================================
 * 頁面 A：共用頁面工具、管理總覽、服務廠比較、服專分析、出納分析
 * ========================================================================= */
(function (root) {
  const { Store, UI, Engine, APP_CONFIG } = root; const S = Store.S;
  const { F, esc, nn, kpi, table, chart, card, C } = UI; const mean = Engine.mean, sum = Engine.sum;
  const Pages = root.Pages = root.Pages || {};

  /* ======================= 共用工具 PX ======================= */
  const PCT = ['age3', 'age38', 'age8', 'ageComplete', 'app', 'a1', 'a2', 'bodyPaint', 'esRedesignate', 'trendCars', 'trendRevenue', 'trendOrders', 'completeness', 'volatility', 'esign', 'plantCsiSample'];
  const MONEY = ['totalRevenue', 'avgRevenue', 'perCar', 'revenue'];
  const INT = ['totalCars', 'totalOrders', 'ngFee', 'ngTime', 'keyUnlock', 'validMonths', 'rank', 'cars', 'orders', 'cars3', 'cars38', 'cars8'];
  const CSI = ['csi', 'csiFirst', 'esSelf'];
  const PCT0 = ['completeness', 'ageComplete'], PCT2 = ['app', 'a1', 'a2', 'bodyPaint', 'capacityRate'];
  function fmtOf(k) {
    if (PCT0.indexOf(k) >= 0) return F.pct0;
    if (PCT2.indexOf(k) >= 0) return F.pct2;
    if (PCT.indexOf(k) >= 0) return F.pct;
    if (MONEY.indexOf(k) >= 0) return F.money;
    if (INT.indexOf(k) >= 0) return F.int;
    if (CSI.indexOf(k) >= 0) return F.csi;
    if (k.indexOf('pr') === 0) return F.pr;
    if (k === 'power') return F.score;
    if (k === 'licenseGap' || k === 'trendCsi') return F.signed1;
    if (/Per100$/.test(k)) return F.d2;
    if (k === 'avgCars' || k === 'avgOrders') return F.int;
    if (k === 'years') return F.d1;
    if (k === 'card') return F.d2;
    return F.text;
  }
  const isNum = (k) => fmtOf(k) !== F.text;
  const LABELS = {};
  ['服專總覽', '出納總覽'].forEach((sh) => { const m = APP_CONFIG.FIELD_MAP[sh].cols; Object.keys(m).forEach((h) => { LABELS[(sh === '服專總覽' ? 'SA' : 'CA') + ':' + m[h]] = h.replace(/\n/g, ''); }); });
  const label = (role, k) => LABELS[role + ':' + k] || k;
  const roleName = (r) => r === 'SA' ? '服專' : '出納';
  const roleOn = (r) => S.role === 'all' || S.role === r;
  const current = (list) => list.filter((p) => p.status === '現行');

  function colorCell(k, v) {
    if (!nn(v)) return '';
    if (k.indexOf('pr') === 0) return v >= 0.75 ? 'cell-good' : v < 0.25 ? 'cell-bad' : '';
    if (k === 'power') return v >= S.cfg.thresholds.highPower ? 'cell-good' : v < S.cfg.thresholds.midPower ? 'cell-bad' : '';
    if (k === 'licenseGap' || k === 'trendCsi' || k === 'trendCars' || k === 'trendOrders' || k === 'trendRevenue') return v > 0 ? 'cell-good' : v < 0 ? 'cell-bad' : '';
    if (k === 'completeness') return v < S.cfg.thresholds.lowCompleteness ? 'cell-warn' : '';
    return '';
  }
  const TALENT_COLOR = { '核心／帶訓': 'green', '升階候選': 'green', '高潛力新星': 'green', '資深穩定': 'blue', '穩定成長': 'blue', '加速培育': 'blue', '資深戰力落差': 'yellow', '重點輔導': 'red', '基礎養成': 'gray', '資料不足': 'gray' };
  const promoColor = (v) => /候選/.test(v) ? 'green' : /接近|高階穩定/.test(v) ? 'blue' : /補強/.test(v) ? 'yellow' : /不評估|資料不足/.test(v) ? 'gray' : '';

  /** 依 Excel 總覽欄位順序產生完整明細欄位 */
  function personColumns(role, opts) {
    opts = opts || {};
    const map = APP_CONFIG.FIELD_MAP[role === 'SA' ? '服專總覽' : '出納總覽'].cols;
    const keys = Object.values(map);
    return keys.map((k) => {
      const c = { key: k, label: label(role, k), num: isNum(k), fmt: fmtOf(k), cls: (r, v) => colorCell(k, v) };
      if (k === 'name') { c.sticky = true; c.html = (r) => UI.nameLink(r); }
      if (k === 'talentType') c.html = (r, v) => UI.pill(v, TALENT_COLOR[v]);
      if (k === 'promotion') c.html = (r, v) => UI.pill(v, promoColor(v));
      if (k === 'advice') c.wrap = true;
      if (k === 'years') c.fmt = F.d1;
      return c;
    }).concat(opts.extra || []);
  }

  /** 連續下降（最近 n 個有值月份，逐月遞減） */
  function consecutiveDecline(rows, key, n) {
    const v = rows.filter((r) => nn(r[key])).sort((a, b) => (a.month < b.month ? -1 : 1)).slice(-(n || 3)).map((r) => r[key]);
    if (v.length < (n || 3)) return false;
    for (let i = 1; i < v.length; i++) if (!(v[i] < v[i - 1])) return false;
    return true;
  }

  /** 全公司（不受篩選）資料 */
  function company(D) {
    const ms = D.months;
    return {
      people: D.P,
      monthly: { SA: S.model.saMonthly.filter((r) => ms.indexOf(r.month) >= 0), CA: S.model.caMonthly.filter((r) => ms.indexOf(r.month) >= 0) }
    };
  }

  /** 管理提醒 / 異常 */
  function buildAlerts(D) {
    const T = S.cfg.thresholds;
    const roles = ['SA', 'CA'].filter(roleOn);
    const list = [];
    roles.forEach((role) => current(D.people[role]).forEach((p) => {
      Engine.personAlerts(p, D.ctx, S.cfg).forEach((a) => list.push(a));
      const rowsIn = p.monthly.filter((r) => D.months.indexOf(r.month) >= 0);
      if (consecutiveDecline(rowsIn, 'csi', 3)) list.push({ key: 'csiConsec', label: 'CSI連續下降', level: 'red', detail: '最近3個有值月份CSI逐月下降', person: p });
      if (consecutiveDecline(rowsIn, role === 'SA' ? 'cars' : 'orders', 3)) list.push({ key: 'volConsec', label: role === 'SA' ? '接車量連續下降' : '結帳量連續下降', level: 'red', detail: '最近3個月逐月下降', person: p });
    }));
    return list;
  }
  function plantShortage(D) { return Store.plantStats(D).rows.filter((r) => /出納0人|負荷偏高/.test(r.note)); }

  function kpiMonthly(D, role, fn) {
    // 本期＝期間最後一月；上期＝前一月（月度明細）
    const ms = D.months; const last = ms[ms.length - 1];
    const allMs = Store.allMonths(); const prevM = allMs[allMs.indexOf(last) - 1];
    const rowsM = (m) => (m ? D.monthlyAllMonths[role].filter((r) => r.month === m) : []);
    return { cur: last ? fn(rowsM(last)) : null, prev: prevM ? fn(rowsM(prevM)) : null, curLabel: last ? last.slice(5) + '月' : '本期', prevLabel: prevM ? prevM.slice(5) + '月' : '上期' };
  }
  const colSum = (rows, k) => { const v = rows.map((r) => r[k]).filter(nn); return v.length ? sum(v) : null; };
  const colMean = (rows, k) => mean(rows.map((r) => r[k]));
  const activeCount = (rows, k) => { const s = new Set(); rows.forEach((r) => { if (nn(r[k]) && r[k] > 0 && r.status === '現行') s.add(r.name); }); return s.size; };

  function bindCharts(el) { return (sel) => el.querySelector(sel); }
  function wireExport(el, id, name, t) { UI.bindExport(el, id, name, () => t); }

  root.PX = { fmtOf, label, roleName, roleOn, current, personColumns, consecutiveDecline, company, buildAlerts, plantShortage, kpiMonthly, colSum, colMean, activeCount, TALENT_COLOR, promoColor, colorCell, wireExport };

  /* ======================= 1. 管理總覽 ======================= */
  Pages.overview = function (el, D) {
    const T = S.cfg.thresholds, CO = company(D);
    const sa = current(D.people.SA), ca = current(D.people.CA);
    const coSa = current(CO.people.SA), coCa = current(CO.people.CA);
    const plants = Store.plantStats(D);
    const coPlants = Store.plantStats(Object.assign({}, D, { people: CO.people, pfa: false }), { all: true });
    const prev = D.Pprev ? { SA: current(D.Pprev.SA.filter((p) => Store.personPass(p))), CA: current(D.Pprev.CA.filter((p) => Store.personPass(p))) } : null;
    const snapLbl = { curLabel: '截至' + D.months[D.months.length - 1].slice(5) + '月', prevLabel: D.prevMonths.length ? '截至' + D.prevMonths[D.prevMonths.length - 1].slice(5) + '月' : '上期' };
    const hi = (l) => l.filter((p) => nn(p.power) && p.power >= T.highPower).length;
    const coach = (l) => l.filter((p) => p.personType === '優先輔導').length;
    const cars = colSum(D.monthly.SA, 'cars'), rev = colSum(D.monthly.SA, 'revenue'), ord = colSum(D.monthly.CA, 'orders');
    const coCars = colSum(CO.monthly.SA, 'cars'), coRev = colSum(CO.monthly.SA, 'revenue'), coOrd = colSum(CO.monthly.CA, 'orders');
    const saN = sum(plants.rows.map((r) => r.saCount)), caN = sum(plants.rows.map((r) => r.caCount));
    const zeroCa = plants.rows.filter((r) => r.saCount > 0 && r.caCount === 0);
    const comp = (l) => mean(l.map((p) => p.completeness));
    const roles = ['SA', 'CA'].filter(roleOn);
    const scopeCur = roles.flatMap((r) => current(D.people[r]));
    const cards = [];
    const push = (role, o) => { if (!role || roleOn(role)) cards.push(kpi(o)); };
    const mCnt = (role, key) => kpiMonthly(D, role, (rows) => activeCount(rows, key));
    push('SA', Object.assign({ label: '現行服專人數', value: saN, unit: '人', company: sum(coPlants.rows.map((r) => r.saCount)), companyLabel: '全公司', hint: '依115.9最新名冊；本期／上期為當月有接車之現行服專數', light: 'blue' }, mCnt('SA', 'cars')));
    push('CA', Object.assign({ label: '現行出納人數', value: caN, unit: '人', company: sum(coPlants.rows.map((r) => r.caCount)), companyLabel: '全公司', hint: '依115.9最新名冊（含無個人資料之名冊人員）；本期／上期為當月有結帳之現行出納數', light: 'blue' }, mCnt('CA', 'orders')));
    push('SA', Object.assign({ label: '累積接車台數', value: cars, unit: '台', company: coCars }, kpiMonthly(D, 'SA', (r) => colSum(r, 'cars'))));
    push('SA', Object.assign({ label: '累積服專業績', value: rev, fmt: F.money, unit: '元', company: coRev }, kpiMonthly(D, 'SA', (r) => colSum(r, 'revenue'))));
    push('CA', Object.assign({ label: '累積結帳工單', value: ord, unit: '張', company: coOrd }, kpiMonthly(D, 'CA', (r) => colSum(r, 'orders'))));
    push('SA', Object.assign({ label: '服專平均單車產值', value: cars ? rev / cars : null, fmt: F.money, unit: '元', company: coCars ? coRev / coCars : null, hint: '期間業績合計 ÷ 接車台數合計' }, kpiMonthly(D, 'SA', (r) => { const c = colSum(r, 'cars'); return c ? colSum(r, 'revenue') / c : null; })));
    push('SA', Object.assign({ label: '服專平均綜合戰力', value: mean(sa.map((p) => p.power)), fmt: F.score, unit: '分', cur: mean(sa.map((p) => p.power)), prev: prev ? mean(prev.SA.map((p) => p.power)) : null, company: mean(coSa.map((p) => p.power)), hint: '管理診斷指標，非正式考核分數；上期＝截至前一月重算' }, snapLbl));
    push('CA', Object.assign({ label: '出納平均綜合戰力', value: mean(ca.map((p) => p.power)), fmt: F.score, unit: '分', cur: mean(ca.map((p) => p.power)), prev: prev ? mean(prev.CA.map((p) => p.power)) : null, company: mean(coCa.map((p) => p.power)) }, snapLbl));
    push('SA', Object.assign({ label: '服專高戰力人數', value: hi(sa), unit: '人', cur: hi(sa), prev: prev ? hi(prev.SA) : null, company: hi(coSa), hint: '綜合戰力 ≥ ' + T.highPower }, snapLbl));
    push('CA', Object.assign({ label: '出納高戰力人數', value: hi(ca), unit: '人', cur: hi(ca), prev: prev ? hi(prev.CA) : null, company: hi(coCa) }, snapLbl));
    push('SA', Object.assign({ label: '服專優先輔導人數', value: coach(sa), unit: '人', cur: coach(sa), prev: prev ? coach(prev.SA) : null, company: coach(coSa), goodDir: -1, hint: '依 Excel 管理總覽「人員類型＝優先輔導」', light: coach(sa) ? 'yellow' : 'green' }, snapLbl));
    push('CA', Object.assign({ label: '出納優先輔導人數', value: coach(ca), unit: '人', cur: coach(ca), prev: prev ? coach(prev.CA) : null, company: coach(coCa), goodDir: -1, light: coach(ca) ? 'yellow' : 'green' }, snapLbl));
    push('CA', { label: '出納0人據點數', value: zeroCa.length, unit: '處', cur: zeroCa.length, curLabel: '115.9名冊', prev: null, company: coPlants.rows.filter((r) => r.saCount > 0 && r.caCount === 0).length, goodDir: -1, light: zeroCa.length ? 'red' : 'green', hint: zeroCa.map((r) => r.plant).join('、') });
    const lastM = D.months[D.months.length - 1];
    const compMonth = (m) => { if (!m) return null; let c = 0, n = 0; roles.forEach((r) => { const Fd = APP_CONFIG.COMPLETENESS_FIELDS[r]; D.monthlyAllMonths[r].filter((x) => x.month === m && x.status === '現行').forEach((x) => { Fd.forEach((f) => { n++; if (nn(x[f])) c++; }); }); }); return n ? c / n : null; };
    const pm = Store.allMonths()[Store.allMonths().indexOf(lastM) - 1];
    const cv = comp(scopeCur);
    push(null, { label: '資料完整度', value: cv, fmt: F.pct0, cur: compMonth(lastM), prev: compMonth(pm), curLabel: lastM.slice(5) + '月欄位', prevLabel: pm ? pm.slice(5) + '月欄位' : '上期', company: comp(roles.flatMap((r) => current(CO.people[r]))), light: !nn(cv) ? 'gray' : cv >= T.completenessGreen ? 'green' : cv >= T.completenessYellow ? 'yellow' : 'red', hint: '現行人員有值欄位 ÷ 應有欄位（僅計有效月份）' });

    const q = Store.qualityItems();
    const qImp = q.filter((x) => x.level === '重要').length, qRem = q.filter((x) => x.level === '提醒').length;
    const alerts = buildAlerts(D);
    const byKey = (k) => alerts.filter((a) => a.key === k);
    const shortage = plantShortage(D);
    const missItems = q.filter((x) => x.id.indexOf('sys-miss') === 0);
    const plantDiffChecks = q.filter((x) => /廠別不一致|實際廠別/.test(x.item));
    const AL = [
      { t: '人力配置不足據點', n: shortage.length, d: shortage.map((r) => r.plant + '：' + r.note).join('；') || '無', lv: 'red', plants: shortage },
      { t: '高量但品質偏低', n: byKey('highVolLowQ').length, k: 'highVolLowQ', lv: 'red', d: '量能PR≥' + T.highVolumePR * 100 + '、服務品質PR<' + T.lowQualityPR * 100 },
      { t: '品質佳但量能未釋放', n: byKey('goodQLowVol').length, k: 'goodQLowVol', lv: 'yellow', d: '服務品質PR≥' + T.goodQualityPR * 100 + '、量能PR<' + T.lowVolumePR * 100 },
      { t: '單車產值偏低', n: byKey('lowPerCar').length, k: 'lowPerCar', lv: 'yellow', d: '低於全公司平均 ×' + T.lowPerCarRatio },
      { t: 'CSI連續下降', n: byKey('csiConsec').length, k: 'csiConsec', lv: 'red', d: '最近3個有值月份逐月下降' },
      { t: '接車量或結帳量連續下降', n: byKey('volConsec').length, k: 'volConsec', lv: 'red', d: '最近3個月逐月下降' },
      { t: '證照與戰力落差過大', n: byKey('licGap').length, k: 'licGap', lv: 'yellow', d: '低於同證照平均 ' + T.licenseGap + ' 分以上' },
      { t: '資料完整度不足', n: byKey('lowComplete').length, k: 'lowComplete', lv: 'gray', d: '完整度 <' + T.lowCompleteness * 100 + '%（非績效不佳）' },
      { t: '本期資料缺漏', n: missItems.length, lv: 'gray', d: missItems.map((x) => x.item).join('；') || '無', go: 'quality' },
      { t: '廠別來源不一致', n: plantDiffChecks.length, lv: 'blue', d: '資料檢核與月度實際廠別差異', go: 'quality' }
    ];

    el.innerHTML = '<div class="page-head"><div><h1>服專／出納服務量能與人才戰情總覽</h1><p>' + esc(S.model.meta.note || '') + '</p></div></div>' +
      (qImp + qRem ? '<div class="banner warn"><b>資料品質提醒</b><span>重要 ' + qImp + ' 項、提醒 ' + qRem + ' 項。' + esc((q.find((x) => /8月考核/.test(x.item)) || {}).handling || '') + ' 缺漏資料不視為績效不佳。<a href="#/quality">查看資料品質 →</a></span></div>' : '') +
      '<div class="kpis">' + cards.join('') + '</div>' +
      '<div class="section-title">月度整體推移</div>' +
      card('每月量能與流程指標', '<div class="chips-sel" id="trendSel"></div><div class="chart tall" id="trendChart"></div>', { sub: '依當月實際廠別彙整；' + Store.monthLabel(D.months), tools: '' }) +
      '<div class="section-title">管理提醒</div><div class="alerts" id="alerts">' +
      AL.map((a, i) => '<div class="alert ' + (a.n ? '' : 'zero') + '" data-i="' + i + '"><div class="a-n" style="color:var(--' + (a.lv === 'red' ? 'bad' : a.lv === 'yellow' ? 'warn' : a.lv === 'blue' ? 'info' : 'muted') + ')">' + a.n + '</div><div><div class="a-t">' + esc(a.t) + '</div><div class="a-d">' + esc(a.d) + '</div></div></div>').join('') + '</div>' +
      '<div class="section-title">人員類型分布（依 Excel 管理總覽口徑）</div><div class="grid g2">' +
      card('人員類型', '<div class="chart short" id="ptChart"></div>') +
      card('人才九宮格摘要', '<div class="chart short" id="ttChart"></div>', { tools: '<a class="btn sm" href="#/grid">前往九宮格 →</a>' }) + '</div>';

    // 趨勢圖
    const series = Store.monthlySeries(D.monthly, D.months, S.filters.gran);
    const MET = [
      { k: 'cars', n: '接車台數', role: 'SA', type: 'bar', ax: 0 }, { k: 'orders', n: '結帳工單', role: 'CA', type: 'bar', ax: 0 },
      { k: 'revenue', n: '服專業績(萬)', role: 'SA', type: 'line', ax: 1, tf: (v) => nn(v) ? v / 10000 : null },
      { k: 'app', n: 'APP預約指定率', role: 'SA', type: 'line', ax: 2, tf: (v) => nn(v) ? v * 100 : null }, { k: 'esign', n: '電子簽名率', role: 'CA', type: 'line', ax: 2, tf: (v) => nn(v) ? v * 100 : null }
    ].filter((m) => roleOn(m.role));
    const on = new Set(MET.map((m) => m.k));
    const selEl = el.querySelector('#trendSel');
    const drawTrend = () => {
      selEl.innerHTML = MET.map((m) => '<button data-k="' + m.k + '" class="' + (on.has(m.k) ? 'on' : '') + '">' + m.n + '</button>').join('');
      selEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { on.has(b.dataset.k) ? on.delete(b.dataset.k) : on.add(b.dataset.k); drawTrend(); }));
      const act = MET.filter((m) => on.has(m.k));
      chart(el.querySelector('#trendChart'), {
        color: [C.navy, C.gray, C.red, C.blue, C.teal],
        grid: { right: 110 },
        tooltip: { trigger: 'axis', valueFormatter: (v) => nn(v) ? Number(v).toLocaleString('zh-TW', { maximumFractionDigits: 1 }) : '—' },
        legend: { data: act.map((m) => m.n) },
        xAxis: { type: 'category', data: series.map((s) => s.key) },
        yAxis: [{ type: 'value', name: '台／張', axisLabel: { formatter: (v) => v.toLocaleString() } }, { type: 'value', name: '萬元', splitLine: { show: false }, position: 'right' }, { type: 'value', name: '%', max: 100, min: 0, splitLine: { show: false }, position: 'right', offset: 56 }],
        series: act.map((m) => ({ name: m.n, type: m.type, yAxisIndex: m.ax, barMaxWidth: 26, smooth: false, symbolSize: 6, data: series.map((s) => m.tf ? m.tf(s[m.k]) : s[m.k]), label: m.type === 'bar' && series.length <= 8 ? { show: false } : undefined }))
      });
    };
    drawTrend();

    el.querySelectorAll('#alerts .alert').forEach((a) => a.addEventListener('click', () => {
      const x = AL[Number(a.dataset.i)];
      if (x.go) return root.App.go(x.go);
      if (x.plants) return UI.modal(x.t, x.plants.length ? '<table class="tbl"><thead><tr><th>服務廠</th><th class="num">現行服專</th><th class="num">現行出納</th><th>配置提醒</th></tr></thead><tbody>' + x.plants.map((r) => '<tr><td>' + esc(r.plant) + '</td><td class="num">' + r.saCount + '</td><td class="num">' + r.caCount + '</td><td>' + esc(r.note) + '</td></tr>').join('') + '</tbody></table>' : '<div class="empty">無</div>');
      showAlertList(x.t, byKey(x.k));
    }));

    // 人員類型
    const types = ['核心穩定', '量質平衡', '高量需改善', '品質佳／量能未釋放', '優先輔導', '其他/資料不足'];
    const cnt = (l, t) => l.filter((p) => p.personType === t).length + (t === '其他/資料不足' && l === ca && !D.pfa ? Math.max(0, caN - ca.length) : 0);
    chart(el.querySelector('#ptChart'), {
      color: [C.navy, C.red], tooltip: { trigger: 'axis' }, legend: { data: ['服專', '出納'].filter((r, i) => roleOn(['SA', 'CA'][i])) }, grid: { left: 118, right: 20, top: 28, bottom: 20 },
      xAxis: { type: 'value', minInterval: 1 }, yAxis: { type: 'category', data: types.slice().reverse() },
      series: [roleOn('SA') ? { name: '服專', type: 'bar', data: types.slice().reverse().map((t) => cnt(sa, t)), label: { show: true, position: 'right' }, barMaxWidth: 14 } : null, roleOn('CA') ? { name: '出納', type: 'bar', data: types.slice().reverse().map((t) => cnt(ca, t)), label: { show: true, position: 'right' }, barMaxWidth: 14 } : null].filter(Boolean)
    });
    const tt = S.cfg.grid.maturities.flatMap((m) => S.cfg.grid.types[m]);
    chart(el.querySelector('#ttChart'), {
      color: [C.navy, C.red], tooltip: { trigger: 'axis' }, legend: { data: ['服專', '出納'].filter((r, i) => roleOn(['SA', 'CA'][i])) }, grid: { left: 40, right: 16, top: 28, bottom: 58 },
      xAxis: { type: 'category', data: tt, axisLabel: { rotate: 35, fontSize: 10.5 } }, yAxis: { type: 'value', minInterval: 1 },
      series: [roleOn('SA') ? { name: '服專', type: 'bar', data: tt.map((t) => sa.filter((p) => p.talentType === t).length), barMaxWidth: 14 } : null, roleOn('CA') ? { name: '出納', type: 'bar', data: tt.map((t) => ca.filter((p) => p.talentType === t).length), barMaxWidth: 14 } : null].filter(Boolean)
    });
  };

  function showAlertList(title, list) {
    const cols = [
      { key: 'plant', label: '廠別', get: (a) => a.person.plant }, { key: 'name', label: '姓名', get: (a) => a.person.name, html: (a) => UI.nameLink(a.person) },
      { key: 'role', label: '角色', get: (a) => roleName(a.person.role) }, { key: 'license', label: '證照', get: (a) => a.person.license },
      { key: 'power', label: '綜合戰力', num: true, fmt: F.score, get: (a) => a.person.power }, { key: 'detail', label: '判斷依據', get: (a) => a.detail }
    ];
    UI.modal(title + '（' + list.length + '人）', '<div class="card-h" style="padding:0 0 8px;border:0"><div class="tools">' + UI.exportBtns('al') + '</div></div><div id="alTbl"></div>', (b) => {
      const t = table(b.querySelector('#alTbl'), { columns: cols, rows: list, sortKey: 'power', sortDir: 1, short: true });
      UI.bindExport(b, 'al', title, () => t);
    });
  }
  root.PX.showAlertList = showAlertList;

  /* ======================= 2. 服務廠比較 ======================= */
  Pages.plants = function (el, D) {
    const ps = Store.plantStats(D); const rows = ps.rows, avg = ps.avg;
    const showSA = roleOn('SA'), showCA = roleOn('CA');
    const diffCls = (k, dir) => (r, v) => { if (!nn(v) || !nn(avg[k]) || r === avg) return ''; const d = (v - avg[k]) * (dir || 1); return d > 0 ? 'cell-good' : d < 0 ? 'cell-bad' : ''; };
    const withDiff = (k, fmt, dir) => (r, v) => { const base = fmt(v); if (r === avg || !nn(v) || !nn(avg[k]) || !avg[k]) return base; const p = (v - avg[k]) / Math.abs(avg[k]); return base + ' <small class="' + ((p * (dir || 1)) >= 0 ? 'up' : 'down') + '">' + (p >= 0 ? '+' : '') + (p * 100).toFixed(0) + '%</small>'; };
    const col = (k, l, fmt, role, dir) => ({ key: k, label: l, num: true, fmt, role, html: withDiff(k, fmt, dir), cls: diffCls(k, dir) });
    let cols = [
      { key: 'rank', label: '排名', num: true, get: (r) => r === avg ? null : r._rank },
      { key: 'light', label: '燈號', html: (r) => r === avg ? '' : UI.dot(r.light), sortVal: (r) => ({ red: 0, yellow: 1, green: 2 })[r.light] },
      { key: 'plant', label: '服務廠', sticky: true, html: (r) => r === avg ? '<b>全公司平均</b>' : '<span class="name-link" data-plant="' + esc(r.plant) + '">' + esc(r.plant) + '</span>' },
      col('saCount', '現行服專人數', F.int, 'SA'), col('caCount', '現行出納人數', F.int, 'CA'),
      col('saAvgCars', '服專月均接車台數', F.int, 'SA'), col('capacityRate', '廠別量能達成', F.pct2, 'SA'), col('saAvgRevenue', '服專月均業績', F.money, 'SA'), col('saPerCar', '服專單車產值', F.money, 'SA'),
      col('app', 'APP預約指定率', F.pct2, 'SA'), col('saCsi', '服專CSI', F.csi, 'SA'), col('saPower', '服專平均綜合戰力', F.score, 'SA'),
      col('caAvgOrders', '出納月均結帳工單', F.int, 'CA'), col('esign', '電子簽名率', F.pct, 'CA'), col('caCsi', '出納CSI', F.csi, 'CA'), col('caPower', '出納平均綜合戰力', F.score, 'CA'),
      col('high', '高戰力人數', F.int), col('coach', '優先輔導人數', F.int, null, -1),
      { key: 'note', label: '配置提醒', html: (r) => r === avg ? '' : (r.note ? UI.pill(r.note, r.light === 'red' ? 'red' : 'yellow') : UI.pill('正常', 'green')) }
    ].filter((c) => !c.role || roleOn(c.role));
    // 排名依綜合戰力（依角色）
    const rk = S.role === 'CA' ? 'caPower' : 'saPower';
    rows.slice().filter((r) => nn(r[rk])).sort((a, b) => b[rk] - a[rk]).forEach((r, i) => { r._rank = i + 1; });
    el.innerHTML = '<div class="page-head"><div><h1>服務廠比較</h1><p>人力數依115.9最新名冊；量能為目前現行人員之期間個人平均（' + Store.monthLabel(D.months) + '）。排名依' + (rk === 'saPower' ? '服專' : '出納') + '平均綜合戰力；欄內百分比為與全公司平均差距。</p></div></div>' +
      card('各廠服務量能比較表', '<div id="pTbl"></div>', { tools: UI.exportBtns('pt'), flush: true }) +
      '<div id="drill"></div>' +
      '<div class="section-title">服務廠圖表</div><div class="grid g2">' +
      (showSA ? card('服專人數 × 月均接車量', '<div class="chart" id="c1"></div>') : '') +
      (showCA ? card('出納人數 × 月均結帳量', '<div class="chart" id="c2"></div>') : '') +
      (showSA ? card('各廠服專平均戰力', '<div class="chart" id="c3"></div>', { sub: '虛線＝全公司平均' }) : '') +
      (showCA ? card('各廠出納平均戰力', '<div class="chart" id="c4"></div>', { sub: '虛線＝全公司平均' }) : '') +
      (showSA ? card('單車產值 × 服專CSI 四象限', '<div class="chart" id="c5"></div>', { sub: '十字線＝全公司平均' }) : '') +
      card('人力數 × 個人平均量能', '<div class="chart" id="c6"></div>', { sub: showSA ? '服專：人數 vs 月均接車' : '出納：人數 vs 月均結帳' }) + '</div>';
    const t = table(el.querySelector('#pTbl'), { columns: cols, rows, avgRow: avg, sortKey: 'rank', sortDir: 1, onRow: (r) => drill(r) });
    UI.bindExport(el, 'pt', '服務廠比較', t);
    el.querySelector('#pTbl').addEventListener('click', (e) => { const a = e.target.closest('[data-plant]'); if (a) { e.stopPropagation(); drill(rows.find((r) => r.plant === a.dataset.plant)); } });
    function drill(r) {
      const list = (showSA ? r.saPeople : []).concat(showCA ? r.caPeople : []);
      const d = el.querySelector('#drill');
      d.innerHTML = '<div style="height:12px"></div>' + card(esc(r.plant) + '｜現行人員下鑽（' + list.length + '人）', '<div id="dTbl"></div>', { tools: '<button class="btn sm" id="dFilter">套用為服務廠篩選</button>' + UI.exportBtns('dt') + '<button class="btn sm" id="dClose">關閉</button>', flush: true });
      const dt = table(d.querySelector('#dTbl'), {
        columns: [
          { key: 'role', label: '角色', get: (p) => roleName(p.role) }, { key: 'name', label: '姓名', html: (p) => UI.nameLink(p) }, { key: 'license', label: '證照' }, { key: 'years', label: '年資', num: true, fmt: F.d1 },
          { key: 'vol', label: '月均量能', num: true, get: (p) => p.role === 'SA' ? p.avgCars : p.avgOrders, fmt: F.d1 }, { key: 'csi', label: 'CSI', num: true, fmt: F.csi },
          { key: 'power', label: '綜合戰力', num: true, fmt: F.score, cls: (p, v) => colorCell('power', v) }, { key: 'rank', label: '排名', num: true }, { key: 'prLicense', label: '同證照PR', num: true, fmt: F.pr },
          { key: 'talentType', label: '人才類型', html: (p, v) => UI.pill(v, TALENT_COLOR[v]) }, { key: 'promotion', label: '升階準備度', html: (p, v) => UI.pill(v, promoColor(v)) }
        ], rows: list, sortKey: 'power', onRow: (p) => root.App.openPerson(p.id), short: true
      });
      UI.bindExport(d, 'dt', r.plant + '_人員', dt);
      d.querySelector('#dClose').addEventListener('click', () => { d.innerHTML = ''; });
      d.querySelector('#dFilter').addEventListener('click', () => { S.filters.plant = r.plant; root.App.rerender(); });
      d.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const names = rows.map((r) => r.plant);
    const ml = (v) => ({ silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: C.red }, label: { formatter: '平均 ' + (nn(v) ? v.toFixed(1) : ''), color: C.red, fontSize: 10, position: 'insideStartTop' }, data: nn(v) ? [{ yAxis: v }] : [] });
    const dual = (id, cnt, vol, n1, n2, avgV) => chart(el.querySelector(id), {
      color: [C.sky, C.navy], tooltip: { trigger: 'axis' }, legend: { data: [n1, n2] }, grid: { bottom: 62 },
      xAxis: { type: 'category', data: names, axisLabel: { rotate: 40, fontSize: 10.5 } },
      yAxis: [{ type: 'value', name: '人', minInterval: 1 }, { type: 'value', name: n2, splitLine: { show: false } }],
      series: [{ name: n1, type: 'bar', data: rows.map((r) => r[cnt]), barMaxWidth: 20 }, { name: n2, type: 'line', yAxisIndex: 1, data: rows.map((r) => nn(r[vol]) ? +r[vol].toFixed(1) : null), markLine: ml(avgV), symbolSize: 7 }]
    });
    if (showSA) dual('#c1', 'saCount', 'saAvgCars', '服專人數', '月均接車', avg.saAvgCars);
    if (showCA) dual('#c2', 'caCount', 'caAvgOrders', '出納人數', '月均結帳', avg.caAvgOrders);
    const barAvg = (id, k, avgV) => {
      const srt = rows.filter((r) => nn(r[k])).sort((a, b) => b[k] - a[k]);
      chart(el.querySelector(id), { tooltip: { trigger: 'axis', valueFormatter: (v) => nn(v) ? v.toFixed(1) : '—' }, grid: { bottom: 62 }, xAxis: { type: 'category', data: srt.map((r) => r.plant), axisLabel: { rotate: 40, fontSize: 10.5 } }, yAxis: { type: 'value', max: 100, name: '分' },
        series: [{ type: 'bar', barMaxWidth: 22, data: srt.map((r) => ({ value: +r[k].toFixed(1), itemStyle: { color: r[k] >= S.cfg.thresholds.highPower ? C.green : r[k] >= S.cfg.thresholds.midPower ? C.navy : C.red } })), label: { show: true, position: 'top', fontSize: 10 }, markLine: ml(avgV) }] });
    };
    if (showSA) barAvg('#c3', 'saPower', avg.saPower);
    if (showCA) barAvg('#c4', 'caPower', avg.caPower);
    const scatter = (id, xk, yk, xn, yn, ax, ay, fx, fy, size) => chart(el.querySelector(id), {
      tooltip: { trigger: 'item', formatter: (p) => p.data.name + '<br>' + xn + '：' + fx(p.data.value[0]) + '<br>' + yn + '：' + fy(p.data.value[1]) },
      grid: { left: 64, right: 30, bottom: 44 },
      xAxis: { type: 'value', name: xn, nameLocation: 'middle', nameGap: 26, scale: true }, yAxis: { type: 'value', name: yn, scale: true },
      series: [{ type: 'scatter', symbolSize: size || 16, itemStyle: { color: C.navy, opacity: .85 }, label: { show: true, formatter: (p) => p.data.name.replace('廠', ''), position: 'right', fontSize: 10.5 },
        data: rows.filter((r) => nn(r[xk]) && nn(r[yk])).map((r) => ({ name: r.plant, value: [r[xk], r[yk]] })),
        markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: C.red }, label: { show: false }, data: [nn(ax) ? { xAxis: ax } : null, nn(ay) ? { yAxis: ay } : null].filter(Boolean) } }]
    });
    if (showSA) scatter('#c5', 'saPerCar', 'saCsi', '單車產值', '服專CSI', avg.saPerCar, avg.saCsi, F.money, F.csi);
    if (showSA) scatter('#c6', 'saCount', 'saAvgCars', '服專人數', '月均接車', avg.saCount, avg.saAvgCars, F.int, F.d1);
    else scatter('#c6', 'caCount', 'caAvgOrders', '出納人數', '月均結帳', avg.caCount, avg.caAvgOrders, F.int, F.d1);
  };

  /* ======================= 3/4. 服專／出納分析 ======================= */
  function roleKpis(D, role) {
    const T = S.cfg.thresholds, CO = company(D);
    const cur = current(D.people[role]), co = current(CO.people[role]);
    const prevL = D.Pprev ? current(D.Pprev[role].filter((p) => Store.personPass(p))) : null;
    const rows = D.monthly[role], coRows = CO.monthly[role];
    const snap = { curLabel: '截至' + D.months[D.months.length - 1].slice(5) + '月', prevLabel: D.prevMonths.length ? '截至' + D.prevMonths[D.prevMonths.length - 1].slice(5) + '月' : '上期' };
    const pm = (l, k) => mean(l.map((p) => p[k]));
    const per100 = (r, k, base) => { const b = colSum(r, base), n = colSum(r, k); return b && nn(n) ? n / b * 100 : null; };
    const hi = (l) => l.filter((p) => nn(p.power) && p.power >= T.highPower).length;
    const cand = (l) => l.filter((p) => /候選/.test(p.promotion)).length;
    const coach = (l) => l.filter((p) => p.personType === '優先輔導').length;
    const out = [];
    const M = (o, fn) => out.push(kpi(Object.assign(o, kpiMonthly(D, role, fn))));
    const P = (o, fn) => out.push(kpi(Object.assign(o, { cur: fn(cur), prev: prevL ? fn(prevL) : null, company: fn(co) }, snap)));
    const plants = Store.plantStats(D).rows;
    if (role === 'SA') {
      out.push(kpi(Object.assign({ label: '現行人數', value: sum(plants.map((r) => r.saCount)), unit: '人', light: 'blue', company: co.length, hint: '依115.9名冊；本期／上期為當月有接車人數' }, kpiMonthly(D, 'SA', (r) => activeCount(r, 'cars')))));
      M({ label: '累積接車台數', value: colSum(rows, 'cars'), unit: '台', company: colSum(coRows, 'cars') }, (r) => colSum(r, 'cars'));
      M({ label: '月均接車台數（人均）', value: pm(cur, 'avgCars'), fmt: F.int, unit: '台', company: pm(co, 'avgCars') }, (r) => colMean(r, 'cars'));
      M({ label: '累積業績', value: colSum(rows, 'revenue'), fmt: F.money, unit: '元', company: colSum(coRows, 'revenue') }, (r) => colSum(r, 'revenue'));
      M({ label: '月均業績（人均）', value: pm(cur, 'avgRevenue'), fmt: F.money, unit: '元', company: pm(co, 'avgRevenue') }, (r) => colMean(r, 'revenue'));
      out.push(kpi({ label: '接車量能達成率', value: pm(cur, 'capacityRate'), fmt: F.pct2, light: nn(pm(cur, 'capacityRate')) ? 'blue' : 'gray', cur: pm(cur, 'capacityRate'), curLabel: '期間', company: pm(co, 'capacityRate'), hint: '接車台數 ÷（工作日 × ' + S.cfg.capacity.perDay + ' 台）；需於設定頁填入各月工作日，未填顯示「—」' }));
      M({ label: '單車產值', value: colSum(rows, 'cars') ? colSum(rows, 'revenue') / colSum(rows, 'cars') : null, fmt: F.money, unit: '元', company: colSum(coRows, 'cars') ? colSum(coRows, 'revenue') / colSum(coRows, 'cars') : null, hint: '業績合計 ÷ 接車合計' }, (r) => { const c = colSum(r, 'cars'); return c ? colSum(r, 'revenue') / c : null; });
      [['app', 'APP預約指定率', F.pct2], ['a1', 'A1準時定保達成', F.pct2], ['a2', 'A2準時定保達成', F.pct2], ['bodyPaint', '自費鈑噴達成', F.pct2], ['csi', 'CSI滿意度', F.csi], ['csiFirst', 'CSI首回滿意度', F.csi], ['esSelf', 'ES自主滿意度', F.csi], ['esRedesignate', 'ES服專再指定率', F.pct]].forEach(([k, l, f]) =>
        M({ label: l, value: pm(cur, k), fmt: f, company: pm(co, k), deltaFmt: f === F.pct || f === F.pct2 ? (v) => (v * 100).toFixed(2) + 'pp' : F.d1 }, (r) => colMean(r, k)));
      [['ngFee', '每100台收費解說NG'], ['ngTime', '每100台時間管理NG'], ['keyUnlock', '每100台解金鑰']].forEach(([k, l]) =>
        M({ label: l, value: per100(rows, k, 'cars'), fmt: F.d2, goodDir: -1, company: per100(coRows, k, 'cars'), hint: '合計次數 ÷ 接車台數 × 100，越少越好' }, (r) => per100(r, k, 'cars')));
    } else {
      out.push(kpi(Object.assign({ label: '現行人數', value: sum(plants.map((r) => r.caCount)), unit: '人', light: 'blue', company: co.length, hint: '依115.9名冊；本期／上期為當月有結帳人數' }, kpiMonthly(D, 'CA', (r) => activeCount(r, 'orders')))));
      M({ label: '累積結帳工單', value: colSum(rows, 'orders'), unit: '張', company: colSum(coRows, 'orders') }, (r) => colSum(r, 'orders'));
      M({ label: '月均結帳工單（人均）', value: pm(cur, 'avgOrders'), fmt: F.int, unit: '張', company: pm(co, 'avgOrders') }, (r) => colMean(r, 'orders'));
      [['esign', '電子簽名率', F.pct], ['card', '感心卡平均核卡', F.d2], ['csi', 'CSI滿意度', F.csi], ['csiFirst', 'CSI首回滿意度', F.csi], ['esSelf', 'ES自主滿意度', F.csi]].forEach(([k, l, f]) =>
        M({ label: l, value: pm(cur, k), fmt: f, company: pm(co, k), deltaFmt: f === F.pct ? (v) => (v * 100).toFixed(1) + 'pt' : F.d2 }, (r) => colMean(r, k)));
      [['ngFee', '每100張工單收費解說NG'], ['keyUnlock', '每100張工單解金鑰']].forEach(([k, l]) =>
        M({ label: l, value: per100(rows, k, 'orders'), fmt: F.d2, goodDir: -1, company: per100(coRows, k, 'orders'), hint: '合計次數 ÷ 結帳工單 × 100，越少越好' }, (r) => per100(r, k, 'orders')));
    }
    P({ label: '平均綜合戰力', value: pm(cur, 'power'), fmt: F.score, unit: '分', hint: '管理診斷指標，非正式考核分數' }, (l) => pm(l, 'power'));
    P({ label: '高戰力人數', value: hi(cur), unit: '人' }, hi);
    P({ label: '升階候選人數', value: cand(cur), unit: '人', hint: '升階準備度含「候選」者' }, cand);
    P({ label: '優先輔導人數', value: coach(cur), unit: '人', goodDir: -1, light: coach(cur) ? 'yellow' : 'green' }, coach);
    if (role === 'CA') { const z = plants.filter((r) => r.saCount > 0 && r.caCount === 0); out.push(kpi({ label: '出納0人據點', value: z.length, unit: '處', cur: z.length, curLabel: '115.9名冊', light: z.length ? 'red' : 'green', goodDir: -1, hint: z.map((r) => r.plant).join('、') })); }
    return out;
  }

  function rolePage(role) {
    return function (el, D) {
      if (!roleOn(role)) { el.innerHTML = '<div class="banner info"><b>角色切換</b><span>目前角色為「' + (S.role === 'SA' ? '服專' : '出納') + '」，本頁為' + roleName(role) + '分析。</span><button class="btn sm" id="sw">切換為' + roleName(role) + '</button></div>'; el.querySelector('#sw').addEventListener('click', () => root.App.setRole(role)); return; }
      const list = D.people[role];
      const cur = current(list);
      el.innerHTML = '<div class="page-head"><div><h1>' + roleName(role) + '分析</h1><p>明細依 Excel「' + roleName(role) + '總覽」欄位完整呈現；總表依115.9最新廠別；PR／綜合戰力僅比較現行' + roleName(role) + '。期間：' + Store.monthLabel(D.months) + '</p></div></div>' +
        '<div class="kpis">' + roleKpis(D, role).join('') + '</div>' +
        '<div class="section-title">分布與定位</div><div class="grid g2">' +
        card('量能PR × 服務品質PR', '<div class="chart" id="q1"></div>', { sub: '點大小＝綜合戰力；右上＝量質兼具' }) +
        card('綜合戰力分布', '<div class="chart" id="q2"></div>', { sub: '依證照級別' }) + '</div>' +
        '<div class="section-title">' + roleName(role) + '明細表</div>' +
        card(roleName(role) + '明細（' + list.length + '人，現行 ' + cur.length + ' 人）', '<div id="rt"></div>', { tools: UI.exportBtns('rt'), flush: true });
      const extra = role === 'SA' ? [{ key: 'capacityRate', label: '接車量能達成率', num: true, fmt: F.pct2 }] : [];
      const t = table(el.querySelector('#rt'), { columns: personColumns(role, { extra }), rows: list, sortKey: 'power', onRow: (p) => root.App.openPerson(p.id), rowClass: (p) => p.status !== '現行' ? 'hist' : '' });
      UI.bindExport(el, 'rt', roleName(role) + '明細', t);
      const pts = cur.filter((p) => nn(p.prVolume) && nn(p.prService));
      chart(el.querySelector('#q1'), {
        tooltip: { trigger: 'item', formatter: (p) => p.data.p.plant + '｜' + p.data.p.name + '<br>量能PR ' + F.pr(p.data.p.prVolume) + '｜服務品質PR ' + F.pr(p.data.p.prService) + '<br>綜合戰力 ' + F.score(p.data.p.power) },
        grid: { left: 52, right: 24, bottom: 44 }, xAxis: { type: 'value', name: '量能PR', min: 0, max: 100, nameLocation: 'middle', nameGap: 26 }, yAxis: { type: 'value', name: '服務品質PR', min: 0, max: 100 },
        series: [{ type: 'scatter', data: pts.map((p) => ({ value: [p.prVolume * 100, p.prService * 100], p, symbolSize: nn(p.power) ? 6 + p.power / 6 : 6, itemStyle: { color: !nn(p.power) ? C.gray : p.power >= S.cfg.thresholds.highPower ? C.green : p.power >= S.cfg.thresholds.midPower ? C.navy : C.red, opacity: .8 } })),
          markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: C.gray }, label: { show: false }, data: [{ xAxis: 50 }, { yAxis: 50 }] },
          label: { show: pts.length <= 30, formatter: (p) => p.data.p.name, position: 'right', fontSize: 10 } }]
      });
      el.querySelector('#q1') && echarts.getInstanceByDom(el.querySelector('#q1')).on('click', (e) => e.data && root.App.openPerson(e.data.p.id));
      const lic = Array.from(new Set(cur.map((p) => p.license))).filter(Boolean);
      const bins = ['<30', '30–40', '40–50', '50–60', '60–70', '70–80', '≥80'];
      const binOf = (v) => v < 30 ? 0 : v < 40 ? 1 : v < 50 ? 2 : v < 60 ? 3 : v < 70 ? 4 : v < 80 ? 5 : 6;
      chart(el.querySelector('#q2'), {
        color: C.series, tooltip: { trigger: 'axis' }, legend: { data: lic }, grid: { bottom: 30 },
        xAxis: { type: 'category', data: bins, name: '分' }, yAxis: { type: 'value', minInterval: 1, name: '人' },
        series: lic.map((l) => ({ name: l, type: 'bar', stack: 'a', barMaxWidth: 36, data: bins.map((b, i) => cur.filter((p) => p.license === l && nn(p.power) && binOf(p.power) === i).length) }))
      });
    };
  }
  Pages.sa = rolePage('SA');
  Pages.ca = rolePage('CA');
})(window);
