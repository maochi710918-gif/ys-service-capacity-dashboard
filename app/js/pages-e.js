/* =========================================================================
 * 頁面 E：顧客保留率
 *  ① 服專定保保留率（接待保留率.xlsx）
 *  ② CRM 久未回廠客戶名單（去識別化；名單本身即為久未回廠者，不計算保留率）
 * ========================================================================= */
(function (root) {
  const { Store, UI, Engine, PX } = root; const S = Store.S;
  const { F, esc, nn, kpi, table, chart, card, C } = UI; const sum = Engine.sum;
  const Pages = root.Pages;
  const LS_KEY = 'ys_dash_crm';

  function crm() {
    try { const v = localStorage.getItem(LS_KEY); if (v) return JSON.parse(v); } catch (e) { }
    return root.CRM_DATA || null;
  }
  function saveCrm(d) { try { localStorage.setItem(LS_KEY, JSON.stringify(d)); return true; } catch (e) { return false; } }
  function resetCrm() { try { localStorage.removeItem(LS_KEY); } catch (e) { } }
  const R = () => S.cfg.retention;
  const state = () => '久未回';
  const contactable = (c) => c.consent === '同意使用個資' && c.dnd !== '是';
  function stats(list) {
    const pm = list.filter((c) => c.type === '定保UIO').length, follow = list.filter(contactable).length;
    return { total: list.length, follow, pm, pmShare: list.length ? pm / list.length : null, avgDays: Engine.mean(list.map((c) => c.days)),
      noConsent: list.filter((c) => c.consent !== '同意使用個資').length, dndN: list.filter((c) => c.dnd === '是').length, over: list.filter((c) => nn(c.days) && c.days > R().days).length };
  }
  function scoped(D) {
    const d = crm(); if (!d) return null;
    const pPass = (c) => (!S.filters.plant || c.plant === S.filters.plant) && (!S.filters.name || String(c.advisor || '').indexOf(S.filters.name) >= 0);
    const sc = Store.perm().scope;
    const perm = (c) => sc === 'plant' ? (!S.user.plant || c.plant === S.user.plant) : sc === 'self' ? ('SA:' + c.advisor) === S.user.self : true;
    return { meta: d.meta, all: d.rows, rows: d.rows.filter((c) => pPass(c) && perm(c)) };
  }
  function coverage(d) {
    const u = (k) => Array.from(new Set(d.all.map((c) => c[k]).filter(Boolean)));
    return { plants: u('plant'), models: u('model') };
  }
  root.RETX = { crm, stats, state, scoped, coverage };

  /* ======================= 服專定保保留率（接待保留率.xlsx） ======================= */
  const LS_RET = 'ys_dash_retention';
  function retRaw() {
    try { const v = localStorage.getItem(LS_RET); if (v) return JSON.parse(v); } catch (e) { }
    return root.RETENTION_DATA || null;
  }
  // 只保留服專總覽中有此人者（總覽無此人之列不顯示、不計入人數與NG）
  function ret() {
    const d = retRaw(); if (!d) return null;
    const known = new Set((S.model.saPeople || []).map((p) => p.name));
    return Object.assign({}, d, { advisors: d.advisors.filter((a) => known.has(a.advisor)), excludedAdvisors: d.advisors.filter((a) => !known.has(a.advisor)).length });
  }
  const rosterPlants = () => (S.model.plants || []).map((r) => r.plant);
  // 服專跨廠合併：保留台數＝Σ(保留率×CY26對象)
  function advisorRet(name) {
    const d = ret(); if (!d) return null;
    const rows = d.advisors.filter((a) => a.advisor === name);
    if (!rows.length) return null;
    const t = sum(rows.map((a) => a.target || 0)), k = sum(rows.map((a) => (a.rate || 0) * (a.target || 0)));
    const pt = sum(rows.map((a) => a.target || 0)), pk = sum(rows.map((a) => (a.plantRate || 0) * (a.target || 0)));
    return { rows, target: t, rate: t ? k / t : null, plantRate: pt ? pk / pt : null, vsPlant: t && pt ? k / t - pk / pt : null, ng: rows.some((a) => a.ng), valid: rows.some((a) => a.valid), plants: rows.map((a) => a.plant), uio: sum(rows.map((a) => a.uio || 0)) };
  }
  function plantRet() {
    const d = ret(); if (!d) return [];
    const by = {};
    d.advisors.forEach((a) => { const o = by[a.code] = by[a.code] || { code: a.code, plant: a.plant, dealer: a.dealer, plantRate: a.plantRate, plantPmPerCar: a.plantPmPerCar, advisors: [] }; o.advisors.push(a); });
    return Object.values(by).map((o) => {
      const tot = d.plants.find((p) => p.code === o.code);
      const t = sum(o.advisors.map((a) => a.target || 0));
      return Object.assign(o, { target: tot ? tot.target : t, uio: tot ? tot.uio : sum(o.advisors.map((a) => a.uio || 0)), advRate: tot ? tot.rate : (t ? sum(o.advisors.map((a) => a.rate * a.target)) / t : null),
        ng: o.advisors.filter((a) => a.ng).length, validN: o.advisors.filter((a) => a.valid).length, inScope: rosterPlants().indexOf(o.plant) >= 0 });
    });
  }
  function companyRet(list) {
    const l = list.filter((p) => p.inScope); const t = sum(l.map((p) => p.target || 0));
    return t ? sum(l.map((p) => (p.plantRate || 0) * (p.target || 0))) / t : null;
  }
  root.RETX.ret = ret; root.RETX.advisorRet = advisorRet; root.RETX.plantRet = plantRet; root.RETX.companyRet = companyRet;

  Pages.retention = function (el, D) {
    const d = ret();
    el.innerHTML = '<div class="page-head"><div><h1>顧客保留率</h1><p>① 服專定保保留率（全公司｜' + esc(d ? d.meta.base : '') + '）　② 久未回廠客戶追蹤（全廠 CRM 名單）</p></div></div><div id="retA"></div><div class="section-title">② 久未回廠客戶追蹤（CRM，去識別化）</div><div id="retB"></div>';
    retSection(el.querySelector('#retA'), D);
    crmSection(el.querySelector('#retB'), D);
  };

  function retSection(el, D) {
    const d = ret();
    if (!d) { el.innerHTML = '<div class="banner info"><b>尚無接待保留率資料</b><span>請由「資料匯入」上傳「接待保留率」Excel。</span></div>'; return; }
    const ngTh = (d.meta.params && d.meta.params[1]) != null ? d.meta.params[1] : -0.03, validTh = (d.meta.params && d.meta.params[0]) || 100;
    const pl = plantRet(), coRate = companyRet(pl);
    const plantF = (x) => (!S.filters.plant || x.plant === S.filters.plant) && (Store.perm().scope !== 'plant' || !S.user.plant || x.plant === S.user.plant);
    const nameF = (a) => !S.filters.name || String(a.advisor).indexOf(S.filters.name) >= 0;
    const advs = d.advisors.filter((a) => plantF(a) && nameF(a) && (Store.perm().scope !== 'self' || ('SA:' + a.advisor) === S.user.self)).map((a) => Object.assign({}, a, { p: D.P.SA.find((x) => x.name === a.advisor), inScope: rosterPlants().indexOf(a.plant) >= 0 }));
    const pls = pl.filter(plantF);
    const inPl = pls.filter((p) => p.inScope).sort((a, b) => b.plantRate - a.plantRate);
    const ngN = advs.filter((a) => a.ng).length, validN = advs.filter((a) => a.valid).length;
    const best = inPl[0], worst = inPl[inPl.length - 1];
    const dlr = (d.dealers || []).map((x) => x.dealer + ' ' + F.pct2(x.plantRate)).join('、');
    el.innerHTML = '<div class="guide"><b>定義</b><span>服專定保保留率＝CY25 最後定保服專之客戶，CY26 回廠定保比例</span><span>有效服專＝2025 定保工單 >' + validTh + ' 台</span><span>NG＝服專保留率較所屬廠低於 ' + Math.abs(ngTh * 100) + ' 個百分點以上</span><span>跨廠服專以 CY26 對象數加權合併</span></div>' +
      '<div class="kpis">' +
      kpi({ label: '分析範圍廠別定保保留率', value: coRate, fmt: F.pct2, light: 'blue', cur: sum(inPl.map((p) => p.target || 0)), curFmt: F.int, curLabel: 'CY26 對象', company: null, companyLabel: '經銷商合計', hint: dlr ? '經銷商合計：' + dlr : '', subFmt: F.pct2 }) +
      kpi({ label: '保留率最高廠', value: best ? best.plantRate : null, fmt: F.pct2, light: 'green', cur: null, curLabel: best ? best.plant : '—', company: coRate, subFmt: F.pct2 }) +
      kpi({ label: '保留率最低廠', value: worst ? worst.plantRate : null, fmt: F.pct2, light: 'red', cur: null, curLabel: worst ? worst.plant : '—', company: coRate, subFmt: F.pct2 }) +
      kpi({ label: '服專（廠別列）', value: advs.length, unit: '列', light: 'blue', cur: validN, curFmt: F.int, curLabel: '有效服專', company: d.advisors.length, companyLabel: '全部' }) +
      kpi({ label: 'NG 服專', value: ngN, unit: '列', light: ngN ? 'red' : 'green', goodDir: -1, cur: advs.length ? ngN / advs.length : null, curFmt: F.pct, curLabel: '占比', company: d.advisors.filter((a) => a.ng).length, companyLabel: '全部' }) +
      '</div><div class="grid g2b" style="margin-top:12px">' +
      card('各廠定保保留率', '<div class="chart tall" id="rp1"></div>', { sub: '虛線＝分析範圍廠別加權（依 CY26 對象）；灰色＝範圍外據點' }) +
      card('服務廠保留率', '<div id="rp2"></div>', { flush: true, tools: UI.exportBtns('rp2') }) + '</div><div style="height:12px"></div>' +
      card('服專定保保留率明細', '<div id="rp3"></div>', { flush: true, tools: UI.exportBtns('rp3'), sub: '僅列服專總覽中之人員' + (d.excludedAdvisors ? '（另 ' + d.excludedAdvisors + ' 列總覽無此人，已排除）' : '') + '；同一服專於多廠者分列；點姓名進入個人分析' });
    const rv = pls.slice().sort((a, b) => a.plantRate - b.plantRate);
    chart(el.querySelector('#rp1'), {
      tooltip: { trigger: 'axis', valueFormatter: (v) => nn(v) ? v.toFixed(2) + '%' : '—' }, grid: { left: 70, right: 40, top: 10, bottom: 24 },
      xAxis: { type: 'value', min: (v) => Math.max(0, Math.floor(v.min / 10) * 10), max: 100, axisLabel: { formatter: '{value}%' } }, yAxis: { type: 'category', data: rv.map((p) => p.plant) },
      series: [{ type: 'bar', barMaxWidth: 14, data: rv.map((p) => ({ value: +(p.plantRate * 100).toFixed(2), itemStyle: { color: !p.inScope ? '#cbd5e1' : nn(coRate) && p.plantRate >= coRate ? C.navy : C.red } })), label: { show: true, position: 'right', fontSize: 10, formatter: (x) => x.value.toFixed(1) + '%' },
        markLine: nn(coRate) ? { silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: C.red }, label: { show: false }, data: [{ xAxis: +(coRate * 100).toFixed(2) }] } : undefined }]
    });
    const t2 = table(el.querySelector('#rp2'), {
      columns: [{ key: 'rk', label: '名次', num: true, get: (p) => p.inScope ? inPl.indexOf(p) + 1 : null }, { key: 'plant', label: '服務廠', html: (p) => esc(p.plant) + (p.inScope ? '' : ' ' + UI.pill('範圍外', 'gray')) }, { key: 'dealer', label: '經銷商' },
        { key: 'plantRate', label: '廠定保保留率', num: true, fmt: F.pct2, cls: (p, v) => nn(coRate) && p.inScope ? (v >= coRate ? 'cell-good' : 'cell-bad') : '' },
        { key: 'target', label: 'CY26對象', num: true, fmt: F.int }, { key: 'plantPmPerCar', label: '廠定保單台', num: true, fmt: F.money }, { key: 'validN', label: '有效服專', num: true }, { key: 'ng', label: 'NG服專', num: true, cls: (p, v) => v ? 'cell-bad' : '' }],
      rows: pls, sortKey: 'plantRate', short: true
    });
    UI.bindExport(el, 'rp2', '服務廠定保保留率', t2);
    const t3 = table(el.querySelector('#rp3'), {
      columns: [{ key: 'plant', label: '服務廠' }, { key: 'advisor', label: '服專', sticky: true, html: (a) => a.p ? UI.nameLink(a.p) : esc(a.advisor) }, { key: 'status', label: '人員狀態', get: (a) => a.p ? a.p.status : '總覽無此人', html: (a, v) => UI.pill(v, v === '現行' ? 'green' : 'blue') },
        { key: 'uio', label: 'UIO數', num: true, fmt: F.int }, { key: 'target', label: 'CY26對象', num: true, fmt: F.int },
        { key: 'rate', label: '服專定保保留率', html: (a) => bar(nn(a.rate) ? a.rate * 100 : null, 100, a.ng ? 'var(--bad)' : 'var(--navy-700)', F.pct2(a.rate)), sortVal: (a) => a.rate }, { key: 'plantRate', label: '廠保留率', num: true, fmt: F.pct2 },
        { key: 'vsPlant', label: 'vs 廠（pp）', num: true, fmt: (v) => nn(v) ? (v > 0 ? '+' : '') + (v * 100).toFixed(2) : '—', cls: (a, v) => nn(v) ? (v >= 0 ? 'cell-good' : v <= ngTh ? 'cell-bad' : 'cell-warn') : '' },
        { key: 'churn', label: '服專定保流失率', num: true, fmt: F.pct2 }, { key: 'pmPerCar', label: '定保單台', num: true, fmt: F.money }, { key: 'pmPerCarVsPlant', label: '單台 vs 廠', num: true, fmt: (v) => nn(v) ? (v > 0 ? '+' : '') + Math.round(v).toLocaleString() : '—' },
        { key: 'valid', label: '有效服專', get: (a) => a.valid ? '是' : '否' }, { key: 'ng', label: 'NG判斷', get: (a) => a.ng ? 'NG' : '', html: (a) => a.ng ? UI.pill('NG', 'red') : '' },
        { key: 'power', label: '綜合戰力', num: true, get: (a) => a.p ? a.p.power : null, fmt: F.score }],
      rows: advs, sortKey: 'vsPlant', sortDir: 1, onRow: (a) => a.p && root.App.openPerson(a.p.id)
    });
    UI.bindExport(el, 'rp3', '服專定保保留率', t3);
  }
  const bar = (v, max, color, txt) => !nn(v) ? '<span class="na">—</span>' : '<div class="ibar"><div class="ibar-t"><div class="ibar-f" style="width:' + Math.max(2, Math.min(100, v / max * 100)) + '%;background:' + color + '"></div></div><b>' + (txt || v.toFixed(1)) + '</b></div>';

  root.retImportBlock = function (el) {
    const d = ret();
    const box = document.createElement('div');
    box.innerHTML = '<div style="height:12px"></div>' + card('接待保留率（服專定保保留率）', '<p class="note" style="margin-top:0">目前：' + (d ? esc(d.meta.file) + '｜服專 ' + d.advisors.length + ' 列、服務廠 ' + plantRet().length + ' 廠' : '尚無資料') + '。需含欄位：經銷商、廠代碼、服務廠、CY25 最後定保服專、CY26對象、服專定保保留率、廠定保保留率。</p><label class="btn primary">選擇接待保留率檔案<input type="file" id="retFile" accept=".xlsx,.xls" hidden></label> <button class="btn" id="retReset">還原預設資料</button><div id="retMsg" class="note" style="margin-top:8px"></div>');
    el.appendChild(box);
    box.querySelector('#retReset').addEventListener('click', () => { try { localStorage.removeItem(LS_RET); } catch (e) { } UI.toast('已還原預設接待保留率'); root.App.rerender(); });
    box.querySelector('#retFile').addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        const r = root.Importer.parseRetention(XLSX, XLSX.read(new Uint8Array(rd.result), { type: 'array' }), f.name);
        if (r.report.errors.length) { box.querySelector('#retMsg').innerHTML = '<span class="down">' + r.report.errors.map((x) => esc(x.msg)).join('<br>') + '</span>'; return; }
        try { localStorage.setItem(LS_RET, JSON.stringify({ meta: { file: f.name, builtAt: new Date().toISOString().slice(0, 10), defs: r.defs, params: r.params, base: 'CY25 最後定保服專 → CY26 回廠' }, advisors: r.advisors, plants: r.plants, dealers: r.dealers })); } catch (err) { }
        box.querySelector('#retMsg').textContent = '成功：服專 ' + r.advisors.length + ' 列、廠合計 ' + r.plants.length + ' 列；警告 ' + r.report.warnings.length;
        UI.toast('接待保留率已更新'); setTimeout(() => root.App.rerender(), 600);
      };
      rd.readAsArrayBuffer(f);
    });
  };

  function crmSection(el, D) {
    const d = scoped(D);
    if (!d) { el.innerHTML = '<div class="banner info"><b>尚無久未回廠資料</b><span>請由「資料匯入」上傳 CRM 久未回廠查詢結果（去識別化）。</span></div>'; return; }
    const st = stats(d.rows), co = stats(d.all);
    const roster = (S.model.plants || []).map((r) => r.plant);
    const known = new Set((S.model.saPeople || []).map((p) => p.name));
    const days = d.all.map((c) => c.days).filter(nn);
    // 服務廠
    const byP = {}; d.rows.forEach((c) => { (byP[c.plant || '（未提供）'] = byP[c.plant || '（未提供）'] || []).push(c); });
    const retPl = root.RETX.plantRet ? root.RETX.plantRet() : [];
    const pRows = Object.keys(byP).map((pl) => { const r = retPl.find((x) => x.plant === pl); return Object.assign({ plant: pl, inScope: roster.indexOf(pl) >= 0, target: r ? r.target : null }, stats(byP[pl])); })
      .map((o) => Object.assign(o, { per100: o.target ? o.total / o.target * 100 : null }));
    const inP = pRows.filter((o) => o.inScope).sort((a, b) => b.total - a.total);
    // 服專（僅服專總覽中之人員）
    const byA = {}; d.rows.forEach((c) => { if (known.has(c.advisor)) (byA[c.advisor] = byA[c.advisor] || []).push(c); });
    const aRows = Object.keys(byA).map((a) => { const p = D.P.SA.find((x) => x.name === a); const r = root.RETX.advisorRet ? root.RETX.advisorRet(a) : null;
      return Object.assign({ advisor: a, p, plantNow: p ? p.plant : null, crmPlants: Array.from(new Set(byA[a].map((c) => c.plant))).join('、'), retRate: r ? r.rate : null, target: r ? r.target : null }, stats(byA[a])); })
      .map((o) => Object.assign(o, { per100: o.target ? o.total / o.target * 100 : null }));
    const unknownN = d.rows.filter((c) => !known.has(c.advisor)).length;
    el.innerHTML = '<p class="note">資料：' + esc(d.meta.file) + '｜查詢日 ' + esc(d.meta.queryDate) + '｜去識別化 ' + co.total.toLocaleString() + ' 位久未回廠客戶（未回廠 ' + Math.min.apply(null, days) + '–' + Math.max.apply(null, days) + ' 天）</p>' +
      '<div class="guide"><b>說明</b><span>本名單僅含「久未回廠」客戶（約一年以上未回廠），無母體，故不計算保留率；保留率請見上方「服專定保保留率」。</span><span>可聯繫＝同意使用個資且非勿擾</span><span>每百對象久未回＝久未回人數 ÷ 接待保留率 CY26 對象 × 100（不同來源，僅供參考）</span></div>' +
      '<div class="kpis">' +
      kpi({ label: '久未回廠客戶', value: st.total, unit: '位', light: st.total ? 'yellow' : 'green', goodDir: -1, cur: st.avgDays, curFmt: F.int, curLabel: '平均未回廠天數', company: co.total, companyLabel: '查詢全體' }) +
      kpi({ label: '可聯繫待追蹤', value: st.follow, unit: '位', light: 'blue', cur: st.total ? st.follow / st.total : null, curFmt: F.pct, curLabel: '占比', company: co.follow, companyLabel: '查詢全體' }) +
      kpi({ label: '定保客戶', value: st.pm, unit: '位', light: 'blue', cur: st.pmShare, curFmt: F.pct, curLabel: '定保UIO占比', company: co.pm, companyLabel: '查詢全體' }) +
      kpi({ label: '不可聯繫', value: st.total - st.follow, unit: '位', light: 'gray', cur: st.noConsent, curFmt: F.int, curLabel: '未同意個資', company: st.dndN, companyLabel: '勿擾', hint: '未同意個資或勿擾' }) +
      kpi({ label: '超過一年', value: st.over, unit: '位', light: 'red', goodDir: -1, cur: st.total ? st.over / st.total : null, curFmt: F.pct, curLabel: '占比', company: co.over, companyLabel: '查詢全體', hint: '未回廠 > ' + R().days + ' 天' }) +
      '</div><div class="grid g2b" style="margin-top:12px">' +
      card('各服務廠久未回廠客戶', '<div class="chart tall" id="rt1"></div>', { sub: '深色＝可聯繫；淺色＝不可聯繫' }) +
      card('服務廠明細', '<div id="rt2"></div>', { flush: true, tools: UI.exportBtns('rt2'), sub: '範圍外據點另列' }) + '</div><div style="height:12px"></div>' +
      card('服務專員久未回廠客戶', '<div id="rt3"></div>', { flush: true, tools: UI.exportBtns('rt3'), sub: '依 CRM「服務專員」；僅列服專總覽中之人員' + (unknownN ? '（另 ' + unknownN + ' 位客戶之服專不在總覽，計入廠別但不列服專）' : '') }) +
      '<div class="section-title">待追蹤客戶名單（去識別化）</div>' + card('久未回廠客戶', '<div class="chips-sel" style="padding:10px 14px 0" id="rtf"></div><div id="rt4"></div>', { flush: true, tools: UI.exportBtns('rt4') });

    const cv = inP.slice().reverse();
    chart(el.querySelector('#rt1'), {
      color: [C.navy, '#cbd5e1'], tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }, legend: { data: ['可聯繫', '不可聯繫'] }, grid: { left: 70, right: 30, top: 28, bottom: 20 },
      xAxis: { type: 'value', minInterval: 1 }, yAxis: { type: 'category', data: cv.map((o) => o.plant) },
      series: [{ name: '可聯繫', type: 'bar', stack: 's', barMaxWidth: 16, data: cv.map((o) => o.follow) }, { name: '不可聯繫', type: 'bar', stack: 's', barMaxWidth: 16, data: cv.map((o) => o.total - o.follow), label: { show: true, position: 'right', fontSize: 10, formatter: (x) => cv[x.dataIndex].total } }]
    });
    const t2 = table(el.querySelector('#rt2'), {
      columns: [{ key: 'plant', label: '服務廠', html: (o) => esc(o.plant) + (o.inScope ? '' : ' ' + UI.pill('範圍外', 'gray')) }, { key: 'total', label: '久未回', num: true, fmt: F.int }, { key: 'follow', label: '可聯繫', num: true, fmt: F.int },
        { key: 'pm', label: '定保UIO', num: true, fmt: F.int }, { key: 'avgDays', label: '平均未回廠天數', num: true, fmt: F.int }, { key: 'per100', label: '每百對象久未回', num: true, fmt: F.d1 }],
      rows: inP.concat(pRows.filter((o) => !o.inScope)), sortKey: 'total', short: true, onRow: (o) => { if (o.inScope) { S.filters.plant = o.plant; root.App.rerender(); } }
    });
    UI.bindExport(el, 'rt2', '久未回廠_服務廠', t2);
    const t3 = table(el.querySelector('#rt3'), {
      columns: [{ key: 'advisor', label: '服務專員', html: (r) => r.p ? UI.nameLink(r.p) : esc(r.advisor) }, { key: 'status', label: '人員狀態', get: (r) => r.p ? r.p.status : null, html: (r, v) => UI.pill(v || '—', v === '現行' ? 'green' : 'blue') },
        { key: 'plantNow', label: '最新廠別' }, { key: 'crmPlants', label: 'CRM服務廠' }, { key: 'total', label: '久未回', num: true, fmt: F.int }, { key: 'follow', label: '可聯繫', num: true, fmt: F.int },
        { key: 'pm', label: '定保UIO', num: true, fmt: F.int }, { key: 'avgDays', label: '平均未回廠天數', num: true, fmt: F.int }, { key: 'retRate', label: '服專定保保留率', num: true, fmt: F.pct2 },
        { key: 'per100', label: '每百對象久未回', num: true, fmt: F.d1 }, { key: 'power', label: '綜合戰力', num: true, get: (r) => r.p ? r.p.power : null, fmt: F.score }],
      rows: aRows, sortKey: 'total', short: true, onRow: (r) => r.p && root.App.openPerson(r.p.id)
    });
    UI.bindExport(el, 'rt3', '久未回廠_服務專員', t3);

    let flt = '可聯繫';
    const drawList = () => {
      const opts = ['可聯繫', '全部', '定保UIO', '維修UIO', '不可聯繫'];
      el.querySelector('#rtf').innerHTML = opts.map((o) => '<button data-k="' + o + '" class="' + (o === flt ? 'on' : '') + '">' + o + '</button>').join('');
      el.querySelectorAll('#rtf button').forEach((b) => b.addEventListener('click', () => { flt = b.dataset.k; drawList(); }));
      const l = d.rows.filter((c) => flt === '全部' || (flt === '可聯繫' ? contactable(c) : flt === '不可聯繫' ? !contactable(c) : c.type === flt));
      const t4 = table(el.querySelector('#rt4'), {
        columns: [{ key: 'id', label: '識別碼' }, { key: 'plant', label: '最近服務廠' }, { key: 'advisor', label: '服務專員' }, { key: 'lastVisit', label: '最近回廠' }, { key: 'days', label: '未回廠天數', num: true, fmt: F.int },
          { key: 'type', label: '回廠類別' }, { key: 'freq', label: '定保頻率' }, { key: 'model', label: '車型' }, { key: 'carAge', label: '車齡', num: true, fmt: F.d1 }, { key: 'mileage', label: '最新里程', num: true, fmt: F.int },
          { key: 'contact', label: '可聯繫', get: (c) => contactable(c) ? '是' : '否' }, { key: 'action', label: '建議行動', wrap: true }],
        rows: l, sortKey: 'days', short: true
      });
      UI.bindExport(el, 'rt4', '久未回廠客戶', t4);
    };
    drawList();
  }

  root.retentionCard = function (p) {
    if (p.role !== 'SA') return '';
    let h = '';
    const r = advisorRet(p.name);
    if (r) h += '<div class="section-title">服專定保保留率（CY25 → CY26）</div>' + card('本人定保保留率', '<div class="kv" style="grid-template-columns:150px 1fr"><span>服專定保保留率</span><span><b class="' + (r.ng ? 'down' : '') + '">' + F.pct2(r.rate) + '</b>' + (r.ng ? ' ' + UI.pill('NG', 'red') : '') + '</span><span>所屬廠保留率</span><span>' + F.pct2(r.plantRate) + '（差 ' + (nn(r.vsPlant) ? (r.vsPlant > 0 ? '+' : '') + (r.vsPlant * 100).toFixed(2) + ' pp' : '—') + '）</span><span>CY26 對象／UIO</span><span>' + F.int(r.target) + '／' + F.int(r.uio) + '</span><span>計算廠別</span><span>' + esc(r.plants.join('、')) + '</span><span>有效服專</span><span>' + (r.valid ? '是' : '否') + '</span></div>');
    return h + crmCard(p);
  };
  function crmCard(p) {
    const d = crm(); if (!d) return '';
    const mine = d.rows.filter((c) => c.advisor === p.name);
    if (!mine.length) return '';
    const s = stats(mine);
    return '<div class="section-title">久未回廠客戶（CRM｜查詢日 ' + esc(d.meta.queryDate) + '）</div>' +
      card('本人久未回廠客戶（' + s.total + ' 位）', '<div class="kv" style="grid-template-columns:150px 1fr"><span>可聯繫待追蹤</span><span><b>' + s.follow + '</b> 位</span><span>定保UIO</span><span>' + s.pm + ' 位</span><span>平均未回廠天數</span><span>' + F.int(s.avgDays) + ' 天</span><span>服務廠</span><span>' + esc(Array.from(new Set(mine.map((c) => c.plant))).join('、')) + '</span></div><p class="note"><a href="#/retention">查看待追蹤名單 →</a></p>');
  }

  root.crmImportBlock = function (el) {
    const d = crm();
    const box = document.createElement('div');
    box.innerHTML = '<div style="height:12px"></div>' + card('CRM 查詢結果（顧客保留率）', '<p class="note" style="margin-top:0">目前：' + (d ? esc(d.meta.file) + '｜查詢日 ' + esc(d.meta.queryDate) + '｜' + d.meta.count + ' 位客戶' : '尚無資料') + '。請上傳<b>去識別化</b>之 CRM 查詢結果（需含：識別碼、最近服務廠、服務專員、最近回廠或未回廠天數）。</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end"><div class="f"><label>查詢日</label><input type="date" id="crmDate" value="' + new Date().toISOString().slice(0, 10) + '"></div><label class="btn primary">選擇 CRM 檔案<input type="file" id="crmFile" accept=".xlsx,.xls" hidden></label><button class="btn" id="crmReset">還原預設 CRM 資料</button></div><div id="crmMsg" class="note" style="margin-top:8px"></div>');
    el.appendChild(box);
    box.querySelector('#crmReset').addEventListener('click', () => { resetCrm(); UI.toast('已還原預設 CRM 資料'); root.App.rerender(); });
    box.querySelector('#crmFile').addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return;
      const m = f.name.match(/(\d{4}-\d{2}-\d{2})/); const qd = m ? m[1] : box.querySelector('#crmDate').value;
      const rd = new FileReader();
      rd.onload = () => {
        const wb = XLSX.read(new Uint8Array(rd.result), { type: 'array' });
        const { rows, report } = root.Importer.parseCrm(XLSX, wb, f.name, qd);
        if (report.errors.length) { box.querySelector('#crmMsg').innerHTML = '<span class="down">' + report.errors.map((x) => esc(x.msg)).join('<br>') + '</span>'; return; }
        const ok = saveCrm({ meta: { file: f.name, queryDate: qd, count: rows.length }, rows });
        box.querySelector('#crmMsg').innerHTML = '成功 ' + rows.length + ' 位、警告 ' + report.warnings.length + ' 筆' + (ok ? '' : '（瀏覽器儲存空間不足，重新整理後將還原）');
        UI.toast('CRM 資料已更新'); setTimeout(() => root.App.rerender(), 600);
      };
      rd.readAsArrayBuffer(f);
    });
  };
})(window);
