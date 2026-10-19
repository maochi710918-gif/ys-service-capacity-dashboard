/* =========================================================================
 * 頁面 I：招攬與 CSI
 *  ① 招攬分析：服專 7 項（美容、裕信護照、裕日護照密度、S餐油品、化品OK、NVS、自費鈑噴）各 1/7，招攬占總戰力 20%
 *              出納 2 項（裕信、裕日護照每100張結帳工單本數）各 50%，招攬占總戰力 10%；本數與工單分母同涵蓋月份
 *  ② CSI 雙提醒：低於 980 分；當月較前月下降（≥5 且 <10 黃燈、≥10 紅燈）；缺月不補零、不跳月比較
 *  ③ 招攬 × CSI 交叉檢視：共同涵蓋月份；中性描述，不設象限門檻
 * ========================================================================= */
(function (root) {
  const { Store, UI, Engine, PX } = root; const S = Store.S;
  const { F, esc, nn, kpi, table, chart, card, C } = UI; const mean = Engine.mean;
  const Pages = root.Pages;
  const RN = (r) => (r === 'SA' ? '服專' : '出納');
  const CSI_TH = { low: 980, yellow: 5, red: 10 };

  // 招攬項目定義（實績、適用目標、達成率／密度、單項PR、資料月份）
  const ITEMS = {
    SA: [
      { k: 'beauty', n: '美容達成率', act: 'beautyPA', tgt: 'beautyPT', rate: 'beautyRate', pr: 'prBeauty', mon: 'beautyMonths', kind: '達成率', fmt: F.pct2, unit: '元' },
      { k: 'ys', n: '裕信護照達成率', act: 'ysBooks', tgt: 'ysTarget', rate: 'ysRate', pr: 'prYs', mon: 'ysMonths', kind: '達成率', fmt: F.pct2, unit: '本' },
      { k: 'yr', n: '裕日護照每100台接車本數', act: 'yrBooks', tgt: null, base: 'yrBase', rate: 'yrPer100', pr: 'prYr', mon: 'yrMonths', kind: '密度', fmt: F.d2, unit: '本' },
      { k: 'oil', n: 'S餐油品使用率', act: 'oilUsed', base: 'oilBase', rate: 'oilRate', pr: 'prOil', mon: 'oilMonths', kind: '使用率', fmt: F.pct2, unit: '台' },
      { k: 'chem', n: '化學品OK率', act: 'chemOk', base: 'chemBase', rate: 'chemRate', pr: 'prChem', mon: 'chemMonths', kind: 'OK率', fmt: F.pct2, unit: '台' },
      { k: 'nvs', n: 'NVS達成率', act: 'nvs', tgt: 'nvsTarget', rate: 'nvsRate', pr: 'prNvs', mon: 'nvsMonths', kind: '達成率', fmt: F.pct2, unit: '元' },
      { k: 'body', n: '自費鈑噴營收達成率', act: null, rate: 'bodyRate', pr: 'prBody', mon: null, kind: '達成率', fmt: F.pct2 }
    ],
    CA: [
      { k: 'ys', n: '裕信護照每100張工單本數', act: 'ysBooks', base: 'ysBase', rate: 'ysPer100', pr: 'prYs', mon: 'ysMonths', kind: '密度', fmt: F.d2, unit: '本' },
      { k: 'yr', n: '裕日護照每100張工單本數', act: 'yrBooks', base: 'yrBase', rate: 'yrPer100', pr: 'prYr', mon: 'yrMonths', kind: '密度', fmt: F.d2, unit: '本' }
    ]
  };
  const solOf = (p) => (S.model.solicit || []).find((r) => r.name === p.name && r.roleName === RN(p.role)) || {};
  // 個人招攬明細（供個人分析／本頁共用）
  function solicitRows(p) {
    const s = solOf(p), w = S.cfg.weights[p.role].solicit || 0, items = ITEMS[p.role], each = 1 / items.length;
    return items.map((it) => {
      const pr = nn(s[it.pr]) ? s[it.pr] : null;
      return { item: it.n, kind: it.kind, act: it.act ? s[it.act] : null, unit: it.unit, tgt: it.tgt ? s[it.tgt] : null, base: it.base ? s[it.base] : null,
        rate: it.k === 'body' && !nn(s.bodyRate) ? p.excel && p.excel.bodyPaint : s[it.rate], fmt: it.fmt, pr, share: each,
        dimPR: p.prSolicit, weighted: nn(pr) ? pr * each * w * 100 : null, months: it.mon ? s[it.mon] : (s.serviceMonths || null), coverage: s.coverage };
    });
  }
  root.SOLX = { solicitRows, ITEMS, solOf };

  /* CSI 雙提醒（月度明細，依角色） */
  function csiAlerts(role, D) {
    const rows = (role === 'SA' ? S.model.saMonthly : S.model.caMonthly).filter((r) => D.months.indexOf(r.month) >= 0);
    const names = new Set(PX.current(D.people[role]).map((p) => p.name));
    const allMs = Store.allMonths(); const out = [];
    const by = {}; rows.forEach((r) => { if (names.has(r.name)) (by[r.name] = by[r.name] || []).push(r); });
    Object.keys(by).forEach((n) => {
      const p = D.P[role].find((x) => x.name === n);
      const rs = by[n].slice().sort((a, b) => (a.month < b.month ? -1 : 1));
      rs.forEach((r) => {
        if (!nn(r.csi)) return;
        if (r.csi < CSI_TH.low) out.push({ p, month: r.month, type: '低於980', csi: r.csi, prev: null, drop: null, level: 'red', plant: r.actualPlant });
        const pm = allMs[allMs.indexOf(r.month) - 1];
        const prev = rs.find((x) => x.month === pm);           // 只比較緊鄰前月，缺月不跳月
        if (prev && nn(prev.csi)) { const d = prev.csi - r.csi; if (d >= CSI_TH.yellow) out.push({ p, month: r.month, type: '較前月下降', csi: r.csi, prev: prev.csi, drop: d, level: d >= CSI_TH.red ? 'red' : 'yellow', plant: r.actualPlant }); }
      });
    });
    return out;
  }
  root.CSIA = { csiAlerts, CSI_TH };

  /* 四構面負荷比較：日均標準落差、廠內負荷占比、公司同職務貢獻、同證照量能 */
  const STD = { SA: 11.5, CA: 23 };
  function loadOf(p, D) {
    const rn = RN(p.role), ms = D.months;
    const ls = (S.model.loadShare || []).filter((r) => r.roleName === rn && ms.indexOf(r.month) >= 0);
    const mine = ls.filter((r) => r.name === p.name && nn(r.work));
    const work = Engine.sum(mine.map((r) => r.work));
    const main = mine.filter((r) => r.tag === '主廠');
    const plantShare = main.length ? Engine.sum(main.map((r) => r.work)) / Engine.sum(main.map((r) => r.plantTotal || 0)) : null;
    // 公司同職務總量：每月×廠 只取一次廠內同業務個人量合計（含歷史人員，全期工作量不因現職名單縮小）
    const seen = {}; let coTotal = 0; ls.forEach((r) => { const k = r.month + '|' + r.plant; if (!seen[k] && nn(r.plantTotal)) { seen[k] = 1; coTotal += r.plantTotal; } });
    const daily = p.excel ? p.excel.dailyBase : null;
    const peers = PX.current(D.people[p.role]).filter((q) => q.license && q.license === p.license && q.excel && nn(q.excel.dailyBase));
    const licAvg = peers.length > 1 ? mean(peers.map((q) => q.excel.dailyBase)) : null;
    return { months: new Set(mine.map((r) => r.month)).size, work, std: STD[p.role], daily, dailyGap: nn(daily) ? daily - STD[p.role] : null, dailyRatio: nn(daily) ? daily / STD[p.role] : null,
      plantShare: nn(plantShare) && isFinite(plantShare) ? plantShare : null, mainPlants: Array.from(new Set(main.map((r) => r.plant))).join('、'), support: mine.filter((r) => r.tag !== '主廠').length,
      coShare: coTotal && mine.length ? work / coTotal : null, coTotal, licAvg, licN: peers.length, licRatio: nn(daily) && nn(licAvg) && licAvg ? daily / licAvg : null };
  }
  root.LOADX = { loadOf, STD };

  function loadTab(el, D, role, cur) {
    const rows = cur.map((p) => Object.assign({ p, plant: p.plant, name: p.name, license: p.license }, loadOf(p, D)));
    const u = role === 'SA' ? '台' : '張';
    el.innerHTML = '<div class="guide"><b>四構面</b><span>① 日均標準落差：公司基準日均量 − 標準（' + (role === 'SA' ? '服專 11.5 台／日' : '出納 23 張／日') + '）</span><span>② 廠內負荷占比：主廠月份 本人承接量 ÷ 廠內同業務個人量合計</span><span>③ 公司同職務貢獻：本人承接量 ÷ 全公司同職務承接量（含歷史人員）</span><span>④ 同證照量能：本人日均 ÷ 同證照現職平均（同證照僅 1 人不比較）</span></div>' +
      '<div class="kpis">' + kpi({ noPrev: true, companyFmt: F.int, label: '達日均標準人數', value: rows.filter((r) => nn(r.dailyGap) && r.dailyGap >= 0).length, cur: rows.filter((r) => nn(r.dailyGap)).length, curFmt: F.int, curLabel: '有日均資料', light: 'blue' }) +
      kpi({ noPrev: true, companyFmt: F.int, label: '平均日均量', value: mean(rows.map((r) => r.daily)), fmt: F.d2, cur: STD[role], curFmt: F.d1, curLabel: '標準', light: 'blue' }) +
      kpi({ noPrev: true, companyFmt: F.int, label: '有跨廠支援人數', value: rows.filter((r) => r.support > 0).length, light: 'blue' }) + '</div>' +
      '<div class="grid g2" style="margin-top:12px">' + card('日均量 vs 標準', '<div class="chart tall" id="l1"></div>', { sub: '虛線＝標準 ' + STD[role] + ' ' + u + '／日' }) + card('公司同職務貢獻占比', '<div class="chart tall" id="l2"></div>') + '</div><div style="height:12px"></div>' +
      card('負荷比較明細', '<div id="l3"></div>', { flush: true, tools: UI.exportBtns('l3') });
    const a = rows.filter((r) => nn(r.daily)).sort((x, y) => x.daily - y.daily);
    chart(el.querySelector('#l1'), { tooltip: { trigger: 'axis' }, grid: { left: 90, right: 50, top: 10, bottom: 20 }, xAxis: { type: 'value' }, yAxis: { type: 'category', data: a.map((r) => r.name), axisLabel: { fontSize: 10 } },
      dataZoom: a.length > 25 ? [{ type: 'slider', yAxisIndex: 0, right: 0, width: 12, start: 50, end: 100 }] : undefined,
      series: [{ type: 'bar', barMaxWidth: 12, data: a.map((r) => ({ value: +r.daily.toFixed(2), itemStyle: { color: r.dailyGap >= 0 ? C.navy : C.gray } })), label: { show: true, position: 'right', fontSize: 9 }, markLine: { symbol: 'none', lineStyle: { type: 'dashed', color: C.red }, data: [{ xAxis: STD[role] }], label: { formatter: '標準 ' + STD[role] } } }] });
    const b = rows.filter((r) => nn(r.coShare)).sort((x, y) => x.coShare - y.coShare);
    chart(el.querySelector('#l2'), { tooltip: { trigger: 'axis' }, grid: { left: 90, right: 50, top: 10, bottom: 20 }, xAxis: { type: 'value', axisLabel: { formatter: (v) => (v * 100).toFixed(1) + '%' } }, yAxis: { type: 'category', data: b.map((r) => r.name), axisLabel: { fontSize: 10 } },
      dataZoom: b.length > 25 ? [{ type: 'slider', yAxisIndex: 0, right: 0, width: 12, start: 50, end: 100 }] : undefined,
      series: [{ type: 'bar', barMaxWidth: 12, data: b.map((r) => +r.coShare.toFixed(4)), itemStyle: { color: C.navy2 }, label: { show: true, position: 'right', fontSize: 9, formatter: (x) => (x.value * 100).toFixed(2) + '%' } }] });
    const t = table(el.querySelector('#l3'), { columns: [{ key: 'plant', label: '廠別', group: '人員' }, { key: 'name', label: '姓名', sticky: true, html: (r) => UI.nameLink(r.p), group: '人員' }, { key: 'license', label: '證照', group: '人員' },
      { key: 'daily', label: '日均量', num: true, fmt: F.d2, group: '① 日均標準落差' }, { key: 'dailyGap', label: '與標準差', num: true, fmt: F.signed1, cls: (r, v) => nn(v) ? (v >= 0 ? 'cell-good' : 'cell-bad') : '', group: '① 日均標準落差' }, { key: 'dailyRatio', label: '標準達成', num: true, fmt: F.pct0, group: '① 日均標準落差' },
      { key: 'mainPlants', label: '主廠', group: '② 廠內負荷占比' }, { key: 'plantShare', label: '廠內占比', num: true, fmt: F.pct2, group: '② 廠內負荷占比' }, { key: 'support', label: '跨廠支援筆數', num: true, fmt: F.int, group: '② 廠內負荷占比' },
      { key: 'work', label: '承接量(' + u + ')', num: true, fmt: F.int, group: '③ 公司同職務貢獻' }, { key: 'coShare', label: '占公司同職務', num: true, fmt: F.pct2, group: '③ 公司同職務貢獻' },
      { key: 'licAvg', label: '同證照平均日均', num: true, fmt: F.d2, group: '④ 同證照量能' }, { key: 'licN', label: '同證照人數', num: true, fmt: F.int, group: '④ 同證照量能' }, { key: 'licRatio', label: '本人÷同證照', num: true, fmt: F.pct0, group: '④ 同證照量能' },
      { key: 'months', label: '資料月數', num: true, fmt: F.int, group: '資料涵蓋' }], rows, sortKey: 'daily', onRow: (r) => root.App.openPerson(r.p.id), groupOf: (c) => c.group });
    UI.bindExport(el, 'l3', RN(role) + '_負荷比較', t);
  }

  let st = { tab: 'solicit', role: 'SA' };
  Pages.solicit = function (el, D) {
    const role = S.role === 'all' ? st.role : S.role;
    const W = S.cfg.weights[role];
    const cur = PX.current(D.people[role]);
    const tabs = UI.seg('stab', [['solicit', '① 招攬分析'], ['csi', '② CSI雙提醒'], ['cross', '③ 招攬 × CSI'], ['load', '④ 負荷比較']], st.tab);
    const roleSeg = S.role === 'all' ? UI.seg('srole', [['SA', '服專'], ['CA', '出納']], role) : '';
    el.innerHTML = '<div class="page-head"><div><h1>招攬・CSI・負荷｜' + RN(role) + '</h1><p>期間 ' + Store.monthLabel(Store.allMonths()) + '（招攬至 9 月、考核／CSI 至 8 月）；招攬占綜合戰力 ' + Math.round((W.solicit || 0) * 100) + '%</p></div><div style="display:flex;gap:8px;flex-wrap:wrap">' + roleSeg + tabs + '</div></div><div id="sbody"></div>';
    UI.bindSeg(el, 'stab', (v) => { st.tab = v; root.App.render(); });
    UI.bindSeg(el, 'srole', (v) => { st.role = v; root.App.render(); });
    const body = el.querySelector('#sbody');
    if (st.tab === 'solicit') solicitTab(body, D, role, cur);
    else if (st.tab === 'csi') csiTab(body, D, role);
    else if (st.tab === 'load') loadTab(body, D, role, cur);
    else crossTab(body, D, role, cur);
  };

  function solicitTab(el, D, role, cur) {
    const items = ITEMS[role], W = S.cfg.weights[role].solicit || 0;
    const rows = cur.map((p) => { const s = solOf(p), sr = solicitRows(p); const o = { p, plant: p.plant, name: p.name, prSolicit: p.prSolicit, weighted: nn(p.prSolicit) ? p.prSolicit * W * 100 : null, status: s.solicitStatus || p.excel.solicitStatus || '—', months: s.serviceMonths, coverage: s.coverage }; sr.forEach((r, i) => { o['r' + i] = r.rate; o['p' + i] = r.pr; o['a' + i] = r.act; o['t' + i] = r.tgt != null ? r.tgt : r.base; }); return o; });
    const valid = rows.filter((r) => nn(r.prSolicit));
    el.innerHTML = '<div class="guide"><b>計分</b><span>' + (role === 'SA' ? '7 項單項PR各占 1/7 → 招攬執行PR；招攬執行PR × 20% 計入綜合戰力' : '裕信、裕日護照每100張結帳工單本數PR各占 50% → 招攬執行PR；× 10% 計入綜合戰力（本數與工單分母採相同涵蓋月份）') + '</span><span>無目標項目以招攬密度分析；缺資料不當零</span><span>招攬PR有效 ' + valid.length + ' 人（與正式排名人數分開）</span></div>' +
      '<div class="kpis">' + kpi({ noPrev: true, companyFmt: F.int, label: '招攬執行PR平均', value: mean(valid.map((r) => r.prSolicit)), fmt: F.pr, light: 'blue', cur: valid.length, curFmt: F.int, curLabel: '有效人數', company: cur.length, companyLabel: '現職人數' }) +
        items.map((it, i) => kpi({ noPrev: true, companyFmt: F.int, label: it.n, value: mean(rows.map((r) => r['r' + i])), fmt: it.fmt, light: 'blue', cur: mean(rows.map((r) => r['p' + i])), curFmt: F.pr, curLabel: '平均單項PR', company: rows.filter((r) => nn(r['r' + i])).length, companyLabel: '有資料人數' })).join('') + '</div>' +
      '<div class="grid g2" style="margin-top:12px">' + card('招攬執行PR 排名', '<div class="chart tall" id="s1"></div>', { sub: '僅招攬PR有效者' }) + card('各廠招攬執行PR平均', '<div class="chart tall" id="s2"></div>') + '</div><div style="height:12px"></div>' +
      card('招攬明細（實績／目標或分母／達成率或密度／單項PR）', '<div id="s3"></div>', { flush: true, tools: UI.exportBtns('s3') });
    const srt = valid.slice().sort((a, b) => a.prSolicit - b.prSolicit);
    chart(el.querySelector('#s1'), { tooltip: { trigger: 'axis' }, grid: { left: 90, right: 40, top: 10, bottom: 20 }, xAxis: { type: 'value', max: 100 }, yAxis: { type: 'category', data: srt.map((r) => r.name), axisLabel: { fontSize: 10 } },
      dataZoom: srt.length > 25 ? [{ type: 'slider', yAxisIndex: 0, right: 0, width: 12, start: 50, end: 100 }] : undefined,
      series: [{ type: 'bar', barMaxWidth: 12, data: srt.map((r) => ({ value: +(r.prSolicit * 100).toFixed(1), itemStyle: { color: C.navy } })), label: { show: true, position: 'right', fontSize: 9, formatter: (x) => x.value.toFixed(1) } }] });
    const pl = Array.from(new Set(valid.map((r) => r.plant))).map((p) => ({ p, v: mean(valid.filter((r) => r.plant === p).map((r) => r.prSolicit)), n: valid.filter((r) => r.plant === p).length })).sort((a, b) => a.v - b.v);
    chart(el.querySelector('#s2'), { tooltip: { trigger: 'axis' }, grid: { left: 70, right: 40, top: 10, bottom: 20 }, xAxis: { type: 'value', max: 100 }, yAxis: { type: 'category', data: pl.map((x) => x.p) },
      series: [{ type: 'bar', barMaxWidth: 14, data: pl.map((x) => +(x.v * 100).toFixed(1)), itemStyle: { color: C.navy2 }, label: { show: true, position: 'right', fontSize: 10, formatter: (x) => x.value.toFixed(1) + '（' + pl[x.dataIndex].n + '人）' } }] });
    const cols = [{ key: 'plant', label: '廠別', group: '人員' }, { key: 'name', label: '姓名', sticky: true, html: (r) => UI.nameLink(r.p), group: '人員' }];
    items.forEach((it, i) => {
      if (it.act) cols.push({ key: 'a' + i, label: '實績(' + (it.unit || '') + ')', num: true, fmt: F.int, group: it.n });
      if (it.tgt || it.base) cols.push({ key: 't' + i, label: it.tgt ? '適用目標' : '分母（同月工作量）', num: true, fmt: F.int, group: it.n });
      cols.push({ key: 'r' + i, label: it.kind, num: true, fmt: it.fmt, group: it.n }, { key: 'p' + i, label: '單項PR', num: true, fmt: F.pr, cls: (r, v) => PX.colorCell('pr', v), group: it.n });
    });
    cols.push({ key: 'prSolicit', label: '招攬執行PR', num: true, fmt: F.pr, cls: (r, v) => PX.colorCell('pr', v), group: '招攬構面' }, { key: 'weighted', label: '加權得分', num: true, fmt: F.score, group: '招攬構面' },
      { key: 'months', label: '服務有效月數', num: true, fmt: F.int, group: '資料涵蓋' }, { key: 'status', label: '招攬資料狀態', group: '資料涵蓋' }, { key: 'coverage', label: '資料月份', group: '資料涵蓋' });
    const t = table(el.querySelector('#s3'), { columns: cols, rows, sortKey: 'prSolicit', onRow: (r) => root.App.openPerson(r.p.id), groupOf: (c) => c.group });
    UI.bindExport(el, 's3', RN(role) + '_招攬明細', t);
  }

  function csiTab(el, D, role) {
    const al = csiAlerts(role, D);
    const low = al.filter((a) => a.type === '低於980'), drop = al.filter((a) => a.type === '較前月下降');
    const persons = (l) => new Set(l.map((a) => a.p.name)).size;
    el.innerHTML = '<div class="guide"><b>判斷</b><span>① 當月 CSI 低於 ' + CSI_TH.low + ' 分</span><span>② 當月較緊鄰前月下降：≥' + CSI_TH.yellow + ' 且 <' + CSI_TH.red + ' 分黃燈、≥' + CSI_TH.red + ' 分紅燈</span><span>缺月不補零、不跳月比較；CSI 原始 0–1000 量尺</span></div>' +
      '<div class="kpis">' + kpi({ noPrev: true, companyFmt: F.int, label: '低於980（人月）', value: low.length, light: low.length ? 'red' : 'green', goodDir: -1, cur: persons(low), curFmt: F.int, curLabel: '涉及人數' }) +
      kpi({ noPrev: true, companyFmt: F.int, label: '較前月下降 ≥10（紅）', value: drop.filter((a) => a.level === 'red').length, light: 'red', goodDir: -1, cur: persons(drop.filter((a) => a.level === 'red')), curFmt: F.int, curLabel: '涉及人數' }) +
      kpi({ noPrev: true, companyFmt: F.int, label: '較前月下降 5–10（黃）', value: drop.filter((a) => a.level === 'yellow').length, light: 'yellow', goodDir: -1, cur: persons(drop.filter((a) => a.level === 'yellow')), curFmt: F.int, curLabel: '涉及人數' }) + '</div>' +
      '<div class="grid g2" style="margin-top:12px">' + card('① 低於980分', '<div id="c1"></div>', { flush: true, tools: UI.exportBtns('c1') }) + card('② 較前月下降', '<div id="c2"></div>', { flush: true, tools: UI.exportBtns('c2') }) + '</div>';
    const base = [{ key: 'month', label: '月份' }, { key: 'plant', label: '當月廠別' }, { key: 'name', label: '姓名', get: (a) => a.p ? a.p.name : '', html: (a) => a.p ? UI.nameLink(a.p) : '—' }];
    const t1 = table(el.querySelector('#c1'), { columns: base.concat([{ key: 'csi', label: '當月CSI', num: true, fmt: F.csi, cls: () => 'cell-bad' }]), rows: low, sortKey: 'csi', sortDir: 1, short: true });
    const t2 = table(el.querySelector('#c2'), { columns: base.concat([{ key: 'prev', label: '前月CSI', num: true, fmt: F.csi }, { key: 'csi', label: '當月CSI', num: true, fmt: F.csi }, { key: 'drop', label: '下降（分）', num: true, fmt: F.d1 }, { key: 'level', label: '燈號', html: (a) => UI.pill(a.level === 'red' ? '紅燈' : '黃燈', a.level) }]), rows: drop, sortKey: 'drop', short: true });
    UI.bindExport(el, 'c1', RN(role) + '_CSI低於980', t1); UI.bindExport(el, 'c2', RN(role) + '_CSI較前月下降', t2);
  }

  function crossTab(el, D, role, cur) {
    const mp = (S.model.monthlyPower || []).filter((r) => r.roleName === RN(role));
    const names = new Set(cur.map((p) => p.name));
    // 共同涵蓋月份：同人同月 招攬PR 與 CSI 皆有值
    const both = mp.filter((r) => names.has(r.name) && nn(r.prSolicit) && nn(r.csi));
    const commonMs = Array.from(new Set(both.map((r) => r.month))).sort();
    const pts = cur.map((p) => { const rs = both.filter((r) => r.name === p.name); return rs.length ? { p, n: rs.length, sol: mean(rs.map((r) => r.prSolicit)), csi: mean(rs.map((r) => r.csi)) } : null; }).filter(Boolean);
    const trend = commonMs.map((m) => { const rs = both.filter((r) => r.month === m); return { m, sol: mean(rs.map((r) => r.prSolicit)), csi: mean(rs.map((r) => r.csi)), n: rs.length }; });
    const xs = pts.map((x) => x.sol), ys = pts.map((x) => x.csi), mx = mean(xs), my = mean(ys);
    const r = pts.length > 2 ? Engine.sum(xs.map((x, i) => (x - mx) * (ys[i] - my))) / Math.sqrt(Engine.sum(xs.map((x) => (x - mx) ** 2)) * Engine.sum(ys.map((y) => (y - my) ** 2))) : null;
    const desc = !nn(r) ? '樣本不足' : Math.abs(r) < 0.2 ? '兩者關聯微弱' : (r > 0 ? '大致同向' : '大致反向') + (Math.abs(r) >= 0.5 ? '（較明顯）' : '（溫和）');
    el.innerHTML = '<div class="guide"><b>口徑</b><span>共同涵蓋月份：' + (commonMs.length ? Store.monthLabel(commonMs) : '無') + '（同人同月招攬PR與CSI皆有值）</span><span>個人值＝共同月份之月度招攬PR平均、CSI平均</span><span>招攬高低分界尚未核定，不設象限門檻；僅作中性描述</span></div>' +
      '<div class="banner info"><b>描述</b><span>' + pts.length + ' 人；相關係數 r＝' + (nn(r) ? r.toFixed(2) : '—') + '，' + desc + '。相關不代表因果，請搭配個人分析判讀。</span></div>' +
      '<div class="grid g2">' + card('招攬PR × CSI（個人）', '<div class="chart tall" id="x1"></div>', { sub: '點大小＝共同月份數' }) + card('月別趨勢（共同涵蓋月份）', '<div class="chart tall" id="x2"></div>', { sub: '長條＝平均招攬PR；折線＝平均CSI' }) + '</div>';
    const c = chart(el.querySelector('#x1'), { tooltip: { trigger: 'item', formatter: (x) => esc(x.data.p.plant + '｜' + x.data.p.name) + '<br>招攬PR ' + (x.data.value[0] * 100).toFixed(1) + '｜CSI ' + x.data.value[1].toFixed(1) + '<br>共同月份 ' + x.data.n }, grid: { left: 56, right: 24, bottom: 44 },
      xAxis: { type: 'value', name: '月度招攬PR平均', nameLocation: 'middle', nameGap: 26, min: 0, max: 1, axisLabel: { formatter: (v) => (v * 100).toFixed(0) } }, yAxis: { type: 'value', name: 'CSI', scale: true },
      series: [{ type: 'scatter', data: pts.map((x) => ({ value: [x.sol, x.csi], p: x.p, n: x.n, symbolSize: 6 + x.n * 1.5 })), itemStyle: { color: C.navy, opacity: .8 }, label: { show: true, formatter: (x) => x.data.p.name, position: 'right', fontSize: 9 }, labelLayout: { hideOverlap: true } }] });
    if (c) c.on('click', (e) => e.data && root.App.openPerson(e.data.p.id));
    chart(el.querySelector('#x2'), { color: [C.sky, C.red], tooltip: { trigger: 'axis' }, legend: { data: ['平均招攬PR', '平均CSI'] }, xAxis: { type: 'category', data: trend.map((t) => Number(t.m.slice(5)) + '月') },
      yAxis: [{ type: 'value', name: 'PR', max: 100 }, { type: 'value', name: 'CSI', scale: true, splitLine: { show: false } }],
      series: [{ name: '平均招攬PR', type: 'bar', barMaxWidth: 24, data: trend.map((t) => +(t.sol * 100).toFixed(1)) }, { name: '平均CSI', type: 'line', yAxisIndex: 1, data: trend.map((t) => +t.csi.toFixed(1)) }] });
  }
})(window);
