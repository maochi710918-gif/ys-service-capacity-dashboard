/* =========================================================================
 * 頁面 G：廠營收分析（廠別月度量能：目標／實績，未稅元）
 *  配對達成率＝同廠同月目標、實績皆有數值之配對實績合計 ÷ 配對目標合計（目標合計>0）
 *  配對差額＝配對實績合計 − 配對目標合計
 *  目標／實績月平均＝各自合計 ÷ 各自有效資料月份（真正 0 計入；缺資料與整併不適用分開）
 *  季度變化（pp）＝兩季配對達成率之差 × 100
 *  民權廠 7–12 月整併：7–9 月與 Q3 不適用，排除營收平均與達成率，保留歷史資料
 *  廠營收為經營背景，與個人業績分開呈現。
 * ========================================================================= */
(function (root) {
  const { Store, UI, Engine } = root; const S = Store.S;
  const { F, esc, nn, kpi, table, chart, card, C } = UI; const sum = Engine.sum;
  const Pages = root.Pages;
  const isNA = (r) => r.revApplicable === 0 || r.revApplicable === '0' || /整併/.test(r.revStatus || '');
  const tOk = (r) => !isNA(r) && (r.tValid === 1 || (r.tValid == null && nn(r.revTarget)));
  const aOk = (r) => !isNA(r) && (r.aValid === 1 || (r.aValid == null && nn(r.revActual)));
  const pair = (r) => !isNA(r) && (r.paired === 1 || (r.paired == null && nn(r.revTarget) && nn(r.revActual)));
  const pT = (r) => nn(r.pT) ? r.pT : r.revTarget, pA = (r) => nn(r.pA) ? r.pA : r.revActual;
  const qOf = (m) => 'Q' + Math.ceil(Number(m.slice(5)) / 3);
  const pp = (v) => nn(v) ? (v > 0 ? '+' : '') + v.toFixed(2) + ' pp' : '—';
  const ms2 = (list) => { const n = list.map((m) => Number(m.slice(5))).sort((a, b) => a - b); if (!n.length) return '—'; const out = []; let s = n[0], p = n[0]; for (let i = 1; i <= n.length; i++) { if (n[i] === p + 1) { p = n[i]; continue; } out.push(s === p ? s + '' : s + '–' + p); s = p = n[i]; } return out.join('、') + '月'; };

  function agg(rows) {
    const tr = rows.filter(tOk), ar = rows.filter(aOk), pr = rows.filter(pair);
    const T = sum(tr.map((r) => r.revTarget)), A = sum(ar.map((r) => r.revActual)), PT = sum(pr.map(pT)), PA = sum(pr.map(pA));
    return { target: tr.length ? T : null, actual: ar.length ? A : null, tMonths: tr.length, aMonths: ar.length, pairN: pr.length, pairT: PT, pairA: PA,
      rate: PT > 0 ? PA / PT : null, diff: pr.length ? PA - PT : null, tAvg: tr.length ? T / tr.length : null, aAvg: ar.length ? A / ar.length : null,
      na: rows.filter(isNA).length, missing: rows.filter((r) => !isNA(r) && !tOk(r) && !aOk(r)).length };
  }
  root.REVX = { agg, isNA, pair, qOf };

  Pages.revenue = function (el, D) {
    const all = (S.model.plantMonthly || []).filter((r) => nn(r.revTarget) || nn(r.revActual) || isNA(r));
    if (!all.length) { el.innerHTML = '<div class="page-head"><div><h1>廠營收分析</h1></div></div><div class="banner info"><b>無廠營收資料</b><span>請確認 Excel「廠別月度量能」含廠營收目標／實績。</span></div>'; return; }
    const roster = (S.model.plants || []).map((p) => p.plant);
    const scopePlant = (p) => (!S.filters.plant || p === S.filters.plant) && (Store.perm().scope !== 'plant' || !S.user.plant || p === S.user.plant) && (!roster.length || roster.indexOf(p) >= 0);
    const ms = D.months;
    const rows = all.filter((r) => ms.indexOf(r.month) >= 0 && scopePlant(r.plant));
    const A = agg(rows);
    const plants = Array.from(new Set(rows.map((r) => r.plant))).sort((a, b) => roster.indexOf(a) - roster.indexOf(b));
    const qs = ['Q1', 'Q2', 'Q3', 'Q4'].filter((q) => ms.some((m) => qOf(m) === q));
    const qAgg = {}; qs.forEach((q) => { qAgg[q] = agg(rows.filter((r) => qOf(r.month) === q)); });
    const last2 = qs.slice(-2);
    const qChange = last2.length === 2 && nn(qAgg[last2[0]].rate) && nn(qAgg[last2[1]].rate) ? (qAgg[last2[1]].rate - qAgg[last2[0]].rate) * 100 : null;
    const pRows = plants.map((pl) => {
      const rs = rows.filter((r) => r.plant === pl), a = agg(rs);
      const o = Object.assign({ plant: pl, cover: '目標：' + ms2(rs.filter(tOk).map((r) => r.month)) + '；實績：' + ms2(rs.filter(aOk).map((r) => r.month)), naMonths: ms2(rs.filter(isNA).map((r) => r.month)) }, a);
      qs.forEach((q) => { const qa = agg(rs.filter((r) => qOf(r.month) === q)); o[q] = qa.pairN ? qa.rate : null; o[q + 'na'] = rs.filter((r) => qOf(r.month) === q).every(isNA) && rs.some((r) => qOf(r.month) === q); });
      o.qChange = last2.length === 2 && nn(o[last2[0]]) && nn(o[last2[1]]) ? (o[last2[1]] - o[last2[0]]) * 100 : null;
      return o;
    }).sort((a, b) => (b.rate || 0) - (a.rate || 0));
    const months = ms.filter((m) => rows.some((r) => r.month === m));
    const mRows = months.map((m) => Object.assign({ month: m, q: qOf(m) }, agg(rows.filter((r) => r.month === m))));
    let cumT = 0, cumA = 0; mRows.forEach((r) => { cumT += r.pairT; cumA += r.pairA; r.cumRate = cumT > 0 ? cumA / cumT : null; });
    const mer = all.filter((r) => isNA(r) && ms.indexOf(r.month) >= 0 && scopePlant(r.plant));
    const merTxt = Array.from(new Set(mer.map((r) => r.plant))).map((pl) => pl + ' ' + ms2(mer.filter((r) => r.plant === pl).map((r) => r.month))).join('；');
    const rc = (v) => !nn(v) ? '' : v >= 1 ? 'cell-good' : v < 0.95 ? 'cell-bad' : 'cell-warn';
    const rateLight = (v) => !nn(v) ? 'gray' : v >= 1 ? 'green' : v >= 0.95 ? 'yellow' : 'red';

    el.innerHTML = '<div class="page-head"><div><h1>廠營收分析</h1><p>資料版本 ' + esc(S.model.meta.version || '') + '｜期間 ' + Store.monthLabel(ms) + (S.filters.plant ? '｜' + esc(S.filters.plant) : '｜全公司（' + plants.length + ' 廠）') + '｜未稅元｜廠營收為經營背景，與個人業績分開呈現</p></div></div>' +
      '<div class="guide"><b>定義</b><span>配對達成率＝同廠同月目標、實績皆有值之實績合計 ÷ 目標合計</span><span>配對差額＝配對實績 − 配對目標</span><span>月平均＝合計 ÷ 各自有效資料月份（真正 0 計入）</span><span>季度變化＝兩季達成率差 × 100（pp）</span></div>' +
      (merTxt ? '<div class="banner warn"><b>整併不適用</b><span>' + esc(merTxt) + '：7–12月整併，不計目標、實績、月平均與達成率；歷史資料保留。</span></div>' : '') +
      '<div class="kpis">' +
      kpi({ label: '累積營收目標', value: A.target, fmt: F.money, unit: '元', light: 'blue', cur: A.tMonths, curFmt: F.int, curLabel: '有效目標（廠月）', company: A.tAvg, companyLabel: '目標月平均' }) +
      kpi({ label: '累積營收實績', value: A.actual, fmt: F.money, unit: '元', light: 'blue', cur: A.aMonths, curFmt: F.int, curLabel: '有效實績（廠月）', company: A.aAvg, companyLabel: '實績月平均' }) +
      kpi({ label: '配對達成率', value: A.rate, fmt: F.pct2, light: rateLight(A.rate), cur: A.pairN, curFmt: F.int, curLabel: '配對廠月', company: A.pairT, companyLabel: '配對目標', subFmt: F.money, hint: '同廠同月目標、實績皆有值' }) +
      kpi({ label: '配對差額', value: A.diff, fmt: (v) => (v > 0 ? '+' : '') + F.money(v), unit: '元', light: !nn(A.diff) ? 'gray' : A.diff >= 0 ? 'green' : 'red', cur: A.pairA, curFmt: F.money, curLabel: '配對實績', company: A.pairT, companyLabel: '配對目標', subFmt: F.money }) +
      qs.map((q) => kpi({ label: q + ' 配對達成率', value: qAgg[q].rate, fmt: F.pct2, light: rateLight(qAgg[q].rate), cur: qAgg[q].pairA, curFmt: F.money, curLabel: '配對實績', company: qAgg[q].pairT, companyLabel: '配對目標', subFmt: F.money })).join('') +
      (last2.length === 2 ? kpi({ label: last2[1] + ' 較 ' + last2[0] + ' 變化', value: qChange, fmt: (v) => (v > 0 ? '+' : '') + v.toFixed(2), unit: 'pp', light: !nn(qChange) ? 'gray' : qChange >= 0 ? 'green' : 'red', cur: qAgg[last2[1]].rate, curFmt: F.pct2, curLabel: last2[1], company: qAgg[last2[0]].rate, companyLabel: last2[0] }) : '') +
      '</div><div class="grid g2" style="margin-top:12px">' +
      card('月別目標 × 實績', '<div class="chart tall" id="g1"></div>', { sub: '長條＝目標／實績；折線＝當月與累積配對達成率' }) +
      card('各廠配對達成率', '<div class="chart tall" id="g2"></div>', { sub: '虛線＝100%' }) + '</div>' +
      '<div class="section-title">服務廠明細</div>' + card('各廠累積、月平均、配對與季度', '<div id="g3"></div>', { flush: true, tools: UI.exportBtns('g3'), sub: '點列套用服務廠篩選' }) +
      '<div class="section-title">季度比較</div>' + card('各廠 × 季度配對達成率', '<div class="chart" id="g4"></div>', { sub: '灰格＝不適用（整併）' }) +
      '<div class="section-title">月別明細</div>' + card('月別營收', '<div id="g5"></div>', { flush: true, tools: UI.exportBtns('g5') });

    chart(el.querySelector('#g1'), {
      color: [C.sky, C.navy, C.red, C.amber], tooltip: { trigger: 'axis', valueFormatter: (v) => nn(v) ? Number(v).toLocaleString('zh-TW', { maximumFractionDigits: 2 }) : '—' }, legend: { data: ['目標', '實績', '當月達成率', '累積達成率'] }, grid: { right: 60 },
      xAxis: { type: 'category', data: mRows.map((r) => Number(r.month.slice(5)) + '月') },
      yAxis: [{ type: 'value', name: '萬元', axisLabel: { formatter: (v) => (v / 10000).toLocaleString() } }, { type: 'value', name: '%', scale: true, splitLine: { show: false } }],
      series: [{ name: '目標', type: 'bar', barMaxWidth: 22, data: mRows.map((r) => r.target) }, { name: '實績', type: 'bar', barMaxWidth: 22, data: mRows.map((r) => r.actual ? Math.round(r.actual) : null) },
        { name: '當月達成率', type: 'line', yAxisIndex: 1, data: mRows.map((r) => nn(r.rate) ? +(r.rate * 100).toFixed(2) : null) }, { name: '累積達成率', type: 'line', yAxisIndex: 1, lineStyle: { type: 'dashed' }, data: mRows.map((r) => nn(r.cumRate) ? +(r.cumRate * 100).toFixed(2) : null) }]
    });
    const rv = pRows.slice().reverse();
    chart(el.querySelector('#g2'), {
      tooltip: { trigger: 'axis', valueFormatter: (v) => nn(v) ? v.toFixed(2) + '%' : '—' }, grid: { left: 70, right: 50, top: 10, bottom: 24 },
      xAxis: { type: 'value', scale: true, axisLabel: { formatter: '{value}%' } }, yAxis: { type: 'category', data: rv.map((o) => o.plant) },
      series: [{ type: 'bar', barMaxWidth: 14, data: rv.map((o) => ({ value: nn(o.rate) ? +(o.rate * 100).toFixed(2) : null, itemStyle: { color: !nn(o.rate) ? C.gray : o.rate >= 1 ? C.navy : C.red } })), label: { show: true, position: 'right', fontSize: 10, formatter: (x) => x.value.toFixed(2) + '%' },
        markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: C.red }, label: { show: false }, data: [{ xAxis: 100 }] } }]
    });
    const qCols = qs.map((q) => ({ key: q, label: q + ' 達成率', num: true, html: (o) => o[q + 'na'] ? UI.pill('不適用', 'gray') : F.pct2(o[q]), sortVal: (o) => o[q], cls: (o, v) => rc(v) }));
    const t3 = table(el.querySelector('#g3'), {
      columns: [{ key: 'plant', label: '服務廠', sticky: true, html: (o) => '<b>' + esc(o.plant) + '</b>' + (o.na && o.plant !== '合計' ? ' ' + UI.pill('7–12月整併', 'gray') : '') }, { key: 'target', label: '累積目標', num: true, fmt: F.money }, { key: 'actual', label: '累積實績', num: true, fmt: F.money },
        { key: 'rate', label: '配對達成率', num: true, fmt: F.pct2, cls: (o, v) => rc(v) }, { key: 'diff', label: '配對差額', num: true, fmt: (v) => nn(v) ? (v > 0 ? '+' : '') + F.money(v) : '—', cls: (o, v) => nn(v) ? (v >= 0 ? 'cell-good' : 'cell-bad') : '' },
        { key: 'tAvg', label: '目標月平均', num: true, fmt: F.money }, { key: 'aAvg', label: '實績月平均', num: true, fmt: F.money }, { key: 'tMonths', label: '目標有效月', num: true }, { key: 'aMonths', label: '實績有效月', num: true }, { key: 'pairN', label: '配對月', num: true }]
        .concat(qCols).concat([{ key: 'qChange', label: last2.length === 2 ? last2[1] + '較' + last2[0] + '(pp)' : '季度變化', num: true, fmt: pp, cls: (o, v) => nn(v) ? (v >= 0 ? 'cell-good' : 'cell-bad') : '' }, { key: 'cover', label: '涵蓋期間', wrap: true }, { key: 'naMonths', label: '不適用月份' }]),
      rows: pRows, sortKey: 'rate', onRow: (o) => { S.filters.plant = o.plant; root.App.rerender(); }, avgRow: Object.assign({ plant: '合計', cover: '', naMonths: '' }, A, (() => { const o = {}; qs.forEach((q) => { o[q] = qAgg[q].rate; }); o.qChange = qChange; return o; })())
    });
    UI.bindExport(el, 'g3', '廠營收_服務廠', t3);
    const hm = []; pRows.forEach((o, y) => qs.forEach((q, x) => hm.push([x, y, o[q + 'na'] ? '-' : nn(o[q]) ? +(o[q] * 100).toFixed(2) : '-'])));
    chart(el.querySelector('#g4'), {
      tooltip: { formatter: (x) => pRows[x.data[1]].plant + '｜' + qs[x.data[0]] + '：' + (x.data[2] === '-' ? '不適用／無資料' : x.data[2].toFixed(2) + '%') }, grid: { left: 70, right: 20, top: 10, bottom: 30 },
      xAxis: { type: 'category', data: qs }, yAxis: { type: 'category', data: pRows.map((o) => o.plant) },
      visualMap: { min: 90, max: 115, show: false, inRange: { color: ['#c3002f', '#fde8ed', '#f8fafc', '#dbeafe', '#16294a'] } },
      series: [{ type: 'heatmap', data: hm, label: { show: true, fontSize: 10, formatter: (x) => x.data[2] === '-' ? '不適用' : x.data[2].toFixed(1) + '%' } }]
    });
    const t5 = table(el.querySelector('#g5'), {
      columns: [{ key: 'month', label: '月份' }, { key: 'q', label: '季度' }, { key: 'target', label: '目標', num: true, fmt: F.money }, { key: 'actual', label: '實績', num: true, fmt: F.money }, { key: 'pairN', label: '配對廠數', num: true },
        { key: 'rate', label: '當月配對達成率', num: true, fmt: F.pct2, cls: (o, v) => rc(v) }, { key: 'diff', label: '當月配對差額', num: true, fmt: (v) => nn(v) ? (v > 0 ? '+' : '') + F.money(v) : '—' }, { key: 'cumRate', label: '累積配對達成率', num: true, fmt: F.pct2 }, { key: 'na', label: '整併不適用（廠）', num: true }],
      rows: mRows, sortKey: 'month', sortDir: 1, footer: false
    });
    UI.bindExport(el, 'g5', '廠營收_月別', t5);
  };
})(window);
