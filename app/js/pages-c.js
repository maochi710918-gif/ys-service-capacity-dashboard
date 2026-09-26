/* =========================================================================
 * 頁面 C：人才九宮格、升階與人才梯隊、排行與異常、資料品質、資料匯入、設定、權限
 * ========================================================================= */
(function (root) {
  const { Store, UI, Engine, PX, Importer, APP_CONFIG } = root; const S = Store.S;
  const { F, esc, nn, kpi, table, chart, card, C } = UI; const mean = Engine.mean, sum = Engine.sum;
  const Pages = root.Pages;
  const { current, roleName, roleOn, TALENT_COLOR, promoColor } = PX;
  const isAdmin = () => S.user.role === '系統管理員';

  /* ======================= 9. 人才九宮格 ======================= */
  let gState = { base: 'prev', cell: null };
  const CELL_CLS = { '核心／帶訓': 't-core', '升階候選': 't-core', '高潛力新星': 't-core', '資深穩定': 't-good', '穩定成長': 't-mid', '加速培育': 't-mid', '資深戰力落差': 't-warn', '重點輔導': 't-bad', '基礎養成': 't-warn' };
  Pages.grid = function (el, D) {
    const G = S.cfg.grid, T = S.cfg.thresholds;
    const roles = ['SA', 'CA'].filter(roleOn);
    const snaps = Store.snapshots();
    const baseOpts = [['prev', D.prevMonths.length ? '截至 ' + D.prevMonths[D.prevMonths.length - 1] + '（前一月重算）' : '無前期']].concat(snaps.map((s, i) => ['snap' + i, '匯入前快照：' + (s.file || '') + ' ' + String(s.at).slice(0, 10)]));
    const baseType = (p) => {
      if (gState.base === 'prev') { if (!D.Pprev) return null; const q = D.Pprev[p.role].find((x) => x.id === p.id); return q ? q.talentType : null; }
      const s = snaps[Number(gState.base.slice(4))]; return s && s.people[p.id] ? s.people[p.id].t : null;
    };
    const unfiltered = !D.pfa && !S.filters.plant && Store.perm().scope === 'all' && D.months.length === Store.allMonths().length;
    el.innerHTML = '<div class="page-head"><div><h1>人才九宮格</h1><p>橫軸＝綜合戰力（低&lt;' + T.midPower + '／中' + T.midPower + '–' + (T.highPower - 0.01) + '／高≥' + T.highPower + '）；縱軸＝人才成熟度（證照＋年資）。用於人才盤點、升階與培訓，不取代正式考核。</p></div>' +
      '<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap"><div class="f" style="min-width:240px"><label>與上期比較基準</label><select id="gBase">' + baseOpts.map((o) => '<option value="' + o[0] + '"' + (gState.base === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></div>' +
      '<button class="btn" id="gExp">⤓ 匯出人才盤點名單</button></div></div>' +
      '<div class="grid ' + (roles.length > 1 ? 'g2' : '') + '">' + roles.map((role) => card(roleName(role) + '人才九宮格', '<div id="g' + role + '"></div>', { sub: '', tools: '' })).join('') + '</div>' +
      '<div id="gCell"></div><div style="height:12px"></div>' + card('人才格位移動（與比較基準）', '<div id="gMove"></div>', { flush: true, tools: UI.exportBtns('gm') });

    const moves = [];
    roles.forEach((role) => {
      const cur = current(D.people[role]);
      const valid = cur.filter((p) => p.talentType !== '資料不足');
      let h = '<div class="nine"><div></div>' + G.bands.map((b, i) => '<div class="ax"><b>' + b + '</b>&nbsp;' + ['&lt;' + T.midPower, T.midPower + '–' + (T.highPower - 0.01), '≥' + T.highPower][i] + '</div>').join('');
      G.maturities.forEach((m) => {
        h += '<div class="ax"><b>' + m + '</b></div>';
        G.types[m].forEach((t) => {
          const ppl = valid.filter((p) => p.talentType === t);
          const prevCnt = ppl.length - ppl.filter((p) => baseType(p) !== t).length + cur.filter((p) => p.talentType !== t && baseType(p) === t).length;
          const inN = ppl.filter((p) => { const b = baseType(p); return b && b !== t; }).length, outN = cur.filter((p) => p.talentType !== t && baseType(p) === t).length;
          const ref = unfiltered && S.model.gridRef && S.model.gridRef[role] ? S.model.gridRef[role][t] : null;
          h += '<div class="cell ' + (CELL_CLS[t] || '') + (gState.cell === role + '|' + t ? ' on' : '') + '" data-c="' + role + '|' + esc(t) + '"><div class="c-t">' + esc(t) + '</div><div class="c-n">' + ppl.length + '<small style="font-size:12px;font-weight:500"> 人</small></div>' +
            '<div class="c-m">' + (inN || outN ? '<span class="up">移入 ' + inN + '</span>　<span class="down">移出 ' + outN + '</span>' : '<span class="note">無移動</span>') + (nn(ref) ? '　<span class="note" title="Excel 人才九宮格">Excel ' + ref + (ref === ppl.length ? ' ✓' : ' ≠') + '</span>' : '') + '</div>' +
            '<div class="c-names">' + ppl.map((p) => esc(p.name)).join('、') + '</div></div>';
        });
      });
      h += '</div><div class="stat-row" style="margin-top:10px"><div class="stat"><b>' + valid.length + '</b><span>有效盤點人數</span></div><div class="stat ok"><b>' + valid.filter((p) => p.power >= T.highPower).length + '</b><span>高戰力人數</span></div><div class="stat"><b>' + (cur.length - valid.length) + '</b><span>資料不足（不列入）</span></div></div>';
      el.querySelector('#g' + role).innerHTML = h;
      cur.forEach((p) => { const b = baseType(p); if (b && b !== p.talentType) moves.push({ p, from: b, to: p.talentType }); });
    });
    el.querySelector('#gBase').addEventListener('change', (e) => { gState.base = e.target.value; root.App.render(); });
    el.querySelectorAll('.nine .cell').forEach((c) => c.addEventListener('click', () => { gState.cell = c.dataset.c; showCell(); el.querySelectorAll('.nine .cell').forEach((x) => x.classList.toggle('on', x === c)); }));
    function showCell() {
      if (!gState.cell) return;
      const [role, t] = gState.cell.split('|');
      if (!roleOn(role)) return;
      const ppl = current(D.people[role]).filter((p) => p.talentType === t);
      const box = el.querySelector('#gCell');
      box.innerHTML = '<div style="height:12px"></div>' + card(roleName(role) + '｜' + esc(t) + '（' + ppl.length + '人）', '<div id="gct"></div>', { flush: true, tools: UI.exportBtns('gc') });
      const tt = table(box.querySelector('#gct'), { columns: talentCols(baseType), rows: ppl, sortKey: 'power', onRow: (p) => root.App.openPerson(p.id), short: true });
      UI.bindExport(box, 'gc', roleName(role) + '_' + t, tt);
    }
    showCell();
    const mt = table(el.querySelector('#gMove'), {
      columns: [{ key: 'role', label: '角色', get: (m) => roleName(m.p.role) }, { key: 'plant', label: '廠別', get: (m) => m.p.plant }, { key: 'name', label: '姓名', get: (m) => m.p.name, html: (m) => UI.nameLink(m.p) },
        { key: 'from', label: '原格位', html: (m) => UI.pill(m.from, TALENT_COLOR[m.from]) }, { key: 'arrow', label: '', html: () => '→' }, { key: 'to', label: '目前格位', html: (m) => UI.pill(m.to, TALENT_COLOR[m.to]) }, { key: 'power', label: '目前戰力', num: true, get: (m) => m.p.power, fmt: F.score }],
      rows: moves, sortKey: 'power'
    });
    UI.bindExport(el, 'gm', '九宮格移動', mt);
    el.querySelector('#gExp').addEventListener('click', () => {
      const rows = roles.flatMap((r) => current(D.people[r]));
      UI.exportData('人才盤點名單', talentCols(baseType), rows, 'xlsx');
    });
  };
  function talentCols(baseType) {
    return [{ key: 'role', label: '角色', get: (p) => roleName(p.role) }, { key: 'plant', label: '廠別' }, { key: 'name', label: '姓名', html: (p) => UI.nameLink(p) }, { key: 'license', label: '證照' }, { key: 'years', label: '年資', num: true, fmt: F.d1 }, { key: 'tenureGroup', label: '年資群' },
      { key: 'maturity', label: '人才成熟度' }, { key: 'power', label: '綜合戰力', num: true, fmt: F.score, cls: (p, v) => PX.colorCell('power', v) }, { key: 'powerBand', label: '戰力區間' }, { key: 'talentType', label: '人才類型', html: (p, v) => UI.pill(v, TALENT_COLOR[v]) },
      { key: 'baseType', label: '比較基準格位', get: (p) => baseType ? baseType(p) : null }, { key: 'prLicense', label: '同證照PR', num: true, fmt: F.pr }, { key: 'prTenure', label: '同年資PR', num: true, fmt: F.pr }, { key: 'licenseGap', label: '證照戰力落差', num: true, fmt: F.signed1 },
      { key: 'promotion', label: '升階準備度', html: (p, v) => UI.pill(v, promoColor(v)) }, { key: 'advice', label: '管理建議', wrap: true }];
  }

  /* ======================= 10. 升階與人才梯隊 ======================= */
  function gaps(p) {
    const T = S.cfg.thresholds, P = T.promo, out = [];
    if (!nn(p.power)) return ['資料不足，未計綜合戰力'];
    const senior = p.role === 'SA' ? String(p.license).slice(0, 3) === 'MSA' : String(p.license).indexOf('高級') >= 0;
    const assistant = p.role === 'SA' && p.license === '服務助理';
    const req = senior ? { power: P.seniorCore.power, service: P.seniorCore.service, ops: P.seniorCore.ops } : assistant ? { power: P.assistant.power, years: P.assistant.years } : { power: P.candidate.power, licensePR: P.candidate.licensePR, service: P.candidate.service, ops: P.candidate.ops };
    if (p.power < req.power) out.push('綜合戰力 ' + p.power.toFixed(1) + '（需≥' + req.power + '）');
    if (req.licensePR != null && !(p.prLicense >= req.licensePR)) out.push('同證照PR ' + F.pr(p.prLicense) + '（需≥' + req.licensePR * 100 + '）');
    if (req.service != null && !(p.prService >= req.service)) out.push('服務品質PR ' + F.pr(p.prService) + '（需≥' + req.service * 100 + '）');
    if (req.ops != null && !(p.prOps >= req.ops)) out.push('作業品質PR ' + F.pr(p.prOps) + '（需≥' + req.ops * 100 + '）');
    if (req.years != null && !(p.years >= req.years)) out.push('年資 ' + F.d1(p.years) + '（需≥' + req.years + '）');
    if (p.completeness < T.promoMinCompleteness) out.push('資料完整度 ' + F.pct(p.completeness) + '（需≥' + T.promoMinCompleteness * 100 + '%）');
    if (p.validMonths < T.minValidMonths) out.push('有效月份 ' + p.validMonths + '（建議≥' + T.minValidMonths + '）');
    return out;
  }
  function trainingFor(p) {
    const dims = S.cfg.dimensions[p.role].map((d) => ({ d, v: p[d.prKey] })).filter((x) => nn(x.v)).sort((a, b) => a.v - b.v).filter((x) => x.v < 0.5).slice(0, 2);
    return dims.map((x) => S.cfg.training[x.d.key]).filter(Boolean);
  }
  const nextLevel = (p) => {
    const L = S.cfg.ladder[p.role]; const i = L.indexOf(p.license);
    if (p.role === 'CA' && p.license === '高級出納專員') return '帶訓或儲備人選';
    if (p.role === 'SA' && i === L.length - 1) return '帶訓／儲備';
    return i >= 0 && i < L.length - 1 ? L[i + 1] : '—';
  };
  Pages.ladder = function (el, D) {
    const roles = ['SA', 'CA'].filter(roleOn);
    el.innerHTML = '<div class="page-head"><div><h1>升階與人才梯隊</h1><p>升階準備度依 Excel 公式：同時考量綜合戰力、同證照PR、服務品質PR、作業品質PR、資料完整度與有效月份；<b>不因年資長即判定可升階</b>。</p></div></div>' +
      roles.map((role) => '<div class="section-title">' + roleName(role) + '人才梯隊</div><div class="grid g4" id="lv' + role + '"></div><div style="height:12px"></div>' +
        card(roleName(role) + '升階盤點明細', '<div id="lt' + role + '"></div>', { flush: true, tools: UI.exportBtns('lt' + role) })).join('');
    roles.forEach((role) => {
      const cur = current(D.people[role]);
      const L = S.cfg.ladder[role].slice();
      const levels = L.map((lic) => ({ lic, ppl: cur.filter((p) => p.license === lic) }));
      if (role === 'CA') levels.push({ lic: '帶訓或儲備人選', ppl: cur.filter((p) => /帶訓/.test(p.promotion) || p.talentType === '核心／帶訓'), virtual: true });
      else levels.push({ lic: '帶訓／儲備人選', ppl: cur.filter((p) => /帶訓/.test(p.promotion) || p.talentType === '核心／帶訓'), virtual: true });
      el.querySelector('#lv' + role).innerHTML = levels.map((lv) => {
        const ppl = lv.ppl, avg = mean(ppl.map((p) => p.power));
        const cand = ppl.filter((p) => /候選/.test(p.promotion));
        const top = ppl.filter((p) => nn(p.prLicense) && p.prLicense >= 0.75);
        const above = ppl.filter((p) => nn(p.licenseGap) && p.licenseGap > 0), below = ppl.filter((p) => nn(p.licenseGap) && p.licenseGap < 0);
        const pos = {}; ppl.forEach((p) => { pos[p.position || '—'] = (pos[p.position || '—'] || 0) + 1; });
        const names = (l) => l.length ? l.map((p) => UI.nameLink(p)).join('、') : '<span class="na">—</span>';
        return card(esc(lv.lic), '<div class="stat-row"><div class="stat"><b>' + ppl.length + '</b><span>' + (lv.virtual ? '人選數' : '現職人數') + '</span></div><div class="stat ok"><b>' + cand.length + '</b><span>符合升階準備</span></div><div class="stat"><b>' + F.score(avg) + '</b><span>平均戰力</span></div></div>' +
          '<div class="kv" style="grid-template-columns:104px 1fr;font-size:12.5px"><span>現職分布</span><span>' + (Object.keys(pos).map((k) => esc(k) + ' ' + pos[k]).join('、') || '—') + '</span>' +
          '<span>升階候選</span><span>' + names(cand) + '</span><span>同證照前段</span><span>' + names(top) + '</span>' +
          '<span>高於同證照平均</span><span>' + above.length + ' 人</span><span>低於同證照平均</span><span>' + below.length + ' 人</span></div>', { sub: lv.virtual ? '依升階準備度／九宮格' : '' });
      }).join('');
      el.querySelectorAll('#lv' + role + ' .name-link').forEach((a) => a.addEventListener('click', () => root.App.openPerson(a.dataset.id)));
      const t = table(el.querySelector('#lt' + role), {
        columns: [{ key: 'plant', label: '廠別' }, { key: 'name', label: '姓名', sticky: true, html: (p) => UI.nameLink(p) }, { key: 'license', label: '證照' }, { key: 'position', label: '現職' }, { key: 'years', label: '年資', num: true, fmt: F.d1 }, { key: 'next', label: '下一層級', get: nextLevel },
          { key: 'power', label: '綜合戰力', num: true, fmt: F.score, cls: (p, v) => PX.colorCell('power', v) }, { key: 'prLicense', label: '同證照PR', num: true, fmt: F.pr, cls: (p, v) => PX.colorCell('pr', v) }, { key: 'prService', label: '服務品質PR', num: true, fmt: F.pr, cls: (p, v) => PX.colorCell('pr', v) }, { key: 'prOps', label: '作業品質PR', num: true, fmt: F.pr, cls: (p, v) => PX.colorCell('pr', v) },
          { key: 'completeness', label: '資料完整度', num: true, fmt: F.pct }, { key: 'validMonths', label: '有效月份', num: true }, { key: 'licenseGap', label: '證照戰力落差', num: true, fmt: F.signed1, cls: (p, v) => PX.colorCell('licenseGap', v) },
          { key: 'promotion', label: '升階準備度', html: (p, v) => UI.pill(v, promoColor(v)) }, { key: 'gaps', label: '尚缺條件', wrap: true, get: (p) => /候選/.test(p.promotion) ? '已符合' : gaps(p).join('；') || '—' },
          { key: 'train', label: '建議培訓項目', wrap: true, get: (p) => trainingFor(p).join('；') || '—' }],
        rows: cur, sortKey: 'power', onRow: (p) => root.App.openPerson(p.id)
      });
      UI.bindExport(el, 'lt' + role, roleName(role) + '_升階盤點', t);
    });
  };

  /* ======================= 11. 排行與異常 ======================= */
  let rState = { role: 'SA', mk: 'power', n: '10', dir: 'desc', af: '' };
  const RANK_METRICS = [
    ['power', '綜合戰力', F.score, 'both'], ['totalCars', '接車台數', F.int, 'SA'], ['totalOrders', '結帳工單', F.int, 'CA'], ['avgRevenue', '月均業績', F.money, 'SA'], ['perCar', '單車產值', F.money, 'SA'],
    ['csi', 'CSI', F.csi, 'both'], ['app', 'APP預約指定', F.pct, 'SA'], ['esign', '電子簽名率', F.pct, 'CA'], ['growth', '成長率（近3月量能）', F.pctSigned, 'both'], ['prLicense', '同證照PR', F.pr, 'both'], ['prTenure', '同年資PR', F.pr, 'both']
  ];
  Pages.rank = function (el, D) {
    const role = S.role === 'all' ? rState.role : S.role;
    const mets = RANK_METRICS.filter((m) => m[3] === 'both' || m[3] === role);
    if (!mets.find((m) => m[0] === rState.mk)) rState.mk = 'power';
    const m = mets.find((x) => x[0] === rState.mk);
    const get = (p) => m[0] === 'growth' ? (role === 'SA' ? p.trendCars : p.trendOrders) : p[m[0]];
    const cur = current(D.people[role]).filter((p) => nn(get(p)));
    cur.sort((a, b) => rState.dir === 'desc' ? get(b) - get(a) : get(a) - get(b));
    const top = rState.n === 'all' ? cur : cur.slice(0, Number(rState.n));
    const alerts = PX.buildAlerts(D);
    const ps = Store.plantStats(D).rows;
    ps.filter((r) => r.saCount > 0 && r.caCount === 0).forEach((r) => alerts.push({ key: 'plantZero', label: '服務廠出納配置為0', level: 'red', detail: r.plant + '：服專 ' + r.saCount + ' 人、出納 0 人', person: { plant: r.plant, name: '—', role: 'CA', id: '' }, plantOnly: true }));
    const types = Array.from(new Set(alerts.map((a) => a.label)));
    const shown = rState.af ? alerts.filter((a) => a.label === rState.af) : alerts;
    const T = S.cfg.thresholds;
    el.innerHTML = '<div class="page-head"><div><h1>排行與異常管理</h1><p>排行僅比較同職務現行人員；異常門檻集中於「指標與權重設定」，可調整。</p></div></div>' +
      '<div class="grid g2">' + card('排行榜', '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">' + (S.role === 'all' ? UI.seg('rrole', [['SA', '服專'], ['CA', '出納']], role) : '') + UI.seg('rn', [['10', 'Top 10'], ['20', 'Top 20'], ['all', '全部']], rState.n) + UI.seg('rdir', [['desc', '由高至低'], ['asc', '由低至高']], rState.dir) + '</div>' +
        '<div class="chips-sel" id="rm">' + mets.map((x) => '<button data-k="' + x[0] + '" class="' + (x[0] === m[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div><div class="chart tall" id="rc"></div>', { sub: roleName(role) + '｜' + m[1] }) +
      card('排行明細', '<div id="rt"></div>', { flush: true, tools: UI.exportBtns('rt') }) + '</div>' +
      '<div class="section-title">異常清單（' + alerts.length + ' 筆）</div>' +
      card('異常清單', '<div class="chips-sel" style="margin-bottom:8px" id="af"><button data-k="" class="' + (!rState.af ? 'on' : '') + '">全部 ' + alerts.length + '</button>' + types.map((t) => '<button data-k="' + esc(t) + '" class="' + (rState.af === t ? 'on' : '') + '">' + esc(t) + ' ' + alerts.filter((a) => a.label === t).length + '</button>').join('') + '</div><div id="at"></div>',
        { tools: UI.exportBtns('at') + (isAdmin() ? '<a class="btn sm" href="#/settings">調整門檻</a>' : ''), sub: '高量低品質：量能PR≥' + T.highVolumePR * 100 + '且服務品質PR<' + T.lowQualityPR * 100 + '；近3月下降：≤' + T.trendDrop * 100 + '%；CSI：≤' + T.csiDrop + '點；落差：≤' + T.licenseGap + '分；完整度<' + T.lowCompleteness * 100 + '%；有效月份<' + T.minValidMonths });
    UI.bindSeg(el, 'rrole', (v) => { rState.role = v; root.App.render(); });
    UI.bindSeg(el, 'rn', (v) => { rState.n = v; root.App.render(); });
    UI.bindSeg(el, 'rdir', (v) => { rState.dir = v; root.App.render(); });
    el.querySelectorAll('#rm button').forEach((b) => b.addEventListener('click', () => { rState.mk = b.dataset.k; root.App.render(); }));
    el.querySelectorAll('#af button').forEach((b) => b.addEventListener('click', () => { rState.af = b.dataset.k; root.App.render(); }));
    const tf = (v) => m[2] === F.pct || m[2] === F.pctSigned || m[0].indexOf('pr') === 0 ? +(v * 100).toFixed(1) : +v.toFixed(1);
    const c = chart(el.querySelector('#rc'), {
      tooltip: { trigger: 'axis', formatter: (x) => x[0].name + '：' + m[2](get(top[top.length - 1 - x[0].dataIndex])) }, grid: { left: 110, right: 50, top: 10, bottom: 20 },
      xAxis: { type: 'value', scale: m[0] === 'csi' }, yAxis: { type: 'category', data: top.map((p) => p.plant.replace('廠', '') + '｜' + p.name).reverse(), axisLabel: { fontSize: 11 } },
      dataZoom: top.length > 20 ? [{ type: 'slider', yAxisIndex: 0, right: 0, width: 12, start: 100 - 2000 / top.length, end: 100 }] : undefined,
      series: [{ type: 'bar', barMaxWidth: 16, data: top.map((p) => ({ value: tf(get(p)), itemStyle: { color: m[0] === 'power' ? (p.power >= T.highPower ? C.green : p.power >= T.midPower ? C.navy : C.red) : (get(p) < 0 ? C.red : C.navy) } })).reverse(), label: { show: true, position: 'right', fontSize: 10, formatter: (x) => m[2](get(top[top.length - 1 - x.dataIndex])) } }]
    });
    if (c) c.on('click', (e) => { const p = top[top.length - 1 - e.dataIndex]; if (p) root.App.openPerson(p.id); });
    const rt = table(el.querySelector('#rt'), {
      columns: [{ key: 'rk', label: '名次', num: true, get: (p) => cur.indexOf(p) + 1 }, { key: 'plant', label: '廠別' }, { key: 'name', label: '姓名', html: (p) => UI.nameLink(p) }, { key: 'license', label: '證照' }, { key: 'v', label: m[1], num: true, get, fmt: m[2] }, { key: 'power', label: '綜合戰力', num: true, fmt: F.score }, { key: 'talentType', label: '人才類型', html: (p, v) => UI.pill(v, TALENT_COLOR[v]) }],
      rows: top, sortKey: 'rk', sortDir: 1, onRow: (p) => root.App.openPerson(p.id), short: true
    });
    UI.bindExport(el, 'rt', '排行_' + m[1], rt);
    const lv = { red: '需關注', yellow: '接近警戒', green: '正向', gray: '資料不足', blue: '資訊' };
    const at = table(el.querySelector('#at'), {
      columns: [{ key: 'level', label: '燈號', html: (a) => UI.dot(a.level) + ' ' + lv[a.level], sortVal: (a) => ['red', 'yellow', 'blue', 'gray', 'green'].indexOf(a.level) }, { key: 'label', label: '異常類型' }, { key: 'role', label: '角色', get: (a) => roleName(a.person.role) }, { key: 'plant', label: '廠別', get: (a) => a.person.plant },
        { key: 'name', label: '姓名', get: (a) => a.person.name, html: (a) => a.plantOnly ? '—' : UI.nameLink(a.person) }, { key: 'license', label: '證照', get: (a) => a.person.license }, { key: 'power', label: '綜合戰力', num: true, get: (a) => a.person.power, fmt: F.score }, { key: 'detail', label: '判斷依據' }],
      rows: shown, sortKey: 'level', sortDir: 1
    });
    UI.bindExport(el, 'at', '異常清單', at);
  };

  /* ======================= 12. 資料品質 ======================= */
  let qState = { lv: '' };
  Pages.quality = function (el, D) {
    const items = Store.qualityItems();
    const lvs = ['重要', '提醒', '需留意'];
    const shown = qState.lv ? items.filter((x) => x.level === qState.lv) : items;
    const rec = reconcile();
    el.innerHTML = '<div class="page-head"><div><h1>資料品質</h1><p>Excel「資料檢核」全數保留，並加上系統自動檢核。<b>缺漏資料不視為績效不佳</b>，不以0分計算。最後更新：' + esc(String((S.model.meta || {}).importedAt || '').replace('T', ' ').slice(0, 16)) + '</p></div></div>' +
      '<div class="stat-row" style="margin-bottom:12px">' + lvs.map((l) => '<div class="stat ' + (l === '重要' ? 'err' : l === '提醒' ? 'wn' : '') + '" style="cursor:pointer" data-lv="' + l + '"><b>' + items.filter((x) => x.level === l).length + '</b><span>' + l + '</span></div>').join('') +
      '<div class="stat ok"><b>' + items.filter((x) => x.done).length + ' / ' + items.length + '</b><span>已處理</span></div><div class="stat ' + (rec.bad ? 'err' : 'ok') + '"><b>' + rec.ok + ' / ' + rec.rows.length + '</b><span>與Excel核對一致</span></div></div>' +
      card('資料檢核項目', '<div class="chips-sel" style="margin-bottom:8px" id="ql"><button data-k="" class="' + (!qState.lv ? 'on' : '') + '">全部 ' + items.length + '</button>' + lvs.map((l) => '<button data-k="' + l + '" class="' + (qState.lv === l ? 'on' : '') + '">' + l + '</button>').join('') + '</div><div id="qt"></div>', { tools: UI.exportBtns('qt') }) +
      '<div style="height:12px"></div>' + card('與 Excel 核對（驗收）', '<div id="rc"></div>', { flush: true, sub: '全期、全公司、不含篩選；系統依月度明細重算後與 Excel 原值比較', tools: UI.exportBtns('rc') });
    el.querySelectorAll('[data-lv]').forEach((b) => b.addEventListener('click', () => { qState.lv = b.dataset.lv; root.App.render(); }));
    el.querySelectorAll('#ql button').forEach((b) => b.addEventListener('click', () => { qState.lv = b.dataset.k; root.App.render(); }));
    const t = table(el.querySelector('#qt'), {
      columns: [{ key: 'level', label: '層級', html: (x) => UI.pill(x.level, x.level === '重要' ? 'red' : x.level === '提醒' ? 'yellow' : 'blue'), sortVal: (x) => lvs.indexOf(x.level) }, { key: 'src', label: '來源' }, { key: 'item', label: '檢核項目', wrap: true }, { key: 'finding', label: '發現問題', wrap: true }, { key: 'handling', label: '本次處理方式', wrap: true },
        { key: 'months', label: '影響月份', get: (x) => x.months.length ? (x.months.length > 3 ? x.months[0] + '–' + x.months[x.months.length - 1].slice(5) : x.months.join('、')) : '—' }, { key: 'roles', label: '影響角色', get: (x) => x.roles.join('、') || '—' },
        { key: 'people', label: '影響人員', wrap: true, get: (x) => x.people.length ? (x.people.length > 8 ? x.people.slice(0, 8).join('、') + '…等' + x.people.length + '人' : x.people.join('、')) : '—' },
        { key: 'done', label: '是否已處理', get: (x) => x.done ? '已處理' : '未處理', html: (x) => '<label style="white-space:nowrap"><input type="checkbox" data-q="' + esc(x.id) + '"' + (x.done ? ' checked' : '') + (isAdmin() ? '' : ' disabled') + '> ' + (x.done ? '已處理' : '未處理') + '</label>' },
        { key: 'updated', label: '最後更新時間', get: (x) => String(x.updated).replace('T', ' ').slice(0, 16) }],
      rows: shown, sortKey: 'level', sortDir: 1
    });
    UI.bindExport(el, 'qt', '資料品質', t);
    el.querySelectorAll('[data-q]').forEach((c) => c.addEventListener('change', () => { Store.setChecked(c.dataset.q, c.checked); UI.toast('已更新處理狀態'); root.App.render(); }));
    const rt = table(el.querySelector('#rc'), {
      columns: [{ key: 'grp', label: '類別' }, { key: 'item', label: '核對項目' }, { key: 'excel', label: 'Excel 值', num: true, fmt: (v) => nn(v) ? (Math.abs(v) >= 1000 ? F.int(v) : +v.toFixed(2)) : '—' }, { key: 'sys', label: '系統值', num: true, fmt: (v) => nn(v) ? (Math.abs(v) >= 1000 ? F.int(v) : +v.toFixed(2)) : '—' },
        { key: 'ok', label: '結果', get: (r) => r.ok ? '一致' : '不一致', html: (r) => r.ok ? UI.pill('✓ 一致', 'green') : UI.pill('≠ ' + (r.note || '不一致'), 'red') }],
      rows: rec.rows, footer: false
    });
    UI.bindExport(el, 'rc', 'Excel核對', rt);
  };
  function reconcile() {
    const P = Store.peopleFor(Store.allMonths()), ref = S.model.overviewRef || {}, T = S.cfg.thresholds;
    const sa = P.SA.filter((p) => p.status === '現行'), ca = P.CA.filter((p) => p.status === '現行');
    const roster = S.model.plants || [];
    const rows = [];
    const add = (grp, item, excel, sys, note) => { if (excel == null) return; rows.push({ grp, item, excel, sys, ok: nn(sys) && Math.abs(excel - sys) <= 1e-6 * Math.max(1, Math.abs(excel)), note }); };
    const sumM = (arr, k) => sum(arr.map((r) => r[k] || 0));
    add('管理總覽', '現行服專人數', ref['現行服專人數'], sum(roster.map((r) => r.saCount || 0)));
    add('管理總覽', '現行出納人數', ref['現行出納人數'], sum(roster.map((r) => r.caCount || 0)));
    add('管理總覽', '1–8月全體接車台數', ref['1–8月全體接車台數'], sumM(S.model.saMonthly, 'cars'));
    add('管理總覽', '1–8月全體服專業績', ref['1–8月全體服專業績'], sumM(S.model.saMonthly, 'revenue'));
    add('管理總覽', '1–8月全體結帳工單', ref['1–8月全體結帳工單'], sumM(S.model.caMonthly, 'orders'));
    add('管理總覽', '服專高量人數(PR≥75%)', ref['服專高量人數(PR≥75%)'], sa.filter((p) => p.prVolume >= T.highVolumePR).length);
    add('管理總覽', '服專高量需改善', ref['服專高量需改善'], sa.filter((p) => p.personType === '高量需改善').length);
    add('管理總覽', '出納高量人數(PR≥75%)', ref['出納高量人數(PR≥75%)'], ca.filter((p) => p.prVolume >= T.highVolumePR).length);
    add('管理總覽', '出納高量需改善', ref['出納高量需改善'], ca.filter((p) => p.personType === '高量需改善').length);
    add('管理總覽', '115.9出納0人據點', ref['115.9出納0人據點'], roster.filter((r) => r.saCount > 0 && r.caCount === 0).length);
    (S.model.overviewMonthly || []).forEach((m) => {
      add('月度推移', m.month + ' 接車台數', m.cars, sumM(S.model.saMonthly.filter((r) => r.month === m.month), 'cars'));
      add('月度推移', m.month + ' 服專業績', m.revenue, sumM(S.model.saMonthly.filter((r) => r.month === m.month), 'revenue'));
      add('月度推移', m.month + ' 結帳工單', m.orders, sumM(S.model.caMonthly.filter((r) => r.month === m.month), 'orders'));
    });
    ['SA', 'CA'].forEach((role) => {
      const g = S.model.gridRef && S.model.gridRef[role]; if (!g) return;
      const cur = role === 'SA' ? sa : ca;
      Object.keys(g).forEach((t) => add('人才九宮格', roleName(role) + '｜' + t, g[t], cur.filter((p) => p.talentType === t).length));
    });
    // 個人綜合戰力逐人核對
    ['SA', 'CA'].forEach((role) => {
      const cur = role === 'SA' ? sa : ca;
      const scored = cur.filter((p) => nn(p.excel.power));
      const okN = scored.filter((p) => nn(p.power) && Math.abs(p.power - p.excel.power) < 1e-6).length;
      add('綜合戰力', roleName(role) + '逐人綜合戰力一致人數（共 ' + scored.length + ' 人）', scored.length, okN);
      const okR = scored.filter((p) => p.rank === p.excel.rank).length;
      add('綜合戰力', roleName(role) + '逐人排名一致人數', scored.length, okR);
      const okP = cur.filter((p) => p.promotion === p.excel.promotion).length;
      add('升階準備度', roleName(role) + '逐人升階準備度一致人數', cur.length, okP);
      const okT = cur.filter((p) => nn(p.excel.prTenure) ? Math.abs(p.prTenure - p.excel.prTenure) < 1e-6 : !nn(p.prTenure)).length;
      add('同年資PR', roleName(role) + '逐人同年資PR一致人數', cur.length, okT, 'Excel「<1年」條件錯誤，見檢核項目');
    });
    // 服務廠量能
    const psD = Store.plantStats({ P, people: P, pfa: false }, { all: true });
    const keys = [['saAvgCars', '服專月均接車'], ['saPower', '服專平均戰力'], ['caAvgOrders', '出納月均結帳'], ['caPower', '出納平均戰力']];
    roster.forEach((r) => keys.forEach(([k, l]) => { const s = psD.rows.find((x) => x.plant === r.plant); if (nn(r[k])) add('服務廠量能', r.plant + ' ' + l, r[k], s ? s[k] : null); }));
    return { rows, ok: rows.filter((r) => r.ok).length, bad: rows.filter((r) => !r.ok).length };
  }

  /* ======================= 13. 資料匯入 ======================= */
  let pending = null, lastResult = null;
  Pages.import = function (el) {
    const mapRows = [];
    Object.keys(APP_CONFIG.FIELD_MAP).forEach((sh) => { const m = APP_CONFIG.FIELD_MAP[sh]; Object.keys(m.cols).forEach((h) => mapRows.push({ sheet: sh, col: h.replace(/\n/g, ''), field: m.cols[h], req: m.required.indexOf(h) >= 0 ? '必要' : '' })); });
    el.innerHTML = '<div class="page-head"><div><h1>資料匯入與更新</h1><p>上傳相同格式之 Excel（工作表名稱與欄位標題相同）。系統會讀取所有工作表、驗證欄位、檢查重複／空值／月份／廠別，並自動重算 PR、綜合戰力、排名、九宮格與升階準備度。</p></div>' +
      '<div style="display:flex;gap:8px"><button class="btn" id="rst">還原為預設 Excel 資料</button></div></div>' +
      '<div class="banner info"><b>目前資料</b><span>' + esc((S.model.meta || {}).fileName || '') + '（' + (S.source === 'import' ? '使用者匯入' : '預設') + '）；期間 ' + Store.monthLabel(Store.allMonths()) + '；服專 ' + S.model.saPeople.length + ' 人、出納 ' + S.model.caPeople.length + ' 人；月度 ' + (S.model.saMonthly.length + S.model.caMonthly.length) + ' 筆。</span></div>' +
      card('步驟一：選擇檔案', '<div class="drop" id="drop"><p style="font-size:15px;margin:0 0 8px">將 Excel 拖曳到此處，或</p><label class="btn primary">選擇 .xlsx 檔案<input type="file" id="file" accept=".xlsx,.xlsm,.xls" hidden></label><p class="note" style="margin:10px 0 0">檔案僅在瀏覽器內解析，不會上傳至外部伺服器。</p></div>') +
      '<div id="preview"></div><div id="result"></div><div style="height:12px"></div>' +
      card('欄位對應表（資料模型）', '<div id="fm"></div>', { flush: true, tools: UI.exportBtns('fm'), sub: 'Excel 工作表／欄位 → 系統欄位' });
    const fm = table(el.querySelector('#fm'), { columns: [{ key: 'sheet', label: '工作表' }, { key: 'col', label: 'Excel 欄位' }, { key: 'field', label: '系統欄位' }, { key: 'req', label: '必要欄位' }], rows: mapRows, short: true });
    UI.bindExport(el, 'fm', '欄位對應表', fm);
    const drop = el.querySelector('#drop');
    ['dragover', 'dragenter'].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (ev) => { const f = ev.dataTransfer.files[0]; if (f) readFile(f); });
    el.querySelector('#file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) readFile(f); });
    el.querySelector('#rst').addEventListener('click', () => { if (confirm('確定還原為預設 Excel 資料？（目前匯入的資料將被取代）')) { Store.resetModel(); pending = null; lastResult = null; UI.toast('已還原預設資料'); root.App.rerender(); } });
    if (pending) renderPreview(el); if (lastResult) renderResult(el);

    function readFile(f) {
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const wb = XLSX.read(new Uint8Array(rd.result), { type: 'array' });
          const { model, report } = Importer.parseWorkbook(XLSX, wb, f.name);
          model.meta.importedAt = new Date().toISOString();
          pending = { model, report, file: f.name, size: f.size };
          lastResult = null; renderPreview(el); el.querySelector('#result').innerHTML = '';
        } catch (e) { UI.toast('無法讀取檔案：' + e.message); }
      };
      rd.readAsArrayBuffer(f);
    }
  };
  function renderPreview(el) {
    const { model, report } = pending;
    const cfg = Store.defaultConfig();
    let P = null, err = null;
    try { if (!report.errors.length) P = Engine.buildPeople(model, cfg, model.meta.months); } catch (e) { err = e.message; }
    const oldNames = new Set(S.model.saPeople.concat(S.model.caPeople).map((p) => p.role + ':' + p.name));
    const newNames = new Set(model.saPeople.concat(model.caPeople).map((p) => p.role + ':' + p.name));
    const added = Array.from(newNames).filter((n) => !oldNames.has(n)), removed = Array.from(oldNames).filter((n) => !newNames.has(n));
    const st = report.stats;
    const rowsOk = (st.saPeople || 0) + (st.caPeople || 0) + (st.saMonthly || 0) + (st.caMonthly || 0) + (st.plants || 0) + (st.plantMonthly || 0) + (st.checks || 0);
    const failRows = report.errors.filter((e) => e.row).length;
    const gridCnt = (role) => { if (!P) return ''; const c = {}; P[role].filter((p) => p.status === '現行').forEach((p) => { c[p.talentType] = (c[p.talentType] || 0) + 1; }); return Object.keys(c).map((k) => k + ' ' + c[k]).join('、'); };
    el.querySelector('#preview').innerHTML = '<div style="height:12px"></div>' + card('步驟二：匯入前預覽｜' + esc(pending.file), '<div class="stat-row"><div class="stat ok"><b>' + rowsOk + '</b><span>可匯入筆數</span></div><div class="stat err"><b>' + report.errors.length + '</b><span>錯誤</span></div><div class="stat wn"><b>' + report.warnings.length + '</b><span>警告</span></div><div class="stat"><b>' + (st.months || []).length + '</b><span>月份數</span></div><div class="stat"><b>' + (st.plantMismatch || 0) + '</b><span>廠別不一致筆數</span></div></div>' +
      '<div class="kv" style="grid-template-columns:130px 1fr"><span>讀取工作表</span><span>' + esc(report.sheets.join('、')) + '</span><span>月份</span><span>' + esc((st.months || []).join('、')) + '</span>' +
      '<span>各表筆數</span><span>服專總覽 ' + st.saPeople + '、出納總覽 ' + st.caPeople + '、服專月度 ' + st.saMonthly + '、出納月度 ' + st.caMonthly + '、服務廠量能 ' + st.plants + '、廠別月度 ' + st.plantMonthly + '、資料檢核 ' + st.checks + '</span>' +
      '<span>人員異動</span><span>新增 ' + added.length + ' 人' + (added.length ? '（' + esc(added.slice(0, 10).map((n) => n.split(':')[1]).join('、')) + (added.length > 10 ? '…' : '') + '）' : '') + '；移除 ' + removed.length + ' 人' + (removed.length ? '（' + esc(removed.slice(0, 10).map((n) => n.split(':')[1]).join('、')) + '）' : '') + '</span>' +
      (P ? '<span>重算後九宮格（服專）</span><span>' + esc(gridCnt('SA')) + '</span><span>重算後九宮格（出納）</span><span>' + esc(gridCnt('CA')) + '</span>' : '') + (err ? '<span>重算錯誤</span><span class="down">' + esc(err) + '</span>' : '') + '</div>' +
      (report.errors.length ? '<div class="banner bad" style="margin-top:10px"><b>錯誤原因</b><span>' + report.errors.slice(0, 30).map((e) => esc(e.sheet + (e.row ? ' 第' + e.row + '列' : '') + '：' + e.msg)).join('<br>') + '</span></div>' : '') +
      (report.warnings.length ? '<details style="margin-top:10px"><summary>警告明細（' + report.warnings.length + '）</summary><div class="note" style="max-height:220px;overflow:auto">' + report.warnings.slice(0, 300).map((e) => esc(e.sheet + (e.row ? ' 第' + e.row + '列' : '') + '：' + e.msg)).join('<br>') + '</div></details>' : '') +
      '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn red" id="doImp"' + (report.errors.length || !P ? ' disabled' : '') + '>確認匯入並重新計算</button><button class="btn" id="cancelImp">取消</button></div>');
    el.querySelector('#cancelImp').addEventListener('click', () => { pending = null; el.querySelector('#preview').innerHTML = ''; });
    const b = el.querySelector('#doImp');
    if (b) b.addEventListener('click', () => {
      const ok = Store.applyImport(model, report);
      lastResult = { rowsOk, failRows, warnings: report.warnings.length, errors: report.errors, months: st.months, added, removed, people: report.affectedPeople.length, saved: ok, file: pending.file };
      pending = null; UI.toast('匯入完成，已重新計算'); root.App.rerender();
    });
  }
  function renderResult(el) {
    const r = lastResult;
    el.querySelector('#result').innerHTML = '<div style="height:12px"></div>' + card('匯入結果｜' + esc(r.file), '<div class="stat-row"><div class="stat ok"><b>' + r.rowsOk + '</b><span>成功筆數</span></div><div class="stat err"><b>' + r.failRows + '</b><span>失敗筆數</span></div><div class="stat wn"><b>' + r.warnings + '</b><span>警告筆數</span></div><div class="stat"><b>' + r.people + '</b><span>受影響人員</span></div></div>' +
      '<div class="kv" style="grid-template-columns:130px 1fr"><span>錯誤原因</span><span>' + (r.errors.length ? r.errors.map((e) => esc(e.msg)).join('<br>') : '無') + '</span><span>受影響月份</span><span>' + esc((r.months || []).join('、')) + '</span><span>人員異動</span><span>新增 ' + r.added.length + '、移除 ' + r.removed.length + '</span><span>已重算</span><span>PR、綜合戰力、排名、人才九宮格、升階準備度、資料檢核</span>' +
      (r.saved ? '' : '<span>注意</span><span class="down">瀏覽器儲存空間不足，重新整理後將回到預設資料</span>') + '</div>');
  }

  /* ======================= 14. 指標與權重設定 ======================= */
  const TH_LABELS = [
    ['戰力與九宮格', [['highPower', '高戰力門檻（分）'], ['midPower', '中戰力門檻（分）'], ['scoreMinCompleteness', '計分所需最低資料完整度（0–1）'], ['promoMinCompleteness', '升階評估最低資料完整度（0–1）'], ['highVolumePR', '高量能 PR 門檻（0–1）']]],
    ['異常判斷', [['lowQualityPR', '品質偏低：服務品質PR <'], ['goodQualityPR', '品質佳：服務品質PR ≥'], ['lowVolumePR', '量能未釋放：量能PR <'], ['lowPerCarRatio', '單車產值偏低：< 全公司平均 ×'], ['trendDrop', '近3月量能下降：趨勢 ≤'], ['csiDrop', '近3月CSI下降：變化 ≤（點）'], ['ngHighPR', '作業NG偏高：作業品質PR ≤'], ['licenseGap', '證照戰力落差 ≤（分）'], ['topPR', '低年資進入前段：PR ≥'], ['lowCompleteness', '資料完整度不足 <'], ['minValidMonths', '有效月份不足 <（月）'], ['loadHighRatio', '人均負荷偏高：> 全公司平均 ×']]],
    ['KPI 燈號', [['kpiYellowPct', '黃燈：增減率 ≥（負值）'], ['completenessGreen', '完整度綠燈 ≥'], ['completenessYellow', '完整度黃燈 ≥']]]
  ];
  const PROMO_LABELS = [['seniorCore', 'MSA／高級出納 → 核心帶訓候選', ['power', 'service', 'ops']], ['seniorStable', 'MSA／高級出納 → 高階穩定', ['power']], ['candidate', 'SA/SSA/出納專員 → 升階候選', ['power', 'licensePR', 'service', 'ops']], ['near', '接近升階', ['power', 'licensePR']], ['assistant', '服務助理 → SA培養候選', ['power', 'years']]];
  const PK = { power: '戰力≥', service: '服務品質PR≥', ops: '作業品質PR≥', licensePR: '同證照PR≥', years: '年資≥' };
  Pages.settings = function (el) {
    const cfg = Store.clone(S.cfg), ex = S.model.excelWeights || {}, def = Store.defaultConfig();
    el.innerHTML = '<div class="page-head"><div><h1>指標與權重設定</h1><p>系統預設值與 Excel「綜合戰力指數」「指標定義」一致；調整後所有頁面即時重算。設定儲存在本機瀏覽器。</p></div><div style="display:flex;gap:8px"><button class="btn" id="sReset">還原 Excel 預設</button><button class="btn red" id="sSave">儲存並重新計算</button></div></div>' +
      '<div id="wErr"></div><div class="grid g2">' + ['SA', 'CA'].map((role) => card(roleName(role) + '綜合戰力權重', S.cfg.dimensions[role].map((d) => '<div class="w-row"><span><b>' + d.label + '</b><br><span class="note">' + esc(d.desc) + '</span></span><input type="number" min="0" max="100" step="1" data-w="' + role + '.' + d.key + '" value="' + Math.round(cfg.weights[role][d.key] * 1000) / 10 + '"><span class="note">%　Excel 預設 ' + (ex[role] && nn(ex[role][d.key]) ? Math.round(ex[role][d.key] * 100) : Math.round(def.weights[role][d.key] * 100)) + '%</span></div>').join('') + '<div class="w-row"><b>合計</b><b id="sum' + role + '" style="text-align:right"></b><span></span></div>')).join('') + '</div>' +
      TH_LABELS.map(([g, items]) => '<div class="section-title">' + g + '</div>' + card(g, '<div class="form-grid">' + items.map(([k, l]) => '<div class="f"><label>' + l + '　<span class="note">預設 ' + def.thresholds[k] + '</span></label><input type="number" step="any" data-t="' + k + '" value="' + cfg.thresholds[k] + '"></div>').join('') + '</div>')).join('') +
      '<div class="section-title">升階準備度門檻（Excel 公式）</div>' + card('升階準備度', '<div class="form-grid">' + PROMO_LABELS.map(([k, l, fs]) => fs.map((f) => '<div class="f"><label>' + l + '：' + PK[f] + '　<span class="note">預設 ' + def.thresholds.promo[k][f] + '</span></label><input type="number" step="any" data-p="' + k + '.' + f + '" value="' + cfg.thresholds.promo[k][f] + '"></div>').join('')).join('') + '</div>');
    const upd = () => ['SA', 'CA'].forEach((role) => { const s = sum(Array.from(el.querySelectorAll('[data-w^="' + role + '."]')).map((i) => Number(i.value) || 0)); const b = el.querySelector('#sum' + role); b.textContent = s.toFixed(1) + '%'; b.style.color = Math.abs(s - 100) < 0.01 ? 'var(--good)' : 'var(--bad)'; });
    el.querySelectorAll('[data-w]').forEach((i) => i.addEventListener('input', upd)); upd();
    el.querySelector('#sReset').addEventListener('click', () => { Store.resetConfig(); UI.toast('已還原 Excel 預設'); root.App.rerender(); });
    el.querySelector('#sSave').addEventListener('click', () => {
      const bad = [];
      ['SA', 'CA'].forEach((role) => { const s = sum(Array.from(el.querySelectorAll('[data-w^="' + role + '."]')).map((i) => Number(i.value) || 0)); if (Math.abs(s - 100) > 0.01) bad.push(roleName(role) + '權重合計 ' + s.toFixed(1) + '%，須為 100%'); });
      if (bad.length) { el.querySelector('#wErr').innerHTML = '<div class="banner bad"><b>無法儲存</b><span>' + bad.join('；') + '</span></div>'; return; }
      el.querySelectorAll('[data-w]').forEach((i) => { const [r, k] = i.dataset.w.split('.'); cfg.weights[r][k] = Number(i.value) / 100; });
      el.querySelectorAll('[data-t]').forEach((i) => { cfg.thresholds[i.dataset.t] = Number(i.value); });
      el.querySelectorAll('[data-p]').forEach((i) => { const [k, f] = i.dataset.p.split('.'); cfg.thresholds.promo[k][f] = Number(i.value); });
      Store.saveConfig(cfg); UI.toast('設定已儲存，已重新計算'); root.App.rerender();
    });
  };

  /* ======================= 15. 權限管理 ======================= */
  Pages.perms = function (el) {
    const NAV = root.App.NAV, roles = Object.keys(S.cfg.permissions);
    const sees = (role, page) => { if (page === 'import' || page === 'settings') return role === '系統管理員'; if (page === 'perms') return true; const p = S.cfg.permissions[role]; return p.pages === '*' || p.pages.indexOf(page) >= 0; };
    const scopeTxt = { all: '全部服務廠、全部人員', plant: '僅自己服務廠', self: '僅本人資料' };
    const desc = { '服務部主管': '查看全部服務廠、全部人員及人才盤點', 'HRBP': '查看人才九宮格、升階準備度及人員分析', '廠長': '只能查看自己服務廠', '個人': '只能查看自己的資料', '系統管理員': '管理資料匯入、權重、門檻及帳號' };
    const acc = Store.accounts();
    el.innerHTML = '<div class="page-head"><div><h1>權限管理</h1><p>目前身分：<b>' + esc(S.user.role) + '</b>' + (S.user.plant ? '（' + esc(S.user.plant) + '）' : '') + (S.user.self ? '（' + esc(S.user.self.split(':')[1]) + '）' : '') + '。</p></div></div>' +
      '<div class="banner warn"><b>說明</b><span>此為前端權限示範（身分切換、頁面與資料範圍控管）。正式上線時請串接公司 SSO／AD 與後端 API 授權，勿僅依前端控管。</span></div>' +
      card('角色與資料範圍', '<div id="pr"></div>', { flush: true }) + '<div style="height:12px"></div>' +
      card('角色 × 頁面權限矩陣', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="sticky">頁面</th>' + roles.map((r) => '<th>' + esc(r) + '</th>').join('') + '</tr></thead><tbody>' + NAV.map((n) => '<tr><td class="sticky">' + n[1] + '</td>' + roles.map((r) => '<td style="text-align:center">' + (sees(r, n[0]) ? '<span class="up">✓</span>' : '<span class="na">—</span>') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>', { flush: true }) + '<div style="height:12px"></div>' +
      card('帳號（示範）', '<div id="acc"></div>' + (isAdmin() ? '<div class="form-grid" style="margin-top:10px;align-items:end"><div class="f"><label>名稱</label><input id="aName"></div><div class="f"><label>角色</label><select id="aRole">' + roles.map((r) => '<option>' + r + '</option>').join('') + '</select></div><div class="f"><label>服務廠（廠長用）</label><select id="aPlant"><option value=""></option>' + Store.options(Store.peopleFor(Store.allMonths())).plants.map((p) => '<option>' + esc(p) + '</option>').join('') + '</select></div><div class="f"><label>&nbsp;</label><button class="btn primary" id="aAdd">新增帳號</button></div></div>' : '<p class="note">僅系統管理員可新增或刪除帳號。</p>'));
    table(el.querySelector('#pr'), { columns: [{ key: 'r', label: '角色' }, { key: 'd', label: '權限說明' }, { key: 's', label: '資料範圍' }, { key: 'n', label: '可檢視頁面數', num: true }, { key: 'b', label: '', html: (x) => '<button class="btn sm" data-sw="' + esc(x.r) + '">切換為此身分</button>' }], rows: roles.map((r) => ({ r, d: desc[r] || '', s: scopeTxt[S.cfg.permissions[r].scope], n: NAV.filter((n) => sees(r, n[0])).length })), footer: false });
    el.querySelectorAll('[data-sw]').forEach((b) => b.addEventListener('click', () => root.App.askUserRole(b.dataset.sw)));
    table(el.querySelector('#acc'), { columns: [{ key: 'name', label: '帳號名稱' }, { key: 'role', label: '角色' }, { key: 'plant', label: '服務廠' }, { key: 'op', label: '', html: (a, v) => '<button class="btn sm" data-use="' + acc.indexOf(a) + '">使用此帳號</button>' + (isAdmin() ? ' <button class="btn sm" data-del="' + acc.indexOf(a) + '">刪除</button>' : '') }], rows: acc, footer: false });
    el.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => { const a = acc[Number(b.dataset.use)]; if (a.role === '個人' && !a.self) return root.App.askUserRole('個人'); root.App.setUserRole(a.role, { plant: a.plant, self: a.self }); }));
    el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { acc.splice(Number(b.dataset.del), 1); Store.saveAccounts(acc); root.App.render(); }));
    const add = el.querySelector('#aAdd');
    if (add) add.addEventListener('click', () => { const n = el.querySelector('#aName').value.trim(); if (!n) return UI.toast('請輸入名稱'); acc.push({ name: n, role: el.querySelector('#aRole').value, plant: el.querySelector('#aPlant').value, self: '' }); Store.saveAccounts(acc); root.App.render(); });
  };
})(window);
