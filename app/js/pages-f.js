/* =========================================================================
 * 頁面 F：服專稼動率（接車）分析管理｜量與值
 *  稼動率＝接車台數 ÷（廠工作天數 × 標準台數／日）＝ Excel「標準量能達成率」
 *  量：接車台數、日均接車、稼動率；值：業績、單車產值、日均產值
 *  工作天數：Excel 月度「廠工作天數」優先，其次「指標與權重設定」填入值；無工作天數之月份不計稼動率。
 * ========================================================================= */
(function (root) {
  const { Store, UI, Engine, PX } = root; const S = Store.S;
  const { F, esc, nn, kpi, table, chart, card, C } = UI; const sum = Engine.sum, mean = Engine.mean;
  const Pages = root.Pages;
  const U = () => S.cfg.utilization;
  const perDay = () => S.cfg.capacity.perDay;
  const wdOf = (r) => (r.workdays > 0 ? r.workdays : (S.cfg.capacity.workdays || {})[r.month] > 0 ? S.cfg.capacity.workdays[r.month] : null);
  const band = (v) => !nn(v) ? '—' : v >= U().over ? '超載' : v >= U().high ? '達標' : v >= U().low ? '接近' : '偏低';
  const bandColor = { 超載: 'blue', 達標: 'green', 接近: 'yellow', 偏低: 'red', '—': 'gray' };

  // 個人：只取有工作天數且有接車之月份
  function personUtil(p, months) {
    const rows = p.monthly.filter((r) => months.indexOf(r.month) >= 0 && nn(r.cars) && wdOf(r));
    if (!rows.length) return null;
    const cars = sum(rows.map((r) => r.cars)), days = sum(rows.map((r) => wdOf(r)));
    const revRows = rows.filter((r) => nn(r.revenue)), rev = sum(revRows.map((r) => r.revenue)), revCars = sum(revRows.map((r) => r.cars));
    const by = {}; rows.forEach((r) => { by[r.month] = r.cars / (wdOf(r) * perDay()); });
    return { months: rows.map((r) => r.month), cars, days, std: days * perDay(), util: cars / (days * perDay()), dailyCars: cars / days,
      revenue: revRows.length ? rev : null, perCar: revCars ? rev / revCars : null, dailyRev: revRows.length ? rev / sum(revRows.map((r) => wdOf(r))) : null, byMonth: by };
  }

  Pages.utilization = function (el, D) {
    if (S.role === 'CA') { el.innerHTML = '<div class="banner info"><b>僅適用服專</b><span>稼動率以服專接車計算。</span><button class="btn sm" id="sw">切換為服專</button></div>'; el.querySelector('#sw').addEventListener('click', () => root.App.setRole('SA')); return; }
    const T = U();
    const allMs = D.months;
    const wdMonths = allMs.filter((m) => S.model.saMonthly.some((r) => r.month === m && wdOf(r)));
    if (!wdMonths.length) { el.innerHTML = '<div class="page-head"><div><h1>服專稼動率（接車）</h1></div></div><div class="banner warn"><b>所選期間無工作天數</b><span>稼動率需要廠工作天數。目前 Excel 提供 ' + Array.from(new Set(S.model.saMonthly.filter((r) => r.workdays > 0).map((r) => r.month))).join('、') + '；其他月份可於「指標與權重設定」填入。</span></div>'; return; }
    const people = PX.current(D.people.SA);
    const rows = people.map((p) => { const u = personUtil(p, wdMonths); return u ? Object.assign({ p, plant: p.plant, name: p.name, license: p.license }, u) : null; }).filter(Boolean);
    const coAll = PX.current(D.P.SA).map((p) => personUtil(p, wdMonths)).filter(Boolean);
    const agg = (l) => { const c = sum(l.map((x) => x.cars)), s = sum(l.map((x) => x.std)), d = sum(l.map((x) => x.days)); const rv = l.filter((x) => nn(x.revenue));
      return { n: l.length, cars: c, util: s ? c / s : null, dailyCars: d ? c / d : null, perCar: sum(rv.map((x) => x.cars)) ? sum(rv.map((x) => x.revenue)) / sum(rv.map((x) => x.cars)) : null, dailyRev: rv.length ? sum(rv.map((x) => x.revenue)) / sum(rv.map((x) => x.days)) : null }; };
    const A = agg(rows), CO = agg(coAll);
    const avgPerCar = CO.perCar;
    rows.forEach((r) => { r.band = band(r.util); r.quad = (r.util >= T.high ? '高量' : '低量') + (nn(r.perCar) && nn(avgPerCar) && r.perCar >= avgPerCar ? '高值' : '低值'); });
    const cnt = (b) => rows.filter((r) => r.band === b).length;
    const mLabel = wdMonths.map((m) => Number(m.slice(5)) + '月').join('、');
    // 月別（本期＝最後一個有工作天數月份；上期＝前一個）
    const lastM = wdMonths[wdMonths.length - 1], prevM = wdMonths[wdMonths.length - 2];
    const mAgg = (m) => m ? agg(people.map((p) => personUtil(p, [m])).filter(Boolean)) : null;
    const MA = mAgg(lastM), MP = mAgg(prevM);
    const cmp = (k) => ({ cur: MA ? MA[k] : null, prev: MP ? MP[k] : null, curLabel: lastM ? Number(lastM.slice(5)) + '月' : '本期', prevLabel: prevM ? Number(prevM.slice(5)) + '月' : '上期' });

    el.innerHTML = '<div class="page-head"><div><h1>服專稼動率（接車）｜量與值</h1><p>計算月份：' + mLabel + '（有廠工作天數之月份）｜現行服專 ' + rows.length + ' 人｜標準 ' + perDay() + ' 台／工作日</p></div></div>' +
      '<div class="guide"><b>定義</b><span>稼動率＝接車台數 ÷（廠工作天數 × ' + perDay() + '）＝ Excel「標準量能達成率」</span><span>日均接車＝接車 ÷ 工作天數</span><span>單車產值＝業績 ÷ 有業績月份接車</span><span>日均產值＝業績 ÷ 工作天數</span><span>分級：≥' + F.pct0(T.over) + ' 超載｜' + F.pct0(T.high) + '–' + F.pct0(T.over) + ' 達標｜' + F.pct0(T.low) + '–' + F.pct0(T.high) + ' 接近｜<' + F.pct0(T.low) + ' 偏低</span></div>' +
      (allMs.length > wdMonths.length ? '<div class="banner info"><b>工作天數涵蓋</b><span>所選期間 ' + Store.monthLabel(allMs) + '，其中僅 ' + mLabel + ' 有廠工作天數，稼動率只計這些月份；其他月份請於「指標與權重設定」補填工作天數。量值趨勢圖仍呈現全部月份。</span></div>' : '') +
      '<div class="kpis">' +
      kpi(Object.assign({ label: '平均稼動率', value: A.util, fmt: F.pct2, light: !nn(A.util) ? 'gray' : A.util >= T.high ? 'green' : A.util >= T.low ? 'yellow' : 'red', company: CO.util, deltaFmt: (v) => (v * 100).toFixed(2) + 'pp', hint: '接車合計 ÷ 標準量合計' }, cmp('util'))) +
      kpi(Object.assign({ label: '日均接車（人）', value: A.dailyCars, fmt: F.d1, unit: '台', company: CO.dailyCars }, cmp('dailyCars'))) +
      kpi(Object.assign({ label: '單車產值', value: A.perCar, fmt: F.money, unit: '元', company: CO.perCar }, cmp('perCar'))) +
      kpi(Object.assign({ label: '日均產值（人）', value: A.dailyRev, fmt: F.money, unit: '元', company: CO.dailyRev }, cmp('dailyRev'))) +
      kpi({ label: '達標以上（≥' + F.pct0(T.high) + '）', value: cnt('達標') + cnt('超載'), unit: '人', light: 'green', cur: cnt('超載'), curFmt: F.int, curLabel: '其中超載', company: rows.length, companyLabel: '計算人數' }) +
      kpi({ label: '稼動偏低（<' + F.pct0(T.low) + '）', value: cnt('偏低'), unit: '人', light: cnt('偏低') ? 'red' : 'green', goodDir: -1, cur: cnt('接近'), curFmt: F.int, curLabel: '接近（' + F.pct0(T.low) + '–' + F.pct0(T.high) + '）', company: rows.length, companyLabel: '計算人數' }) +
      '</div><div class="section-title">量 × 值 矩陣</div><div class="grid g2b">' +
      card('稼動率 × 單車產值', '<div class="chart tall" id="u1"></div>', { sub: '直線＝稼動率 ' + F.pct0(T.high) + '；橫線＝全公司單車產值；點選看個人' }) +
      card('四象限人數', '<div id="u2"></div>', { flush: true }) + '</div>' +
      '<div class="section-title">服務廠</div><div class="grid g2b">' +
      card('各廠稼動率', '<div class="chart tall" id="u3"></div>', { sub: '虛線＝全公司' }) +
      card('服務廠稼動與產值', '<div id="u4"></div>', { flush: true, tools: UI.exportBtns('u4') }) + '</div>' +
      '<div class="section-title">月別量與值趨勢（全部月份）</div>' + card('人均接車與單車產值', '<div class="chart" id="u5"></div>', { sub: '長條＝人均月接車；折線＝單車產值；菱形＝稼動率（有工作天數月份）' }) +
      '<div class="section-title">服專稼動率明細</div>' + card('服專（' + rows.length + ' 人）', '<div id="u6"></div>', { flush: true, tools: UI.exportBtns('u6'), sub: '點列進入個人分析' });

    // 矩陣
    const qColor = { 高量高值: C.green, 高量低值: C.navy, 低量高值: '#d97706', 低量低值: C.red };
    const pts = rows.filter((r) => nn(r.perCar));
    const c1 = chart(el.querySelector('#u1'), {
      tooltip: { trigger: 'item', formatter: (x) => { const r = x.data.r; return esc(r.plant + '｜' + r.name) + '<br>稼動率 ' + F.pct2(r.util) + '｜日均 ' + F.d1(r.dailyCars) + ' 台<br>單車產值 ' + F.money(r.perCar) + '｜日均產值 ' + F.money(r.dailyRev) + '<br>' + r.quad; } },
      grid: { left: 64, right: 24, top: 20, bottom: 44 },
      xAxis: { type: 'value', name: '稼動率', nameLocation: 'middle', nameGap: 28, scale: true, axisLabel: { formatter: (v) => (v * 100).toFixed(0) + '%' } }, yAxis: { type: 'value', name: '單車產值', scale: true },
      series: [{ type: 'scatter', symbolSize: (v, x) => 7 + Math.sqrt(x.data.r.cars) / 3, data: pts.map((r) => ({ value: [r.util, r.perCar], r, itemStyle: { color: qColor[r.quad], opacity: .85 } })),
        label: { show: true, formatter: (x) => x.data.r.name, position: 'right', fontSize: 10 },
        labelLayout: { hideOverlap: true }, emphasis: { label: { show: true, fontWeight: 'bold' } },
        markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: C.gray }, label: { show: false }, data: [{ xAxis: T.high }, nn(avgPerCar) ? { yAxis: avgPerCar } : null].filter(Boolean) } }]
    });
    if (c1) c1.on('click', (e) => e.data && root.App.openPerson(e.data.r.p.id));
    const quads = ['高量高值', '高量低值', '低量高值', '低量低值'];
    const qDesc = { 高量高值: '標竿：量足且單價高，可帶訓', 高量低值: '量足但單車產值低：加強維修建議與附加銷售', 低量高值: '單價佳但量不足：檢視派工與招攬', 低量低值: '量值皆待提升：優先輔導' };
    table(el.querySelector('#u2'), { columns: [{ key: 'q', label: '象限', html: (o) => '<b style="color:' + qColor[o.q] + '">' + o.q + '</b>' }, { key: 'n', label: '人數', num: true }, { key: 'names', label: '人員', wrap: true }, { key: 'd', label: '管理方向', wrap: true }],
      rows: quads.map((q) => ({ q, n: rows.filter((r) => r.quad === q).length, names: rows.filter((r) => r.quad === q).sort((a, b) => b.util - a.util).map((r) => r.name).join('、'), d: qDesc[q] })), footer: false });

    // 服務廠
    const byP = {}; rows.forEach((r) => { (byP[r.plant] = byP[r.plant] || []).push(r); });
    const pRows = Object.keys(byP).map((pl) => Object.assign({ plant: pl, low: byP[pl].filter((r) => r.band === '偏低').length, ok: byP[pl].filter((r) => r.util >= T.high).length }, agg(byP[pl]))).sort((a, b) => b.util - a.util);
    const rv = pRows.slice().reverse();
    chart(el.querySelector('#u3'), {
      tooltip: { trigger: 'axis', valueFormatter: (v) => nn(v) ? v.toFixed(2) + '%' : '—' }, grid: { left: 70, right: 46, top: 10, bottom: 24 },
      xAxis: { type: 'value', axisLabel: { formatter: '{value}%' } }, yAxis: { type: 'category', data: rv.map((o) => o.plant) },
      series: [{ type: 'bar', barMaxWidth: 14, data: rv.map((o) => ({ value: +(o.util * 100).toFixed(2), itemStyle: { color: o.util >= T.high ? C.green : o.util >= T.low ? C.navy : C.red } })), label: { show: true, position: 'right', fontSize: 10, formatter: (x) => x.value.toFixed(1) + '%' },
        markLine: nn(CO.util) ? { silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: C.red }, label: { show: false }, data: [{ xAxis: +(CO.util * 100).toFixed(2) }] } : undefined }]
    });
    const t4 = table(el.querySelector('#u4'), {
      columns: [{ key: 'plant', label: '服務廠' }, { key: 'n', label: '服專', num: true }, { key: 'cars', label: '接車', num: true, fmt: F.int }, { key: 'util', label: '稼動率', num: true, fmt: F.pct2, cls: (o, v) => v >= T.high ? 'cell-good' : v < T.low ? 'cell-bad' : '' },
        { key: 'dailyCars', label: '日均接車／人', num: true, fmt: F.d1 }, { key: 'perCar', label: '單車產值', num: true, fmt: F.money, cls: (o, v) => nn(avgPerCar) && nn(v) ? (v >= avgPerCar ? 'cell-good' : 'cell-bad') : '' }, { key: 'dailyRev', label: '日均產值／人', num: true, fmt: F.money },
        { key: 'ok', label: '達標人數', num: true }, { key: 'low', label: '偏低人數', num: true, cls: (o, v) => v ? 'cell-bad' : '' }],
      rows: pRows, sortKey: 'util', short: true, onRow: (o) => { S.filters.plant = o.plant; root.App.rerender(); }, avgRow: Object.assign({ plant: '全公司' }, CO, { ok: null, low: null })
    });
    UI.bindExport(el, 'u4', '服務廠稼動率', t4);

    // 月別趨勢（全部月份）
    const mt = allMs.map((m) => {
      const rs = S.model.saMonthly.filter((r) => r.month === m && r.status === '現行' && nn(r.cars) && people.some((p) => p.name === r.name));
      const rv2 = rs.filter((r) => nn(r.revenue)); const wds = rs.filter((r) => wdOf(r));
      return { m, avgCars: rs.length ? sum(rs.map((r) => r.cars)) / rs.length : null, perCar: sum(rv2.map((r) => r.cars)) ? sum(rv2.map((r) => r.revenue)) / sum(rv2.map((r) => r.cars)) : null,
        util: wds.length ? sum(wds.map((r) => r.cars)) / sum(wds.map((r) => wdOf(r) * perDay())) : null };
    });
    chart(el.querySelector('#u5'), {
      color: [C.sky, C.red, C.navy], tooltip: { trigger: 'axis' }, legend: { data: ['人均月接車', '單車產值', '稼動率'] }, grid: { right: 110 },
      xAxis: { type: 'category', data: mt.map((x) => Number(x.m.slice(5)) + '月') },
      yAxis: [{ type: 'value', name: '台' }, { type: 'value', name: '元', splitLine: { show: false } }, { type: 'value', name: '稼動率', position: 'right', offset: 56, splitLine: { show: false }, axisLabel: { formatter: '{value}%' } }],
      series: [{ name: '人均月接車', type: 'bar', barMaxWidth: 26, data: mt.map((x) => nn(x.avgCars) ? +x.avgCars.toFixed(1) : null) },
        { name: '單車產值', type: 'line', yAxisIndex: 1, data: mt.map((x) => nn(x.perCar) ? Math.round(x.perCar) : null) },
        { name: '稼動率', type: 'scatter', symbol: 'diamond', symbolSize: 14, yAxisIndex: 2, data: mt.map((x) => nn(x.util) ? +(x.util * 100).toFixed(2) : null), label: { show: true, position: 'top', formatter: (x) => x.value.toFixed(1) + '%', fontSize: 10 } }]
    });

    // 明細
    const mCols = wdMonths.map((m) => ({ key: 'm' + m, label: Number(m.slice(5)) + '月稼動率', num: true, get: (r) => r.byMonth[m], fmt: F.pct2, cls: (r, v) => nn(v) ? (v >= T.high ? 'cell-good' : v < T.low ? 'cell-bad' : '') : '' }));
    const t6 = table(el.querySelector('#u6'), {
      columns: [{ key: 'plant', label: '服務廠' }, { key: 'name', label: '服專', sticky: true, html: (r) => UI.nameLink(r.p) }, { key: 'license', label: '證照' },
        { key: 'cars', label: '接車', num: true, fmt: F.int }, { key: 'days', label: '工作天數', num: true, fmt: F.int }, { key: 'std', label: '標準量', num: true, fmt: F.int },
        { key: 'util', label: '稼動率', num: true, fmt: F.pct2, cls: (r, v) => v >= T.high ? 'cell-good' : v < T.low ? 'cell-bad' : '' }].concat(mCols).concat([
        { key: 'band', label: '分級', html: (r) => UI.pill(r.band, bandColor[r.band]) }, { key: 'dailyCars', label: '日均接車', num: true, fmt: F.d1 },
        { key: 'revenue', label: '業績', num: true, fmt: F.money }, { key: 'perCar', label: '單車產值', num: true, fmt: F.money, cls: (r, v) => nn(avgPerCar) && nn(v) ? (v >= avgPerCar ? 'cell-good' : 'cell-bad') : '' },
        { key: 'dailyRev', label: '日均產值', num: true, fmt: F.money }, { key: 'quad', label: '量值象限', html: (r) => '<b style="color:' + qColor[r.quad] + '">' + r.quad + '</b>' },
        { key: 'power', label: '綜合戰力', num: true, get: (r) => r.p.power, fmt: F.score }]),
      rows, sortKey: 'util', onRow: (r) => root.App.openPerson(r.p.id)
    });
    UI.bindExport(el, 'u6', '服專稼動率', t6);
  };

  root.UTILX = { personUtil, band };
})(window);
