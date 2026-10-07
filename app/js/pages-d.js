/* =========================================================================
 * 頁面 D：戰力總表（專家會同版）＋ CSI 人員滿意度問卷整合
 *  資料：本系統 Excel（戰力）＋ CSI 服務戰情系統問卷彙總（app/data/csi.js）
 * ========================================================================= */
(function (root) {
  const { Store, UI, Engine, PX } = root; const S = Store.S;
  const { F, esc, nn, table, chart, card, C } = UI; const mean = Engine.mean, sum = Engine.sum;
  const Pages = root.Pages;
  const { current, roleName, roleOn, TALENT_COLOR } = PX;
  const CSI = root.CSI_SUMMARY || null;
  const DIMS = [['o', '整體滿意'], ['r', '保修處理'], ['k', '結帳服務'], ['x', '交修說明'], ['l', '客休室']];

  /* ---------- CSI 問卷彙總 ---------- */
  function csiMonths(months) { if (!CSI) return []; return months.filter((m) => CSI.meta.months.indexOf(m) >= 0); }
  function csiAgg(fn, months) {
    if (!CSI) return null;
    const ms = csiMonths(months); if (!ms.length) return null;
    const rows = CSI.rows.filter((r) => ms.indexOf(r.m) >= 0 && fn(r));
    const n = sum(rows.map((r) => r.n)); if (!n) return { n: 0 };
    const o = { n, lo: sum(rows.map((r) => r.lo)), lk: sum(rows.map((r) => r.lk)), voc: sum(rows.map((r) => r.voc)) };
    DIMS.concat([['g', '平均']]).forEach(([d]) => { const c = sum(rows.map((r) => r[d + 'n'] || 0)); o[d] = c ? sum(rows.map((r) => r[d] || 0)) / c : null; });
    o.loRate = o.lo / n; o.lkRate = o.lk / n;
    return o;
  }
  const f2 = (v) => nn(v) ? v.toFixed(2) : '—';
  const csiCls = (v) => !nn(v) ? '' : v >= 4.95 ? 'cell-good' : v >= 4.85 ? '' : 'cell-bad';
  root.CSIX = { csiAgg, csiMonths, DIMS, f2, csiCls, has: () => !!CSI };

  /* ---------- 視覺小工具 ---------- */
  const bar = (v, max, color, txt) => !nn(v) ? '<span class="na">—</span>' :
    '<div class="ibar"><div class="ibar-t"><div class="ibar-f" style="width:' + Math.max(2, Math.min(100, v / max * 100)) + '%;background:' + color + '"></div></div><b>' + (txt || v.toFixed(1)) + '</b></div>';
  const powColor = (v) => !nn(v) ? 'var(--gray)' : v >= S.cfg.thresholds.highPower ? 'var(--good)' : v >= S.cfg.thresholds.midPower ? 'var(--navy-700)' : 'var(--bad)';
  const medal = (i) => i === 1 ? '🥇' : i === 2 ? '🥈' : i === 3 ? '🥉' : i;
  function strongWeak(p) {
    const d = S.cfg.dimensions[p.role].map((x) => ({ l: x.label.replace('PR', ''), v: p[x.prKey] })).filter((x) => nn(x.v)).sort((a, b) => b.v - a.v);
    return { s: d.length && d[0].v >= 0.5 ? d[0].l : '—', w: d.length && d[d.length - 1].v < 0.5 ? d[d.length - 1].l : '—' };
  }

  let bState = { who: 'all', n: 'all' };
  Pages.board = function (el, D) {
    const T = S.cfg.thresholds;
    const sa = current(D.people.SA).filter((p) => nn(p.power)), ca = current(D.people.CA).filter((p) => nn(p.power));
    const saAll = current(D.P.SA).filter((p) => nn(p.power)), caAll = current(D.P.CA).filter((p) => nn(p.power));
    const cms = csiMonths(D.months);
    const csiNote = !CSI ? '未載入問卷資料' : cms.length ? '問卷 ' + Store.monthLabel(cms) + '（CSI服務戰情系統，5分量尺）' : '所選期間無問卷資料（問卷至 ' + CSI.meta.months[CSI.meta.months.length - 1] + '）';
    const plantFilter = (r) => !S.filters.plant || r.p === S.filters.plant;
    const coCsi = csiAgg(plantFilter, D.months);

    /* ---- 1. 服務廠戰力 ---- */
    const ps = Store.plantStats(D).rows.filter((r) => r.saCount + r.caCount > 0);
    const prow = ps.map((r) => {
      const sp = r.saPeople.filter((p) => nn(p.power)), cp = r.caPeople.filter((p) => nn(p.power));
      const all = sp.concat(cp);
      const cs = csiAgg((x) => x.p === r.plant, D.months);
      return { plant: r.plant, power: all.length ? mean(all.map((p) => p.power)) : null, saPower: r.saPower, caPower: r.caPower, saCount: r.saCount, caCount: r.caCount, scored: all.length,
        high: all.filter((p) => p.power >= T.highPower).length, low: all.filter((p) => p.power < T.midPower).length, csiO: cs && cs.n ? cs.o : null, csiK: cs && cs.n ? cs.k : null, csiN: cs ? cs.n : null, note: r.note, sa: r.saPeople, ca: r.caPeople };
    });
    const ranked = prow.filter((r) => nn(r.power)).sort((a, b) => b.power - a.power); ranked.forEach((r, i) => { r.rank = i + 1; });
    const coPower = mean(saAll.concat(caAll).map((p) => p.power));

    /* ---- 2. 個人全排名 ---- */
    const everyone = sa.concat(ca).slice().sort((a, b) => b.power - a.power);
    everyone.forEach((p, i) => { p._all = i + 1; });
    const csiOf = {};
    if (CSI) sa.forEach((p) => { csiOf[p.id] = csiAgg((x) => x.a === p.name, D.months); });

    /* ---- 3. 出納貢獻 ---- */
    const caRows = S.model.caMonthly.filter((r) => D.months.indexOf(r.month) >= 0);
    const plantOrders = {}; caRows.forEach((r) => { if (nn(r.orders)) plantOrders[r.actualPlant] = (plantOrders[r.actualPlant] || 0) + r.orders; });
    const ro = {}; Store.plantStats(D, { all: true }).rows.forEach((r) => { ro[r.plant] = r; });
    const cashiers = current(D.people.CA).map((p) => {
      const mine = sum(p.monthly.filter((r) => D.months.indexOf(r.month) >= 0 && r.actualPlant === p.plant && nn(r.orders)).map((r) => r.orders));
      const tot = plantOrders[p.plant] || 0;
      const pr = ro[p.plant] || {};
      const cs = csiAgg((x) => x.p === p.plant, D.months);
      return { p, share: tot ? mine / tot : null, orders: p.totalOrders, avg: p.avgOrders, ratio: pr.caCount ? pr.saCount / pr.caCount : null, esign: p.esign, card: p.card, power: p.power, csiK: cs && cs.n ? cs.k : null, lkRate: cs && cs.n ? cs.lkRate : null };
    });

    const top = (l) => l.slice().sort((a, b) => b.power - a.power)[0];
    const tSa = top(sa), tCa = top(ca), tPl = ranked[0];
    const tile = (lbl, big, sub, color) => '<div class="bt"><span>' + lbl + '</span><b style="color:' + (color || 'var(--ink)') + '">' + big + '</b><em>' + sub + '</em></div>';

    el.innerHTML = '<div class="page-head"><div><h1>戰力總表｜專家會同版</h1><p>期間 ' + Store.monthLabel(D.months) + (S.filters.plant ? '｜' + esc(S.filters.plant) : '｜全公司') + '　一頁看懂：服務廠戰力 → 個人全排名 → 出納貢獻 → 顧客滿意</p></div>' +
      '<div style="display:flex;gap:6px"><button class="btn" onclick="window.print()">🖨 列印會議版</button></div></div>' +
      '<div class="guide"><b>怎麼讀</b><span>① <b>綜合戰力</b>0–100：同職務現行人員中的相對位置（量能、效率、品質、作業加權），≥' + T.highPower + ' 高、' + T.midPower + '–' + (T.highPower - 0.01) + ' 中、<' + T.midPower + ' 低。</span><span>② <b>廠戰力</b>＝該廠現行服專＋出納綜合戰力平均（依人數）。</span><span>③ <b>顧客滿意</b>取自 ' + esc(csiNote) + '。</span><span>④ 綜合戰力為管理診斷，非正式考核分數。</span></div>' +
      '<div class="btiles">' +
      tile('全公司平均戰力', F.score(coPower), '現行 ' + (saAll.length + caAll.length) + ' 人計分', powColor(coPower)) +
      tile('戰力第一服務廠', tPl ? esc(tPl.plant) : '—', tPl ? '廠戰力 ' + F.score(tPl.power) : '', 'var(--navy-700)') +
      tile('服專戰力第一', tSa ? esc(tSa.name) : '—', tSa ? esc(tSa.plant) + '｜' + F.score(tSa.power) + ' 分' : '', 'var(--navy-700)') +
      tile('出納戰力第一', tCa ? esc(tCa.name) : '—', tCa ? esc(tCa.plant) + '｜' + F.score(tCa.power) + ' 分' : '', 'var(--navy-700)') +
      tile('顧客整體滿意', coCsi && coCsi.n ? f2(coCsi.o) : '—', coCsi && coCsi.n ? coCsi.n.toLocaleString() + ' 份問卷｜結帳服務 ' + f2(coCsi.k) : '問卷資料未提供', coCsi && coCsi.n ? (coCsi.o >= 4.95 ? 'var(--good)' : coCsi.o >= 4.85 ? 'var(--warn)' : 'var(--bad)') : 'var(--gray)') +
      '</div>' +
      '<div class="section-title">① 服務廠戰力排名</div>' +
      '<div class="grid g2b">' + card('廠戰力（服專＋出納）', '<div class="chart tall" id="bc1"></div>', { sub: '紅虛線＝全公司平均 ' + F.score(coPower) }) +
      card('服務廠排名表', '<div id="bt1"></div>', { flush: true, tools: UI.exportBtns('bt1'), sub: '點列看該廠人員' }) + '</div>' +
      '<div class="section-title">② 個人戰力全排名</div>' +
      card('全排名', '<div style="display:flex;gap:8px;flex-wrap:wrap;padding:10px 14px 0">' + UI.seg('bwho', [['all', '服專＋出納'], ['SA', '服專'], ['CA', '出納']], bState.who) + UI.seg('bn', [['10', 'Top 10'], ['20', 'Top 20'], ['all', '全部']], bState.n) + '<span class="note" style="align-self:center">合併排名僅供概覽；職務內排名才是同職務比較</span></div><div id="bt2"></div>', { flush: true, tools: UI.exportBtns('bt2') }) +
      '<div class="section-title">③ 出納貢獻</div>' +
      '<div class="grid g2b">' + card('各廠結帳量由誰承接', '<div class="chart" id="bc3"></div>', { sub: '依當月實際廠別之結帳工單；灰色＝其他／支援；滑過看明細' }) +
      card('出納貢獻明細', '<div id="bt3"></div>', { flush: true, tools: UI.exportBtns('bt3'), sub: '占廠結帳比＝本人在所屬廠結帳 ÷ 該廠全部結帳' }) + '</div>' +
      '<div class="section-title">④ 顧客滿意（人員滿意度問卷）</div>' +
      (cms.length ? '<div class="grid g2b">' + card('各廠問卷滿意度', '<div id="bt4"></div>', { flush: true, tools: UI.exportBtns('bt4'), sub: '≥4.95 綠、<4.85 紅；未滿分率＝整體<5分比例' }) +
        card('服專問卷排名', '<div id="bt5"></div>', { flush: true, tools: UI.exportBtns('bt5'), sub: '問卷 ≥ ' + T.csiMinSurveys + ' 份者排名' }) + '</div><div style="height:12px"></div>' +
        card('顧客意見（VOC）', '<div id="bt6"></div>', { flush: true, tools: UI.exportBtns('bt6'), sub: '2026 年有文字意見之問卷' }) : '<div class="banner info"><b>顧客滿意</b><span>' + esc(csiNote) + '</span></div>');

    /* ⑤ 服專定保保留率（接待保留率）＋ CRM 追蹤 */
    const RX = root.RETX;
    if (RX && RX.ret && RX.ret()) {
      const pl = RX.plantRet().filter((p) => p.inScope && (!S.filters.plant || p.plant === S.filters.plant)).sort((a, b) => b.plantRate - a.plantRate);
      const coR = RX.companyRet(RX.plantRet());
      const advs = RX.ret().advisors.filter((a) => (!S.filters.plant || a.plant === S.filters.plant)).map((a) => Object.assign({}, a, { p: D.P.SA.find((x) => x.name === a.advisor) }));
      const ng = advs.filter((a) => a.ng);
      const cr = RX.scoped(D), cst = cr && cr.rows.length ? RX.stats(cr.rows) : null;
      const sec = document.createElement('div');
      sec.innerHTML = '<div class="section-title">⑤ 服專定保保留率（CY25 → CY26）</div><div class="grid g2b">' +
        card('各廠定保保留率', '<div id="bt7"></div>', { flush: true, sub: '範圍廠別加權 ' + F.pct2(coR), tools: '<a class="btn sm" href="#/retention">完整分析 →</a>' }) +
        card('保留率 NG 服專（較所屬廠低 3pp 以上）', '<div id="bt8"></div>', { flush: true, sub: ng.length + ' 列' + (cst ? '｜CRM 查詢（' + esc(RX.coverage(cr).plants.join('、')) + '）可聯繫待追蹤 ' + cst.follow + ' 位' : '') }) + '</div>';
      el.appendChild(sec);
      table(sec.querySelector('#bt7'), {
        columns: [{ key: 'rk', label: '名次', num: true, get: (p) => pl.indexOf(p) + 1, html: (p) => '<b>' + medal(pl.indexOf(p) + 1) + '</b>' }, { key: 'plant', label: '服務廠', html: (p) => '<b>' + esc(p.plant) + '</b>' },
          { key: 'plantRate', label: '廠定保保留率', html: (p) => bar(p.plantRate * 100, 100, nn(coR) && p.plantRate >= coR ? 'var(--navy-700)' : 'var(--bad)', F.pct2(p.plantRate)), sortVal: (p) => p.plantRate },
          { key: 'target', label: 'CY26對象', num: true, fmt: F.int }, { key: 'ng', label: 'NG服專', num: true, cls: (p, v) => v ? 'cell-bad' : '' }],
        rows: pl, sortKey: 'rk', sortDir: 1, short: true
      });
      table(sec.querySelector('#bt8'), {
        columns: [{ key: 'plant', label: '服務廠' }, { key: 'advisor', label: '服專', html: (a) => a.p ? UI.nameLink(a.p) : esc(a.advisor) + ' <span class="note">（總覽無此人）</span>' },
          { key: 'rate', label: '服專保留率', num: true, fmt: F.pct2, cls: () => 'cell-bad' }, { key: 'plantRate', label: '廠保留率', num: true, fmt: F.pct2 },
          { key: 'vsPlant', label: 'vs 廠（pp）', num: true, fmt: (v) => nn(v) ? (v * 100).toFixed(2) : '—' }, { key: 'target', label: 'CY26對象', num: true, fmt: F.int }],
        rows: ng, sortKey: 'vsPlant', sortDir: 1, short: true
      });
    }

    /* 圖 1：廠戰力 */
    const rv = ranked.slice().reverse();
    chart(el.querySelector('#bc1'), {
      color: [C.navy, C.sky, C.red], legend: { data: ['廠戰力', '服專平均', '出納平均'] }, tooltip: { trigger: 'axis', valueFormatter: (v) => nn(v) ? v.toFixed(1) : '—' },
      grid: { left: 70, right: 40, top: 30, bottom: 20 }, xAxis: { type: 'value', max: 100 }, yAxis: { type: 'category', data: rv.map((r) => r.rank + '. ' + r.plant) },
      series: [{ name: '廠戰力', type: 'bar', barMaxWidth: 14, data: rv.map((r) => ({ value: +r.power.toFixed(1), itemStyle: { color: r.power >= T.highPower ? C.green : r.power >= T.midPower ? C.navy : C.red } })), label: { show: true, position: 'right', fontSize: 10 },
        markLine: { silent: true, symbol: 'none', data: [{ xAxis: +coPower.toFixed(1) }], lineStyle: { color: C.red, type: 'dashed' }, label: { show: false } } },
      { name: '服專平均', type: 'scatter', symbol: 'diamond', symbolSize: 9, data: rv.map((r) => nn(r.saPower) ? +r.saPower.toFixed(1) : null), itemStyle: { color: '#60a5fa' } },
      { name: '出納平均', type: 'scatter', symbol: 'triangle', symbolSize: 9, data: rv.map((r) => nn(r.caPower) ? +r.caPower.toFixed(1) : null), itemStyle: { color: C.red } }]
    });
    const t1 = table(el.querySelector('#bt1'), {
      columns: [{ key: 'rank', label: '名次', num: true, html: (r) => nn(r.rank) ? '<b>' + medal(r.rank) + '</b>' : '—' }, { key: 'plant', label: '服務廠', html: (r) => '<b>' + esc(r.plant) + '</b>' },
        { key: 'power', label: '廠戰力', html: (r) => bar(r.power, 100, powColor(r.power)), sortVal: (r) => r.power }, { key: 'saPower', label: '服專', num: true, fmt: F.score, cls: (r, v) => PX.colorCell('power', v) }, { key: 'caPower', label: '出納', num: true, fmt: F.score, cls: (r, v) => PX.colorCell('power', v) },
        { key: 'staff', label: '人力 服專/出納', get: (r) => r.saCount + ' / ' + r.caCount, sortVal: (r) => r.saCount + r.caCount }, { key: 'high', label: '高戰力', num: true }, { key: 'low', label: '低戰力', num: true, cls: (r, v) => v ? 'cell-bad' : '' },
        { key: 'csiO', label: '顧客整體', num: true, fmt: f2, cls: (r, v) => csiCls(v) }, { key: 'csiK', label: '結帳服務', num: true, fmt: f2, cls: (r, v) => csiCls(v) }, { key: 'note', label: '提醒', html: (r) => r.note ? UI.pill(r.note, /0人/.test(r.note) ? 'red' : 'yellow') : '' }],
      rows: prow, sortKey: 'rank', sortDir: 1, short: true, onRow: (r) => drillPlant(r)
    });
    UI.bindExport(el, 'bt1', '服務廠戰力排名', t1);
    function drillPlant(r) {
      const l = r.sa.concat(r.ca).filter((p) => roleOn(p.role));
      UI.modal(r.plant + '｜人員戰力（' + l.length + '人）', '<div id="dp"></div>', (b) => table(b.querySelector('#dp'), {
        columns: [{ key: 'role', label: '角色', get: (p) => roleName(p.role) }, { key: 'name', label: '姓名', html: (p) => UI.nameLink(p) }, { key: 'license', label: '證照' },
          { key: 'power', label: '綜合戰力', html: (p) => bar(p.power, 100, powColor(p.power)), sortVal: (p) => p.power }, { key: 'rank', label: '職務內排名', num: true, html: (p) => nn(p.rank) ? p.rank + ' / ' + (p.role === 'SA' ? saAll : caAll).length : '—', sortVal: (p) => p.rank },
          { key: 'all', label: '全排名', num: true, get: (p) => p._all }, { key: 'talentType', label: '人才類型', html: (p, v) => UI.pill(v, TALENT_COLOR[v]) }], rows: l, sortKey: 'power', short: true
      }));
    }

    /* 表 2：全排名 */
    const draw2 = () => {
      let l = everyone.filter((p) => bState.who === 'all' || p.role === bState.who);
      if (bState.n !== 'all') l = l.slice(0, Number(bState.n));
      const t2 = table(el.querySelector('#bt2'), {
        columns: [{ key: '_all', label: '全排名', num: true, html: (p) => '<b>' + medal(p._all) + '</b>', sortVal: (p) => p._all }, { key: 'rank', label: '職務內排名', num: true, html: (p) => p.rank + ' / ' + (p.role === 'SA' ? saAll : caAll).length, sortVal: (p) => p.rank },
          { key: 'name', label: '姓名', sticky: true, html: (p) => UI.nameLink(p) }, { key: 'role', label: '角色', get: (p) => roleName(p.role) }, { key: 'plant', label: '服務廠' }, { key: 'license', label: '證照' },
          { key: 'power', label: '綜合戰力', html: (p) => bar(p.power, 100, powColor(p.power)), sortVal: (p) => p.power }, { key: 'talentType', label: '人才類型', html: (p, v) => UI.pill(v, TALENT_COLOR[v]) },
          { key: 'vol', label: '月均量能', num: true, get: (p) => p.role === 'SA' ? p.avgCars : p.avgOrders, html: (p) => F.int(p.role === 'SA' ? p.avgCars : p.avgOrders) + '<small class="note"> ' + (p.role === 'SA' ? '台' : '張') + '</small>' },
          { key: 'cs', label: '顧客整體（份）', num: true, get: (p) => csiOf[p.id] && csiOf[p.id].n ? csiOf[p.id].o : null, html: (p) => { const c = csiOf[p.id]; return c && c.n ? f2(c.o) + '<small class="note">（' + c.n + '）</small>' : '—'; }, cls: (p, v) => csiCls(v) },
          { key: 'sw', label: '強項／短板', get: (p) => { const x = strongWeak(p); return x.s + '／' + x.w; }, html: (p) => { const x = strongWeak(p); return '<span class="up">▲' + x.s + '</span>　<span class="down">▼' + x.w + '</span>'; } }],
        rows: l, sortKey: '_all', sortDir: 1, onRow: (p) => root.App.openPerson(p.id)
      });
      UI.bindExport(el, 'bt2', '個人戰力全排名', t2);
    };
    draw2();
    UI.bindSeg(el, 'bwho', (v) => { bState.who = v; root.App.render(); });
    UI.bindSeg(el, 'bn', (v) => { bState.n = v; root.App.render(); });

    /* 圖 3 / 表 3：出納貢獻 */
    const plants3 = Array.from(new Set(cashiers.map((c) => c.p.plant)));
    const names3 = cashiers.map((c) => c.p.name);
    const byPlant = {}; caRows.forEach((r) => { if (plants3.indexOf(r.actualPlant) < 0 || !nn(r.orders)) return; const k = names3.indexOf(r.name) >= 0 && cashiers.find((c) => c.p.name === r.name).p.plant === r.actualPlant ? r.name : '其他／支援'; byPlant[r.actualPlant] = byPlant[r.actualPlant] || {}; byPlant[r.actualPlant][k] = (byPlant[r.actualPlant][k] || 0) + r.orders; });
    const seriesNames = names3.concat(['其他／支援']);
    const pal = ['#16294a', '#3b82f6', '#93c5fd', '#0f766e', '#c3002f'];
    const plTot = {}; plants3.forEach((pl) => { plTot[pl] = sum(Object.values(byPlant[pl] || {})); });
    const bc3 = el.querySelector('#bc3'); bc3.style.height = Math.max(300, plants3.length * 34 + 40) + 'px';
    chart(bc3, {
      legend: { show: false },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (xs) => xs[0].axisValue + '<br>' + xs.filter((x) => x.value).map((x) => x.marker + x.seriesName + '：' + Number(x.value).toLocaleString() + ' 張').join('<br>') },
      grid: { left: 70, right: 20, top: 16, bottom: 20 }, xAxis: { type: 'value' }, yAxis: { type: 'category', data: plants3.slice().reverse() },
      series: seriesNames.map((n) => {
        const me = cashiers.find((c) => c.p.name === n);
        const idx = me ? cashiers.filter((c) => c.p.plant === me.p.plant).indexOf(me) : -1;
        return { name: n, type: 'bar', stack: 's', barMaxWidth: 16, itemStyle: { color: n === '其他／支援' ? '#d1d5db' : pal[idx % pal.length], borderColor: '#fff', borderWidth: 1 }, data: plants3.slice().reverse().map((pl) => (byPlant[pl] || {})[n] || null),
          label: { show: true, formatter: (x) => x.value && n !== '其他／支援' && x.value / (plTot[x.name] || 1) >= 0.18 ? n : '', fontSize: 11, color: idx >= 2 ? '#111' : '#fff', overflow: 'truncate' } };
      })
    });
    const t3 = table(el.querySelector('#bt3'), {
      columns: [{ key: 'plant', label: '服務廠', get: (c) => c.p.plant }, { key: 'name', label: '出納', get: (c) => c.p.name, html: (c) => UI.nameLink(c.p) }, { key: 'license', label: '證照', get: (c) => c.p.license },
        { key: 'orders', label: '結帳工單', num: true, fmt: F.int }, { key: 'share', label: '占廠結帳比', html: (c) => bar(nn(c.share) ? c.share * 100 : null, 100, 'var(--navy-700)', F.pct(c.share)), sortVal: (c) => c.share },
        { key: 'avg', label: '月均結帳', num: true, fmt: F.int }, { key: 'ratio', label: '1出納對應服專', num: true, fmt: (v) => nn(v) ? v.toFixed(1) + ' 人' : '—' }, { key: 'esign', label: '電子簽名', num: true, fmt: F.pct }, { key: 'card', label: '感心卡', num: true, fmt: F.d2 },
        { key: 'power', label: '出納戰力', num: true, fmt: F.score, cls: (c, v) => PX.colorCell('power', v) }, { key: 'csiK', label: '所屬廠結帳服務滿意', num: true, fmt: f2, cls: (c, v) => csiCls(v) }, { key: 'lkRate', label: '結帳未滿分率', num: true, fmt: F.pct }],
      rows: cashiers, sortKey: 'orders', short: true, onRow: (c) => root.App.openPerson(c.p.id)
    });
    UI.bindExport(el, 'bt3', '出納貢獻', t3);

    /* 表 4-6：問卷 */
    if (cms.length) {
      const pl = Array.from(new Set(CSI.rows.filter((r) => cms.indexOf(r.m) >= 0 && plantFilter(r)).map((r) => r.p)));
      const p4 = pl.map((p) => Object.assign({ plant: p }, csiAgg((x) => x.p === p, D.months))).sort((a, b) => b.o - a.o);
      const c4 = [{ key: 'plant', label: '服務廠', html: (r) => '<b>' + esc(r.plant) + '</b>' }, { key: 'n', label: '問卷數', num: true, fmt: F.int }]
        .concat(DIMS.map(([d, l]) => ({ key: d, label: l, num: true, fmt: f2, cls: (r, v) => csiCls(v) })))
        .concat([{ key: 'loRate', label: '整體未滿分率', num: true, fmt: F.pct, cls: (r, v) => v > 0.1 ? 'cell-bad' : '' }, { key: 'voc', label: '文字意見', num: true }]);
      const t4 = table(el.querySelector('#bt4'), { columns: c4, rows: p4, sortKey: 'o', short: true, avgRow: Object.assign({ plant: '合計' }, coCsi) });
      UI.bindExport(el, 'bt4', '各廠問卷滿意度', t4);
      const p5 = current(D.people.SA).map((p) => ({ p, c: csiAgg((x) => x.a === p.name, D.months) })).filter((x) => x.c && x.c.n >= T.csiMinSurveys)
        .map((x) => Object.assign({ p: x.p }, x.c)).sort((a, b) => b.o - a.o || b.n - a.n);
      p5.forEach((r, i) => { r.rk = i + 1; });
      const t5 = table(el.querySelector('#bt5'), {
        columns: [{ key: 'rk', label: '名次', num: true }, { key: 'name', label: '服專', get: (r) => r.p.name, html: (r) => UI.nameLink(r.p) }, { key: 'plant', label: '服務廠', get: (r) => r.p.plant }, { key: 'n', label: '問卷數', num: true },
          { key: 'o', label: '整體', num: true, fmt: f2, cls: (r, v) => csiCls(v) }, { key: 'x', label: '交修說明', num: true, fmt: f2, cls: (r, v) => csiCls(v) }, { key: 'r', label: '保修處理', num: true, fmt: f2, cls: (r, v) => csiCls(v) }, { key: 'loRate', label: '未滿分率', num: true, fmt: F.pct },
          { key: 'power', label: '綜合戰力', num: true, get: (r) => r.p.power, fmt: F.score }],
        rows: p5, sortKey: 'rk', sortDir: 1, short: true, onRow: (r) => root.App.openPerson(r.p.id)
      });
      UI.bindExport(el, 'bt5', '服專問卷排名', t5);
      const v6 = CSI.voc.filter((v) => cms.indexOf(v.m) >= 0 && plantFilter(v) && (!S.filters.name || String(v.a).indexOf(S.filters.name) >= 0));
      const t6 = table(el.querySelector('#bt6'), {
        columns: [{ key: 'm', label: '月份' }, { key: 'p', label: '服務廠' }, { key: 'a', label: '服專' }, { key: 'o', label: '整體', num: true, fmt: (v) => nn(v) ? v.toFixed(0) : '—', cls: (r, v) => v < 5 ? 'cell-bad' : '' }, { key: 'k', label: '結帳', num: true, fmt: (v) => nn(v) ? v.toFixed(0) : '—', cls: (r, v) => v < 5 ? 'cell-bad' : '' }, { key: 'vc', label: '類別' }, { key: 'v', label: '顧客意見', wrap: true }],
        rows: v6, sortKey: 'o', sortDir: 1, short: true
      });
      UI.bindExport(el, 'bt6', '顧客意見VOC', t6);
    }
  };
})(window);
