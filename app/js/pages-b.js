/* =========================================================================
 * 頁面 B：個人分析、月度推移、車齡結構、綜合戰力
 * ========================================================================= */
(function (root) {
  const { Store, UI, Engine, PX } = root; const S = Store.S;
  const { F, esc, nn, kpi, table, chart, card, C } = UI; const mean = Engine.mean, sum = Engine.sum;
  const Pages = root.Pages;
  const { current, roleName, roleOn, TALENT_COLOR, promoColor } = PX;

  const METRICS = {
    SA: [
      ['avgCars', '月均接車台數', F.int, 1], ['capacityRate', '接車量能達成率', F.pct2, 1], ['avgRevenue', '月均業績', F.money, 1], ['perCar', '單車產值', F.money, 1], ['app', 'APP預約指定', F.pct2, 1],
      ['a1', 'A1準時定保達成', F.pct2, 1], ['a2', 'A2準時定保達成', F.pct2, 1], ['bodyPaint', '自費鈑噴達成', F.pct2, 1], ['csi', 'CSI滿意度', F.csi, 1],
      ['csiFirst', 'CSI首回滿意度', F.csi, 1], ['esSelf', 'ES自主滿意度', F.csi, 1], ['esRedesignate', 'ES服專再指定', F.pct, 1],
      ['ngFeePer100', '每100台收費NG', F.d2, -1], ['ngTimePer100', '每100台時間NG', F.d2, -1], ['keyPer100', '每100台解金鑰', F.d2, -1], ['power', '綜合戰力指數', F.score, 1]
    ],
    CA: [
      ['avgOrders', '月均結帳工單', F.int, 1], ['esign', '電子簽名率', F.pct, 1], ['card', '感心卡核卡', F.d2, 1], ['csi', 'CSI滿意度', F.csi, 1], ['csiFirst', 'CSI首回滿意度', F.csi, 1],
      ['esSelf', 'ES自主滿意度', F.csi, 1], ['plantCsiSample', '所屬廠CSI樣本達成率', F.pct, 1], ['ngFeePer100', '每100張工單收費NG', F.d2, -1], ['keyPer100', '每100張工單解金鑰', F.d2, -1], ['power', '綜合戰力指數', F.score, 1]
    ]
  };
  // 月度指標：agg = sum（可加總）| mean（比率）| ratio（業績/接車）
  const MMET = {
    SA: [['revenue', '個人業績', F.money, 'sum'], ['cars', '接車台數', F.int, 'sum'], ['perCar', '單車產值', F.money, 'ratio'], ['age', '車齡結構', F.pct, 'age'], ['app', 'APP預約指定', F.pct2, 'mean'],
      ['a1', 'A1準時定保達成', F.pct2, 'mean'], ['a2', 'A2準時定保達成', F.pct2, 'mean'], ['bodyPaint', '自費鈑噴達成', F.pct2, 'mean'], ['csi', 'CSI滿意度', F.csi, 'mean'], ['csiFirst', 'CSI首回滿意度', F.csi, 'mean'],
      ['esSelf', 'ES自主滿意度', F.csi, 'mean'], ['esRedesignate', 'ES服專再指定', F.pct, 'mean'], ['ngFee', '收費解說NG', F.int, 'sum'], ['ngTime', '時間管理NG', F.int, 'sum'], ['keyUnlock', '解金鑰次數', F.int, 'sum']],
    CA: [['orders', '結帳工單數', F.int, 'sum'], ['esign', '電子簽名率', F.pct, 'mean'], ['card', '感心卡核卡', F.d2, 'mean'], ['csi', 'CSI滿意度', F.csi, 'mean'], ['csiFirst', 'CSI首回滿意度', F.csi, 'mean'],
      ['esSelf', 'ES自主滿意度', F.csi, 'mean'], ['plantCsiSample', '所屬廠CSI樣本達成率', F.pct, 'mean'], ['ngFee', '收費解說NG', F.int, 'sum'], ['keyUnlock', '解金鑰次數', F.int, 'sum']]
  };
  function aggRows(rows, k, agg, perPerson) {
    if (agg === 'ratio') { const c = rows.map((r) => r.cars).filter(nn), v = rows.map((r) => r.revenue).filter(nn); return c.length && sum(c) ? sum(v) / sum(c) : null; }
    const v = rows.map((r) => r[k]).filter(nn);
    if (!v.length) return null;
    if (agg === 'sum') return perPerson ? sum(v) / new Set(rows.filter((r) => nn(r[k])).map((r) => r.name)).size : sum(v);
    return mean(v);
  }

  /* ======================= 5. 個人分析 ======================= */
  let pState = { mk: null, cmpBase: 'plant' };
  Pages.person = function (el, D) {
    let p = S.personId ? D.P.SA.concat(D.P.CA).find((x) => x.id === S.personId) : null;
    if (p && Store.perm().scope !== 'all' && !(Store.perm().scope === 'plant' ? p.plant === S.user.plant : p.id === S.user.self)) p = null;
    if (Store.perm().scope === 'self' && !p) p = D.P.SA.concat(D.P.CA).find((x) => x.id === S.user.self);
    const pick = D.people.SA.filter(() => roleOn('SA')).concat(D.people.CA.filter(() => roleOn('CA')));
    const picker = '<div class="f" style="min-width:260px"><label>選擇人員（' + pick.length + ' 人符合篩選）</label><select id="pp"><option value="">— 請選擇 —</option>' +
      pick.map((x) => '<option value="' + esc(x.id) + '"' + (p && p.id === x.id ? ' selected' : '') + '>' + esc(x.plant + '｜' + x.name + '｜' + roleName(x.role) + (x.status !== '現行' ? '（' + x.status + '）' : '')) + '</option>').join('') + '</select></div>';
    if (!p) {
      el.innerHTML = '<div class="page-head"><div><h1>個人分析</h1><p>請選擇人員，或由任一明細表點選姓名進入。</p></div>' + (Store.perm().scope === 'self' ? '' : picker) + '</div>' +
        card('人員清單', '<div id="plist"></div>', { flush: true });
      table(el.querySelector('#plist'), { columns: [{ key: 'plant', label: '廠別' }, { key: 'name', label: '姓名', html: (x) => UI.nameLink(x) }, { key: 'role', label: '角色', get: (x) => roleName(x.role) }, { key: 'license', label: '證照' }, { key: 'status', label: '人員狀態' }, { key: 'power', label: '綜合戰力', num: true, fmt: F.score }, { key: 'talentType', label: '人才類型', html: (x, v) => UI.pill(v, TALENT_COLOR[v]) }], rows: pick, sortKey: 'power', onRow: (x) => root.App.openPerson(x.id) });
      bindPicker(el); return;
    }
    const role = p.role, all = current(D.P[role]);
    const grp = { plant: all.filter((x) => x.plant === p.plant), company: all, license: all.filter((x) => x.license === p.license), tenure: all.filter((x) => x.tenureGroup === p.tenureGroup) };
    const avgOf = (l, k) => mean(l.map((x) => x[k]));
    const scored = all.filter((x) => nn(x.power));
    const dims = S.cfg.dimensions[role];
    const init = (p.name || ' ').slice(0, 1);
    const pos = nn(p.power) ? p.power >= S.cfg.thresholds.highPower ? 'green' : p.power >= S.cfg.thresholds.midPower ? 'blue' : 'red' : 'gray';

    const perfRows = METRICS[role].map(([k, l, f, dir]) => {
      const v = p[k]; const pool = all.map((x) => x[k]).filter(nn);
      const pr = nn(v) && pool.length > 1 ? (pool.filter((x) => x < v).length / (pool.length - 1)) : null;
      return { k, l, f, dir, v, plant: avgOf(grp.plant, k), company: avgOf(grp.company, k), license: avgOf(grp.license, k), tenure: avgOf(grp.tenure, k), pr: nn(pr) ? (dir < 0 ? 1 - pr : pr) : null };
    });
    const cmp = (v, b, dir) => (!nn(v) || !nn(b)) ? '' : ((v - b) * dir > 0 ? 'cell-good' : (v - b) * dir < 0 ? 'cell-bad' : '');

    const dimVals = dims.map((d) => ({ d, v: p[d.prKey] })).filter((x) => nn(x.v)).sort((a, b) => b.v - a.v);
    const strengths = dimVals.slice(0, 2).filter((x) => x.v >= 0.5), weak = dimVals.slice(-2).reverse().filter((x) => strengths.indexOf(x) < 0 && x.v < 0.5);
    el.innerHTML = '<div class="page-head"><div><h1>個人分析｜' + esc(p.name) + '</h1><p>期間 ' + Store.monthLabel(D.months) + '；比較對象皆為同職務現行人員。綜合戰力為管理診斷指標，非正式考核分數。</p></div>' + (Store.perm().scope === 'self' ? '' : picker) + '</div>' +
      (p.status !== '現行' ? '<div class="banner info"><b>非現行人員</b><span>' + esc(p.status) + '：保留期間績效供歷史追溯，不納入目前PR／戰力排名。</span></div>' : '') +
      (p.completeness < S.cfg.thresholds.lowCompleteness ? '<div class="banner warn"><b>資料完整度 ' + F.pct0(p.completeness) + '</b><span>資料不足時判讀宜保守；缺漏不視為績效不佳，不以0分計算。</span></div>' : '') +
      '<div class="profile">' +
      card('基本資料', '<div class="pf-head"><div class="avatar">' + esc(init) + '</div><div><div class="pf-name">' + esc(p.name) + '</div><div class="note">' + esc(p.plant) + '｜' + roleName(role) + '｜' + esc(p.position || '—') + '</div></div></div>' +
        '<div class="kv"><span>角色</span><span>' + roleName(role) + '</span><span>服務廠</span><span>' + esc(p.plant) + '（115.9最新）</span><span>現職</span><span>' + F.text(p.position) + '</span><span>證照</span><span>' + F.text(p.license) + '</span>' +
        '<span>年資</span><span>' + F.years(p.years) + '</span><span>年資群</span><span>' + F.text(p.tenureGroup) + '</span><span>人才成熟度</span><span>' + F.text(p.maturity) + '</span><span>人員狀態</span><span>' + esc(p.status) + '</span>' +
        '<span>有效資料月份</span><span>' + p.validMonths + ' 個月</span><span>資料完整度</span><span>' + F.pct0(p.completeness) + '</span>' +
        '<span>歷史實際廠別</span><span>' + (p.plantHistory.length ? esc(p.plantHistory.join('、')) : '與最新廠別一致') + '</span></div>') +
      card('戰力與人才盤點', '<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap"><div><div class="note">綜合戰力指數</div><div class="score-big" style="color:var(--' + (pos === 'green' ? 'good' : pos === 'red' ? 'bad' : pos === 'gray' ? 'gray' : 'navy-700') + ')">' + F.score(p.power) + '</div><div class="note">' + esc(p.powerBand) + '</div></div>' +
        '<div class="kv" style="flex:1;min-width:260px;grid-template-columns:110px 1fr;margin:0"><span>個人排名</span><span>' + (nn(p.rank) ? p.rank + ' / ' + scored.length : '—') + '</span><span>同證照PR</span><span>' + F.pr(p.prLicense) + '</span><span>同年資PR</span><span>' + F.pr(p.prTenure) + '</span>' +
        '<span>證照戰力落差</span><span class="' + (nn(p.licenseGap) ? (p.licenseGap >= 0 ? 'up' : 'down') : '') + '">' + F.signed1(p.licenseGap) + (nn(p.licenseGap) ? ' 分' : '') + '</span><span>升階準備度</span><span>' + UI.pill(p.promotion, promoColor(p.promotion)) + '</span>' +
        '<span>人才類型</span><span>' + UI.pill(p.talentType, TALENT_COLOR[p.talentType]) + '</span><span>人員類型</span><span>' + esc(p.personType) + '</span></div></div>' +
        '<div class="note box" style="margin-top:10px"><b>管理建議（Excel）：</b>' + esc(p.advice || '—') + '</div>' +
        '<div class="sw" style="margin-top:10px"><div><b class="up">▲ 優勢構面</b><ul>' + (strengths.map((x) => '<li>' + x.d.label + ' ' + F.pr(x.v) + '</li>').join('') || '<li>尚無構面PR ≥ 50</li>') + '</ul></div><div><b class="down">▼ 短板構面</b><ul>' + (weak.map((x) => '<li>' + x.d.label + ' ' + F.pr(x.v) + '<br><span class="note">建議：' + esc(S.cfg.training[x.d.key] || '') + '</span></li>').join('') || '<li>無明顯短板（各構面PR ≥ 50）</li>') + '</ul></div></div>') +
      '</div>' +
      '<div class="section-title">績效資訊</div>' + card('個人 vs 所屬廠／全公司／同證照／同年資 平均', '<div id="perf"></div>', { flush: true, tools: UI.exportBtns('pf') }) +
      csiCard(p, D) +
      '<div class="section-title">視覺分析</div><div class="grid g2">' +
      card('戰力構面 PR 雷達', '<div class="chart" id="r1"></div>', { sub: '外圈＝100；比較同證照平均' }) +
      card('最近月份績效', '<div class="chips-sel" id="mkSel"></div><div class="chart" id="r2"></div>', { sub: '個人 vs 當月實際廠別平均 vs 全公司平均（人均）' }) +
      card('個人 ÷ 所屬廠平均（指數）', '<div class="chart" id="r3"></div>', { sub: '所屬廠平均＝100；越少越好之指標已反向' }) +
      card('個人 vs 同證照、同年資群（構面PR）', '<div class="chart" id="r4"></div>') +
      (role === 'SA' ? card('車齡結構（服務複雜度背景，非績效）', '<div class="chart short" id="r5"></div>') : '') +
      card('量能 × 品質 四象限位置', '<div class="chart" id="r6"></div>', { sub: '紅點＝本人；灰點＝同職務現行人員' }) +
      card('戰力構面優勢與短板', '<div id="r7"></div>', { sub: '權重 × PR 貢獻' }) + '</div>';
    bindPicker(el);

    const pt = table(el.querySelector('#perf'), {
      columns: [{ key: 'l', label: '指標' }, { key: 'v', label: '個人數值', num: true, html: (r) => '<b>' + r.f(r.v) + '</b>' },
        { key: 'plant', label: '所屬廠平均', num: true, html: (r) => r.f(r.plant), cls: (r) => cmp(r.v, r.plant, r.dir) }, { key: 'company', label: '全公司平均', num: true, html: (r) => r.f(r.company), cls: (r) => cmp(r.v, r.company, r.dir) },
        { key: 'license', label: '同證照平均', num: true, html: (r) => r.f(r.license), cls: (r) => cmp(r.v, r.license, r.dir) }, { key: 'tenure', label: '同年資平均', num: true, html: (r) => r.f(r.tenure), cls: (r) => cmp(r.v, r.tenure, r.dir) },
        { key: 'pr', label: '同職務PR', num: true, fmt: F.pr, cls: (r, v) => PX.colorCell('prX', v) }], rows: perfRows, footer: false
    });
    UI.bindExport(el, 'pf', p.name + '_績效比較', pt);

    const dimAvg = (l, key) => mean(l.map((x) => x[key]));
    chart(el.querySelector('#r1'), {
      color: [C.red, C.navy2], legend: { data: ['本人', '同證照平均'] }, tooltip: { trigger: 'item' },
      radar: { indicator: dims.map((d) => ({ name: d.label.replace('PR', ''), max: 100 })), radius: '64%', splitArea: { areaStyle: { color: ['#fff', '#f8fafc'] } } },
      series: [{ type: 'radar', data: [{ name: '本人', value: dims.map((d) => nn(p[d.prKey]) ? +(p[d.prKey] * 100).toFixed(1) : null), areaStyle: { opacity: .15 } }, { name: '同證照平均', value: dims.map((d) => { const v = dimAvg(grp.license, d.prKey); return nn(v) ? +(v * 100).toFixed(1) : null; }), lineStyle: { type: 'dashed' } }] }]
    });

    const mm = PX_MM(role);
    if (!pState.mk || !mm.find((m) => m[0] === pState.mk)) pState.mk = mm[0][0];
    const drawMonthly = () => {
      el.querySelector('#mkSel').innerHTML = mm.map((m) => '<button data-k="' + m[0] + '" class="' + (pState.mk === m[0] ? 'on' : '') + '">' + m[1] + '</button>').join('');
      el.querySelectorAll('#mkSel button').forEach((b) => b.addEventListener('click', () => { pState.mk = b.dataset.k; drawMonthly(); }));
      const m = mm.find((x) => x[0] === pState.mk);
      const allRows = role === 'SA' ? S.model.saMonthly : S.model.caMonthly;
      const ms = D.months;
      const mine = ms.map((mo) => { const r = p.monthly.filter((x) => x.month === mo); return aggRows(r, m[0], m[3], false); });
      const plantAvg = ms.map((mo) => { const pr = p.monthly.find((x) => x.month === mo); const pl = pr ? pr.actualPlant : p.plant; return aggRows(allRows.filter((x) => x.month === mo && x.actualPlant === pl && x.status === '現行'), m[0], m[3], true); });
      const coAvg = ms.map((mo) => aggRows(allRows.filter((x) => x.month === mo && x.status === '現行'), m[0], m[3], true));
      const tf = (v) => nn(v) ? ((m[2] === F.pct || m[2] === F.pct2) ? +(v * 100).toFixed(2) : +v.toFixed(2)) : null;
      chart(el.querySelector('#r2'), {
        color: [C.red, C.navy2, C.gray], legend: { data: ['本人', '所屬廠平均', '全公司平均'] }, tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: ms.map((x) => x.slice(5) + '月') }, yAxis: { type: 'value', scale: true, name: (m[2] === F.pct || m[2] === F.pct2) ? '%' : '' },
        series: [{ name: '本人', type: 'line', data: mine.map(tf), symbolSize: 8, lineStyle: { width: 3 } }, { name: '所屬廠平均', type: 'line', data: plantAvg.map(tf), lineStyle: { type: 'dashed' } }, { name: '全公司平均', type: 'line', data: coAvg.map(tf), lineStyle: { type: 'dotted' } }]
      });
    };
    drawMonthly();

    const idx = perfRows.filter((r) => r.k !== 'power' && nn(r.v) && nn(r.plant) && r.plant !== 0).map((r) => ({ l: r.l, v: r.dir > 0 ? r.v / r.plant * 100 : (r.v === 0 ? 150 : r.plant / r.v * 100) }));
    chart(el.querySelector('#r3'), {
      tooltip: { trigger: 'axis', valueFormatter: (v) => nn(v) ? v.toFixed(1) : '—' }, grid: { left: 118, right: 36, top: 16, bottom: 24 },
      xAxis: { type: 'value', min: (v) => Math.min(50, Math.floor(v.min / 10) * 10), max: (v) => Math.max(150, Math.ceil(v.max / 10) * 10) }, yAxis: { type: 'category', data: idx.map((x) => x.l).reverse(), axisLabel: { fontSize: 11 } },
      series: [{ type: 'bar', barMaxWidth: 12, data: idx.map((x) => ({ value: +Math.min(x.v, 200).toFixed(1), itemStyle: { color: x.v >= 100 ? C.navy : C.red } })).reverse(), markLine: { silent: true, symbol: 'none', data: [{ xAxis: 100 }], lineStyle: { color: C.gray, type: 'dashed' }, label: { formatter: '廠平均' } } }]
    });
    chart(el.querySelector('#r4'), {
      color: [C.red, C.navy, C.sky], tooltip: { trigger: 'axis' }, legend: { data: ['本人', '同證照平均', '同年資平均'] }, grid: { bottom: 40 },
      xAxis: { type: 'category', data: dims.map((d) => d.label.replace('PR', '')), axisLabel: { fontSize: 11 } }, yAxis: { type: 'value', max: 100, name: 'PR' },
      series: [['本人', [p]], ['同證照平均', grp.license], ['同年資平均', grp.tenure]].map(([n, l]) => ({ name: n, type: 'bar', barMaxWidth: 14, data: dims.map((d) => { const v = dimAvg(l, d.prKey); return nn(v) ? +(v * 100).toFixed(1) : null; }) }))
    });
    if (role === 'SA') {
      const share = (l) => { const c = sum(l.map((x) => x.totalCars || 0)); return c ? [sum(l.map((x) => x.cars3 || 0)) / c, sum(l.map((x) => x.cars38 || 0)) / c, sum(l.map((x) => x.cars8 || 0)) / c, sum(l.map((x) => x.carsAgeMissing || 0)) / c] : [null, null, null, null]; };
      const cats = ['本人', '所屬廠', '全公司']; const vs = [share([p]), share(grp.plant), share(grp.company)];
      chart(el.querySelector('#r5'), {
        color: [C.sky, C.navy2, C.navy, C.gray], tooltip: { trigger: 'axis', valueFormatter: (v) => nn(v) ? v.toFixed(1) + '%' : '—' }, legend: { data: ['3年內', '3–8年', '8年以上', '車齡缺漏'] }, grid: { left: 60, right: 20, top: 30, bottom: 24 },
        xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } }, yAxis: { type: 'category', data: cats },
        series: ['3年內', '3–8年', '8年以上', '車齡缺漏'].map((n, i) => ({ name: n, type: 'bar', stack: 's', barMaxWidth: 22, data: vs.map((v) => nn(v[i]) ? +(v[i] * 100).toFixed(1) : null), label: { show: true, formatter: (x) => x.value >= 8 ? x.value.toFixed(0) + '%' : '', color: i >= 1 && i < 3 ? '#fff' : '#111', fontSize: 10 } }))
      });
    }
    const pts = all.filter((x) => nn(x.prVolume) && nn(x.prService));
    chart(el.querySelector('#r6'), {
      tooltip: { trigger: 'item', formatter: (x) => x.data.n + '<br>量能PR ' + x.data.value[0].toFixed(1) + '｜服務品質PR ' + x.data.value[1].toFixed(1) }, grid: { left: 52, right: 24, bottom: 44 },
      xAxis: { type: 'value', name: '量能PR', min: 0, max: 100, nameLocation: 'middle', nameGap: 26 }, yAxis: { type: 'value', name: '服務品質PR', min: 0, max: 100 },
      series: [{ type: 'scatter', symbolSize: 9, itemStyle: { color: '#cbd5e1' }, data: pts.filter((x) => x.id !== p.id).map((x) => ({ n: x.name, value: [x.prVolume * 100, x.prService * 100] })),
        markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: C.gray }, label: { show: false }, data: [{ xAxis: 50 }, { yAxis: 50 }] } },
      { type: 'scatter', symbolSize: 18, itemStyle: { color: C.red }, label: { show: true, formatter: p.name, position: 'top', fontWeight: 'bold' }, data: nn(p.prVolume) && nn(p.prService) ? [{ n: p.name, value: [p.prVolume * 100, p.prService * 100] }] : [] }]
    });
    const W = S.cfg.weights[role];
    el.querySelector('#r7').innerHTML = dims.map((d) => { const v = p[d.prKey]; return '<div class="bar-row"><span>' + d.label + '<br><span class="note">權重 ' + Math.round(W[d.key] * 100) + '%</span></span><div class="bar-track"><div class="bar-fill" style="width:' + (nn(v) ? v * 100 : 0) + '%;background:' + (!nn(v) ? 'var(--gray)' : v >= .6 ? 'var(--good)' : v >= .4 ? 'var(--navy-700)' : 'var(--bad)') + '"></div></div><b style="text-align:right;font-family:var(--num)">' + F.pr(v) + '</b></div>'; }).join('') +
      '<p class="note">貢獻分數＝權重 × PR；' + dims.map((d) => d.label.replace('PR', '') + ' ' + (nn(p[d.prKey]) ? (W[d.key] * p[d.prKey] * 100).toFixed(1) : '—')).join('、') + '</p>';
  };
  function csiCard(p, D) {
    const X = root.CSIX; if (!X || !X.has()) return '';
    const cms = X.csiMonths(D.months);
    if (!cms.length) return '<div class="section-title">顧客問卷</div><div class="banner info"><b>顧客問卷</b><span>所選期間無問卷資料。</span></div>';
    const me = X.csiAgg((x) => x.a === p.name, D.months), pl = X.csiAgg((x) => x.p === p.plant, D.months), co = X.csiAgg(() => true, D.months);
    const head = '<div class="section-title">顧客問卷（CSI服務戰情系統｜' + Store.monthLabel(cms) + '）</div>';
    if (p.role === 'CA') return head + card('所屬廠結帳服務滿意', '<div class="kv" style="grid-template-columns:160px 1fr"><span>' + esc(p.plant) + ' 結帳服務</span><span class="' + X.csiCls(pl && pl.k) + '">' + X.f2(pl && pl.k) + '（' + (pl ? pl.n : 0) + ' 份，未滿分率 ' + F.pct(pl && pl.lkRate) + '）</span><span>全公司結帳服務</span><span>' + X.f2(co && co.k) + '</span></div><p class="note">問卷未記錄出納姓名，僅以所屬廠呈現，作為出納服務背景。</p>');
    if (!me || !me.n) return head + '<div class="banner info"><b>顧客問卷</b><span>此期間查無 ' + esc(p.name) + ' 的問卷（資料未提供，不視為表現不佳）。</span></div>';
    const row = (d, l) => '<tr><td>' + l + '</td><td class="num ' + X.csiCls(me[d]) + '"><b>' + X.f2(me[d]) + '</b></td><td class="num">' + X.f2(pl && pl[d]) + '</td><td class="num">' + X.f2(co && co[d]) + '</td></tr>';
    return head + card('本人問卷滿意度（' + me.n + ' 份）', '<table class="tbl"><thead><tr><th>項目</th><th class="num">本人</th><th class="num">所屬廠</th><th class="num">全公司</th></tr></thead><tbody>' + X.DIMS.map(([d, l]) => row(d, l)).join('') +
      '<tr><td>整體未滿分率</td><td class="num">' + F.pct(me.loRate) + '</td><td class="num">' + F.pct(pl && pl.loRate) + '</td><td class="num">' + F.pct(co && co.loRate) + '</td></tr><tr><td>文字意見</td><td class="num">' + me.voc + '</td><td class="num">' + (pl ? pl.voc : '—') + '</td><td class="num">' + (co ? co.voc : '—') + '</td></tr></tbody></table>', { flush: true });
  }
  function PX_MM(role) { return MMET[role].filter((m) => m[3] !== 'age'); }
  function bindPicker(el) { const s = el.querySelector('#pp'); if (s) s.addEventListener('change', () => s.value && root.App.openPerson(s.value)); }

  /* ======================= 6. 月度推移 ======================= */
  let mState = { role: 'SA', mk: 'cars', who: '' };
  Pages.monthly = function (el, D) {
    const role = S.role === 'all' ? mState.role : S.role;
    const mets = MMET[role];
    if (!mets.find((m) => m[0] === mState.mk)) mState.mk = mets[0][0];
    const list = D.people[role];
    if (Store.perm().scope === 'self') mState.who = S.user.self;
    const who = mState.who && list.find((p) => p.id === mState.who) ? list.find((p) => p.id === mState.who) : null;
    const m = mets.find((x) => x[0] === mState.mk);
    const allRows = role === 'SA' ? S.model.saMonthly : S.model.caMonthly;
    const gran = S.filters.gran;
    const periods = []; const pm = {};
    D.months.forEach((mo) => { const k = Store.periodKey(mo, gran); if (!pm[k]) { pm[k] = []; periods.push(k); } pm[k].push(mo); });
    const scopeRows = who ? who.monthly : D.monthly[role];
    const val = (rows) => m[3] === 'age' ? null : aggRows(rows, m[0], m[3], false);
    const series = periods.map((k) => {
      const ms = pm[k];
      const rows = scopeRows.filter((r) => ms.indexOf(r.month) >= 0);
      const plantName = who ? ((rows[rows.length - 1] || {}).actualPlant || who.plant) : null;
      const plantRows = who ? allRows.filter((r) => ms.indexOf(r.month) >= 0 && r.actualPlant === plantName && r.status === '現行') : null;
      const coRows = allRows.filter((r) => ms.indexOf(r.month) >= 0 && (!who || r.status === '現行'));
      const o = { k, v: val(rows), plantAvg: who ? aggRows(plantRows, m[0], m[3], true) : null, coAvg: aggRows(coRows, m[0], m[3], !!who), plantName };
      if (m[3] === 'age') { const c = sum(rows.map((r) => r.cars || 0)); o.a3 = c ? sum(rows.map((r) => r.cars3 || 0)) / c : null; o.a38 = c ? sum(rows.map((r) => r.cars38 || 0)) / c : null; o.a8 = c ? sum(rows.map((r) => r.cars8 || 0)) / c : null; o.miss = c ? 1 - o.a3 - o.a38 - o.a8 : null; o.c = c; }
      return o;
    });
    let cum = 0;
    series.forEach((s, i) => {
      const p = series[i - 1];
      s.mom = nn(s.v) && p && nn(p.v) && p.v ? s.v / p.v - 1 : null;
      if (m[3] === 'sum') { cum += nn(s.v) ? s.v : 0; s.cum = cum; }
      const w = series.slice(Math.max(0, i - 2), i + 1).map((x) => x.v).filter(nn);
      s.ma = i >= 2 && w.length ? mean(w) : null;
    });
    const last3 = series.slice(-3).map((x) => x.v).filter(nn), prev3 = series.slice(-6, -3).map((x) => x.v).filter(nn);
    const t3 = last3.length && prev3.length && mean(prev3) ? mean(last3) / mean(prev3) - 1 : null;

    const roleSeg = S.role === 'all' ? UI.seg('mrole', [['SA', '服專'], ['CA', '出納']], role) : '';
    el.innerHTML = '<div class="page-head"><div><h1>月度推移｜' + roleName(role) + '</h1><p>依每月實際廠別；員工調廠後歷史月份仍保留原實際廠別。粒度：' + ({ month: '月', quarter: '季', year: '年' })[gran] + '（可於篩選列切換）。</p></div><div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">' + roleSeg +
      '<div class="f" style="min-width:220px"><label>分析對象</label><select id="who"' + (Store.perm().scope === 'self' ? ' disabled' : '') + '><option value="">' + (S.filters.plant ? S.filters.plant + '（依篩選）' : '全公司（依篩選）') + '</option>' + list.map((p) => '<option value="' + esc(p.id) + '"' + (who && who.id === p.id ? ' selected' : '') + '>' + esc(p.plant + '｜' + p.name) + '</option>').join('') + '</select></div></div></div>' +
      '<div class="chips-sel" id="mm" style="margin-bottom:10px">' + mets.map((x) => '<button data-k="' + x[0] + '" class="' + (x[0] === m[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>' +
      '<div class="kpis" style="margin-bottom:12px">' +
      kpi({ label: m[1] + (m[3] === 'sum' ? '（期間累積）' : '（期間平均）'), value: m[3] === 'age' ? null : (m[3] === 'sum' ? cum : val(scopeRows.filter((r) => D.months.indexOf(r.month) >= 0))), fmt: m[2], cur: series.length ? series[series.length - 1].v : null, prev: series.length > 1 ? series[series.length - 2].v : null, curLabel: series.length ? series[series.length - 1].k : '本期', prevLabel: series.length > 1 ? series[series.length - 2].k : '上期', company: m[3] === 'age' ? null : aggRows(allRows.filter((r) => D.months.indexOf(r.month) >= 0 && (!who || r.status === '現行')), m[0], m[3], !!who), companyLabel: who ? '全公司人均（現行）' : '全公司' }) +
      kpi({ label: '最近3期趨勢', value: t3, fmt: F.pctSigned, subFmt: m[2], deltaFmt: m[2], cur: last3.length ? mean(last3) : null, prev: prev3.length ? mean(prev3) : null, curLabel: '近3期平均', prevLabel: '前3期平均', light: !nn(t3) ? 'gray' : t3 >= 0 ? 'green' : t3 > S.cfg.thresholds.trendDrop ? 'yellow' : 'red', hint: '近3期平均 ÷ 前3期平均 − 1' }) +
      kpi({ label: '同期比較（去年同期）', value: null, light: 'gray', hint: '資料未提供：目前僅有 2026 年資料', curLabel: '本期', prevLabel: '去年同期' }) +
      '</div>' +
      card(m[1] + ' 推移', '<div class="chart tall" id="mc"></div>', { sub: who ? '本人 vs 當期實際廠別平均 vs 全公司平均（人均）' : '依篩選範圍合計／平均；虛線為3期移動平均' }) +
      '<div style="height:12px"></div>' + card('月度明細', '<div id="mt"></div>', { flush: true, tools: UI.exportBtns('mt') });

    UI.bindSeg(el, 'mrole', (v) => { mState.role = v; mState.who = ''; root.App.render(); });
    el.querySelector('#who').addEventListener('change', (e) => { mState.who = e.target.value; root.App.render(); });
    el.querySelectorAll('#mm button').forEach((b) => b.addEventListener('click', () => { mState.mk = b.dataset.k; root.App.render(); }));
    const tf = (v) => nn(v) ? ((m[2] === F.pct || m[2] === F.pct2) ? +(v * 100).toFixed(2) : +(+v).toFixed(2)) : null;
    const xs = series.map((s) => s.k);
    if (m[3] === 'age') {
      chart(el.querySelector('#mc'), { color: [C.sky, C.navy2, C.navy, C.gray], tooltip: { trigger: 'axis', valueFormatter: (v) => nn(v) ? v.toFixed(1) + '%' : '—' }, legend: { data: ['3年內', '3–8年', '8年以上', '車齡缺漏'] },
        xAxis: { type: 'category', data: xs }, yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
        series: [['3年內', 'a3'], ['3–8年', 'a38'], ['8年以上', 'a8'], ['車齡缺漏', 'miss']].map(([n, k]) => ({ name: n, type: 'bar', stack: 's', barMaxWidth: 36, data: series.map((s) => nn(s[k]) ? +(s[k] * 100).toFixed(1) : null) })) });
    } else {
      const ser = [{ name: who ? '本人' : m[1], type: m[3] === 'sum' ? 'bar' : 'line', data: series.map((s) => tf(s.v)), barMaxWidth: 34, symbolSize: 8, itemStyle: { color: who ? C.red : C.navy } }];
      if (who) ser.push({ name: '所屬廠平均', type: 'line', data: series.map((s) => tf(s.plantAvg)), lineStyle: { type: 'dashed' }, itemStyle: { color: C.navy2 } }, { name: '全公司平均', type: 'line', data: series.map((s) => tf(s.coAvg)), lineStyle: { type: 'dotted' }, itemStyle: { color: C.gray } });
      ser.push({ name: '3期移動平均', type: 'line', data: series.map((s) => tf(s.ma)), lineStyle: { type: 'dashed', width: 1.5 }, itemStyle: { color: C.amber }, symbol: 'none' });
      chart(el.querySelector('#mc'), { tooltip: { trigger: 'axis' }, legend: { data: ser.map((s) => s.name) }, xAxis: { type: 'category', data: xs }, yAxis: { type: 'value', scale: m[3] !== 'sum', name: (m[2] === F.pct || m[2] === F.pct2) ? '%' : '' }, series: ser });
    }
    const cols = m[3] === 'age' ? [
      { key: 'k', label: '期間' }, { key: 'c', label: '接車台數', num: true, fmt: F.int }, { key: 'a3', label: '3年內', num: true, fmt: F.pct }, { key: 'a38', label: '3–8年', num: true, fmt: F.pct }, { key: 'a8', label: '8年以上', num: true, fmt: F.pct }, { key: 'miss', label: '車齡缺漏', num: true, fmt: F.pct }
    ] : [
      { key: 'k', label: '期間' }, { key: 'v', label: m[1], num: true, fmt: m[2] }, { key: 'mom', label: '期增減率', num: true, fmt: F.pctSigned, cls: (r, v) => nn(v) ? (v >= 0 ? 'cell-good' : 'cell-bad') : '' },
      m[3] === 'sum' ? { key: 'cum', label: '累積值', num: true, fmt: m[2] } : null, { key: 'ma', label: '3期移動平均', num: true, fmt: m[2] },
      { key: 'yoy', label: '同期比較', get: () => null, html: () => '<span class="na">資料未提供</span>' },
      who ? { key: 'plantName', label: '當期實際廠別' } : null, who ? { key: 'plantAvg', label: '所屬廠平均', num: true, fmt: m[2] } : null,
      who ? { key: 'dPlant', label: '與廠平均差', num: true, get: (r) => nn(r.v) && nn(r.plantAvg) ? r.v - r.plantAvg : null, fmt: (m[2] === F.pct || m[2] === F.pct2) ? (v) => (v > 0 ? '+' : '') + (v * 100).toFixed(1) + 'pt' : F.signed1 } : null,
      { key: 'coAvg', label: who ? '全公司人均' : '全公司' + (m[3] === 'sum' ? '合計' : '平均'), num: true, fmt: m[2] },
      who ? { key: 'dCo', label: '與全公司差', num: true, get: (r) => nn(r.v) && nn(r.coAvg) ? r.v - r.coAvg : null, fmt: (m[2] === F.pct || m[2] === F.pct2) ? (v) => (v > 0 ? '+' : '') + (v * 100).toFixed(1) + 'pt' : F.signed1 } : null
    ].filter(Boolean);
    const t = table(el.querySelector('#mt'), { columns: cols, rows: series, footer: false });
    UI.bindExport(el, 'mt', '月度推移_' + m[1], t);
  };

  /* ======================= 7. 車齡結構 ======================= */
  Pages.carage = function (el, D) {
    if (S.role === 'CA') { el.innerHTML = '<div class="banner info"><b>僅適用服專</b><span>車齡結構僅分析服專接車。</span><button class="btn sm" id="sw">切換為服專</button></div>'; el.querySelector('#sw').addEventListener('click', () => root.App.setRole('SA')); return; }
    const rows = D.monthly.SA;
    const tc = sum(rows.map((r) => r.cars || 0)), c3 = sum(rows.map((r) => r.cars3 || 0)), c38 = sum(rows.map((r) => r.cars38 || 0)), c8 = sum(rows.map((r) => r.cars8 || 0)), cm = tc - c3 - c38 - c8;
    const sh = (v) => tc ? v / tc : null;
    const byPlant = {};
    rows.forEach((r) => { const k = r.actualPlant; const o = byPlant[k] = byPlant[k] || { plant: k, c: 0, c3: 0, c38: 0, c8: 0, rev: 0, bp: [] }; o.c += r.cars || 0; o.c3 += r.cars3 || 0; o.c38 += r.cars38 || 0; o.c8 += r.cars8 || 0; o.rev += r.revenue || 0; if (nn(r.bodyPaint)) o.bp.push(r.bodyPaint); });
    const plants = Object.values(byPlant).filter((o) => o.c > 0 && (S.cfg.excludedPlants || []).indexOf(o.plant) < 0).map((o) => Object.assign(o, { a3: o.c3 / o.c, a38: o.c38 / o.c, a8: o.c8 / o.c, miss: (o.c - o.c3 - o.c38 - o.c8) / o.c, perCar: o.rev / o.c, bodyPaint: mean(o.bp) })).sort((a, b) => b.a8 - a.a8);
    const people = current(D.people.SA).filter((p) => p.totalCars > 0);
    el.innerHTML = '<div class="page-head"><div><h1>車齡結構分析（服專）</h1><p>依 070 進廠日車齡：3年內／3–8年／8年以上 ÷ 總接車台數。</p></div></div>' +
      '<div class="banner info"><b>判讀原則</b><span>車齡結構僅作為服務複雜度與客群背景，<b>不得直接判定為績效好壞</b>。</span></div>' +
      '<div class="kpis">' + [['3年內', c3], ['3–8年', c38], ['8年以上', c8], ['車齡資料缺漏', cm]].map(([l, v]) => kpi({ label: l + '接車台數', value: v, unit: '台', cur: sh(v), curLabel: '占比', curFmt: F.pct, fmt: F.int, light: l === '車齡資料缺漏' ? (sh(v) > 0.1 ? 'yellow' : 'green') : 'blue', prev: null, prevLabel: '上期' })).join('') +
      kpi({ label: '車齡資料完整度', value: tc ? (c3 + c38 + c8) / tc : null, fmt: F.pct0, light: 'blue' }) + '</div>' +
      '<div class="grid g2" style="margin-top:12px">' +
      card('各服務廠車齡結構', '<div class="chart tall" id="a1"></div>', { sub: '依當月實際廠別；依8年以上占比排序' }) +
      card('各服專車齡結構', '<div class="chart tall" id="a2"></div>', { sub: '現行服專；依8年以上占比排序' }) +
      card('車齡結構 × 單車產值', '<div class="chart" id="a3"></div>', { sub: 'X＝8年以上占比；Y＝單車產值（個人）' }) +
      card('車齡結構 × 自費鈑噴達成', '<div class="chart" id="a4"></div>', { sub: 'X＝8年以上占比；Y＝自費鈑噴達成' }) + '</div>' +
      '<div style="height:12px"></div>' + card('服專車齡明細', '<div id="at"></div>', { flush: true, tools: UI.exportBtns('at') });
    const stack = (id, cats, data) => chart(el.querySelector(id), {
      color: [C.sky, C.navy2, C.navy, C.gray], tooltip: { trigger: 'axis', valueFormatter: (v) => nn(v) ? v.toFixed(1) + '%' : '—' }, legend: { data: ['3年內', '3–8年', '8年以上', '缺漏'] }, grid: { left: 70, right: 20, top: 30, bottom: 24 },
      xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } }, yAxis: { type: 'category', data: cats.slice().reverse(), axisLabel: { fontSize: 10.5 } },
      dataZoom: cats.length > 18 ? [{ type: 'slider', yAxisIndex: 0, right: 0, width: 12, start: 0, end: Math.min(100, 1800 / cats.length) }] : undefined,
      series: [['3年內', 'a3'], ['3–8年', 'a38'], ['8年以上', 'a8'], ['缺漏', 'miss']].map(([n, k]) => ({ name: n, type: 'bar', stack: 's', barMaxWidth: 14, data: data.map((o) => nn(o[k]) ? +(o[k] * 100).toFixed(1) : null).reverse() }))
    });
    stack('#a1', plants.map((o) => o.plant), plants);
    const ps = people.slice().sort((a, b) => (b.age8 || 0) - (a.age8 || 0)).map((p) => ({ n: p.name, a3: p.age3, a38: p.age38, a8: p.age8, miss: nn(p.ageComplete) ? 1 - p.ageComplete : null }));
    stack('#a2', ps.map((o) => o.n), ps);
    const sc = (id, yk, yn, fy) => {
      const pts = people.filter((p) => nn(p.age8) && nn(p[yk]));
      const xs = pts.map((p) => p.age8), ys = pts.map((p) => p[yk]);
      const mx = mean(xs), my = mean(ys);
      const r = pts.length > 2 ? sum(xs.map((x, i) => (x - mx) * (ys[i] - my))) / Math.sqrt(sum(xs.map((x) => (x - mx) ** 2)) * sum(ys.map((y) => (y - my) ** 2))) : null;
      chart(el.querySelector(id), {
        title: { text: '相關係數 r = ' + (nn(r) ? r.toFixed(2) : '—'), right: 10, top: 0, textStyle: { fontSize: 11, color: '#6b7280', fontWeight: 'normal' } },
        tooltip: { trigger: 'item', formatter: (x) => x.data.n + '<br>8年以上 ' + (x.data.value[0] * 100).toFixed(1) + '%<br>' + yn + ' ' + fy(x.data.value[1]) }, grid: { left: 64, right: 24, bottom: 44 },
        xAxis: { type: 'value', name: '8年以上占比', nameLocation: 'middle', nameGap: 26, scale: true, axisLabel: { formatter: (v) => (v * 100).toFixed(0) + '%' } }, yAxis: { type: 'value', name: yn, scale: true, axisLabel: { formatter: (v) => yk === 'bodyPaint' ? (v * 100).toFixed(0) + '%' : v.toLocaleString() } },
        series: [{ type: 'scatter', symbolSize: 10, itemStyle: { color: C.navy, opacity: .8 }, data: pts.map((p) => ({ n: p.name, value: [p.age8, p[yk]] })) }]
      });
    };
    sc('#a3', 'perCar', '單車產值', F.money); sc('#a4', 'bodyPaint', '自費鈑噴達成', F.pct);
    const t = table(el.querySelector('#at'), {
      columns: [{ key: 'plant', label: '廠別' }, { key: 'name', label: '姓名', html: (p) => UI.nameLink(p) }, { key: 'license', label: '證照' }, { key: 'totalCars', label: '累積接車', num: true, fmt: F.int }, { key: 'cars3', label: '3年內台數', num: true, fmt: F.int }, { key: 'cars38', label: '3–8年台數', num: true, fmt: F.int }, { key: 'cars8', label: '8年以上台數', num: true, fmt: F.int }, { key: 'carsAgeMissing', label: '缺漏台數', num: true, fmt: F.int },
        { key: 'age3', label: '3年內占比', num: true, fmt: F.pct }, { key: 'age38', label: '3–8年占比', num: true, fmt: F.pct }, { key: 'age8', label: '8年以上占比', num: true, fmt: F.pct }, { key: 'ageComplete', label: '車齡資料完整度', num: true, fmt: F.pct0 }, { key: 'perCar', label: '單車產值', num: true, fmt: F.money }, { key: 'bodyPaint', label: '自費鈑噴達成', num: true, fmt: F.pct2 }],
      rows: people, sortKey: 'age8', onRow: (p) => root.App.openPerson(p.id)
    });
    UI.bindExport(el, 'at', '服專車齡結構', t);
  };

  /* ======================= 8. 綜合戰力 ======================= */
  Pages.power = function (el, D) {
    const roles = ['SA', 'CA'].filter(roleOn);
    const ex = S.model.excelWeights || {};
    el.innerHTML = '<div class="page-head"><div><h1>綜合戰力與 PR 分析</h1><p>PR＝同職務現行人員中低於本人之比例（越少越好之指標反向）；構面PR＝構面內指標PR平均；綜合戰力＝Σ權重×構面PR（缺構面時依有值權重重新配分）。資料完整度 &lt;' + Math.round(S.cfg.thresholds.scoreMinCompleteness * 100) + '% 不計分。</p></div></div>' +
      '<div class="banner warn"><b>使用提醒</b><span>綜合戰力為管理診斷工具，<b>不是公司正式考核分數</b>，不建議作為單一人事決策依據。</span></div>' +
      roles.map((role) => {
        const W = S.cfg.weights[role], dims = S.cfg.dimensions[role];
        return '<div class="section-title">' + roleName(role) + '</div><div class="grid g3">' +
          card('構面與權重', '<table class="tbl"><thead><tr><th>戰力構面</th><th class="num">目前權重</th><th class="num">Excel權重</th><th>主要內容</th></tr></thead><tbody>' + dims.map((d) => '<tr><td>' + d.label + '</td><td class="num">' + Math.round(W[d.key] * 100) + '%</td><td class="num">' + (ex[role] && nn(ex[role][d.key]) ? Math.round(ex[role][d.key] * 100) + '%' : '—') + '</td><td class="wrap" style="min-width:160px">' + esc(d.desc) + '</td></tr>').join('') + '<tr class="avg"><td>合計</td><td class="num">' + Math.round(sum(Object.values(W)) * 100) + '%</td><td class="num">' + (ex[role] ? Math.round(sum(Object.values(ex[role])) * 100) + '%' : '—') + '</td><td></td></tr></tbody></table>', { flush: true, tools: S.user.role === '系統管理員' ? '<a class="btn sm" href="#/settings">調整權重</a>' : '' }) +
          card('綜合戰力分布', '<div class="chart short" id="h' + role + '"></div>') +
          card('各廠構面PR平均（熱度）', '<div class="chart" id="m' + role + '"></div>') +
          '</div><div style="height:12px"></div>' + card(roleName(role) + ' PR 與戰力明細', '<div id="t' + role + '"></div>', { flush: true, tools: UI.exportBtns('t' + role) });
      }).join('');
    roles.forEach((role) => {
      const dims = S.cfg.dimensions[role], cur = current(D.people[role]);
      const T = S.cfg.thresholds;
      const bins = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];
      chart(el.querySelector('#h' + role), { tooltip: { trigger: 'axis' }, grid: { left: 36, right: 12, top: 16, bottom: 30 }, xAxis: { type: 'category', data: bins.map((b) => b + '–' + (b + 10)) , axisLabel: { fontSize: 10 } }, yAxis: { type: 'value', minInterval: 1 },
        series: [{ type: 'bar', barMaxWidth: 26, data: bins.map((b) => ({ value: cur.filter((p) => nn(p.power) && p.power >= b && (p.power < b + 10 || (b === 90 && p.power <= 100))).length, itemStyle: { color: b >= T.highPower ? C.green : b >= T.midPower ? C.navy : C.red } })), label: { show: true, position: 'top', fontSize: 10 } }] });
      const plants = Array.from(new Set(cur.map((p) => p.plant)));
      const data = [];
      plants.forEach((pl, y) => dims.forEach((d, x) => { const v = mean(cur.filter((p) => p.plant === pl).map((p) => p[d.prKey])); data.push([x, y, nn(v) ? +(v * 100).toFixed(0) : '-']); }));
      chart(el.querySelector('#m' + role), { tooltip: { position: 'top', formatter: (x) => plants[x.data[1]] + '｜' + dims[x.data[0]].label + '：' + x.data[2] }, grid: { left: 64, right: 10, top: 8, bottom: 40 },
        xAxis: { type: 'category', data: dims.map((d) => d.label.replace('PR', '')), axisLabel: { fontSize: 10, interval: 0, rotate: 30 } }, yAxis: { type: 'category', data: plants, axisLabel: { fontSize: 10 } },
        visualMap: { min: 0, max: 100, show: false, inRange: { color: ['#c3002f', '#fde8ed', '#f8fafc', '#dbeafe', '#16294a'] } },
        series: [{ type: 'heatmap', data, label: { show: true, fontSize: 9 } }] });
      const cols = [{ key: 'plant', label: '廠別' }, { key: 'name', label: '姓名', sticky: true, html: (p) => UI.nameLink(p) }, { key: 'license', label: '證照' }, { key: 'tenureGroup', label: '年資群' }, { key: 'completeness', label: '資料完整度', num: true, fmt: F.pct0, cls: (p, v) => PX.colorCell('completeness', v) }]
        .concat(dims.map((d) => ({ key: d.prKey, label: d.label + '（' + Math.round(S.cfg.weights[role][d.key] * 100) + '%）', num: true, fmt: F.pr, cls: (p, v) => PX.colorCell('pr', v) })))
        .concat([{ key: 'power', label: '綜合戰力', num: true, fmt: F.score, cls: (p, v) => PX.colorCell('power', v) }, { key: 'rank', label: '排名', num: true }, { key: 'prLicense', label: '同證照PR', num: true, fmt: F.pr }, { key: 'prTenure', label: '同年資PR', num: true, fmt: F.pr }, { key: 'licenseGap', label: '證照戰力落差', num: true, fmt: F.signed1, cls: (p, v) => PX.colorCell('licenseGap', v) }, { key: 'powerBand', label: '戰力區間', html: (p, v) => UI.pill(v, v === '高戰力' ? 'green' : v === '中戰力' ? 'blue' : v === '低戰力' ? 'red' : 'gray') },
          { key: 'excelPower', label: 'Excel戰力', num: true, get: (p) => p.excel.power, fmt: F.score }]);
      const t = table(el.querySelector('#t' + role), { columns: cols, rows: cur, sortKey: 'power', onRow: (p) => root.App.openPerson(p.id) });
      UI.bindExport(el, 't' + role, roleName(role) + '_綜合戰力', t);
    });
  };
})(window);
