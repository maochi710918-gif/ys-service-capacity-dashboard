/* =========================================================================
 * 狀態、篩選、權限與衍生資料（資料層；不含畫面）
 * 未來串接公司 API／資料庫時，只需替換 loadModel() 的來源。
 * ========================================================================= */
(function (root) {
  const E = root.Engine, CFGM = root.APP_CONFIG, nn = E.nn, mean = E.mean, sum = E.sum;
  const LS = { model: 'ys_dash_model', cfg: 'ys_dash_cfg', user: 'ys_dash_user', snaps: 'ys_dash_snapshots', checks: 'ys_dash_checks', accounts: 'ys_dash_accounts' };
  const lsGet = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) { } };
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const DEFAULT_FILTERS = { period: 'all', mStart: '', mEnd: '', gran: 'month', plant: '', name: '', license: '', yMin: '', yMax: '', tenure: '', maturity: '', talent: '', status: '', position: '', band: '', promo: '', minMonths: '' };

  const S = {
    model: null, report: null, cfg: null, source: 'default',
    role: 'all', page: 'overview', personId: null,
    filters: clone(DEFAULT_FILTERS),
    user: { role: '服務部主管', plant: '', self: '' },
    cache: {}
  };

  /* ---------- 載入 ---------- */
  function loadModel() {
    const saved = lsGet(LS.model);
    if (saved && saved.model) { S.model = saved.model; S.report = saved.report; S.source = 'import'; }
    else { S.model = clone(root.RAW_MODEL); S.report = root.RAW_REPORT; S.source = 'default'; }
  }
  function defaultConfig() {
    const c = clone(CFGM.DEFAULT_CONFIG);
    // 權重預設值以 Excel「綜合戰力指數」工作表為準
    const w = S.model && S.model.excelWeights;
    if (w) ['SA', 'CA'].forEach((r) => Object.keys(w[r] || {}).forEach((k) => { c.weights[r][k] = w[r][k]; }));
    return c;
  }
  function deepMerge(a, b) {
    Object.keys(b || {}).forEach((k) => {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') deepMerge(a[k], b[k]);
      else a[k] = b[k];
    });
    return a;
  }
  function loadConfig() {
    const over = lsGet(LS.cfg);
    S.cfg = deepMerge(defaultConfig(), over ? { weights: over.weights, thresholds: over.thresholds, capacity: over.capacity } : {});
  }
  function saveConfig(cfg) { lsSet(LS.cfg, { weights: cfg.weights, thresholds: cfg.thresholds, capacity: cfg.capacity }); S.cfg = cfg; S.cache = {}; }
  function resetConfig() { lsDel(LS.cfg); loadConfig(); S.cache = {}; }
  function init() {
    loadModel(); loadConfig();
    const u = lsGet(LS.user); if (u) S.user = Object.assign(S.user, u);
    const ms = allMonths(); S.filters.mStart = ms[0]; S.filters.mEnd = ms[ms.length - 1];
  }

  /* ---------- 匯入 ---------- */
  function applyImport(model, report) {
    // 先保存目前盤點快照，供九宮格「與上期比較」
    const snap = snapshot();
    const snaps = lsGet(LS.snaps) || [];
    snaps.push(snap); while (snaps.length > 6) snaps.shift();
    lsSet(LS.snaps, snaps);
    S.model = model; S.report = report; S.source = 'import'; S.cache = {};
    const ok = lsSet(LS.model, { model, report });
    loadConfig();
    const ms = allMonths(); S.filters.mStart = ms[0]; S.filters.mEnd = ms[ms.length - 1];
    return ok;
  }
  function resetModel() { lsDel(LS.model); loadModel(); loadConfig(); S.cache = {}; const ms = allMonths(); S.filters.mStart = ms[0]; S.filters.mEnd = ms[ms.length - 1]; }
  function snapshot() {
    const P = peopleFor(allMonths());
    const o = { at: (S.model.meta && S.model.meta.importedAt) || new Date().toISOString(), file: S.model.meta && S.model.meta.fileName, people: {} };
    ['SA', 'CA'].forEach((r) => P[r].filter((p) => p.status === '現行').forEach((p) => { o.people[p.id] = { t: p.talentType, pw: p.power }; }));
    return o;
  }
  const snapshots = () => lsGet(LS.snaps) || [];

  /* ---------- 期間 ---------- */
  function allMonths() { return (S.model.meta.months || []).slice(); }
  function rangeMonths() {
    const ms = allMonths(), f = S.filters;
    return ms.filter((m) => (!f.mStart || m >= f.mStart) && (!f.mEnd || m <= f.mEnd));
  }
  function periodOptions() {
    const ms = allMonths(); if (!ms.length) return [];
    const y = ms[0].slice(0, 4);
    const opts = [['all', y + ' 全期（' + ms[0].slice(5) + '–' + ms[ms.length - 1].slice(5) + '月）']];
    const qs = {};
    ms.forEach((m) => { const q = Math.ceil(Number(m.slice(5)) / 3); (qs[q] = qs[q] || []).push(m); });
    Object.keys(qs).forEach((q) => opts.push(['Q' + q, y + ' Q' + q + '（' + qs[q].map((m) => Number(m.slice(5))).join('、') + '月）']));
    ms.forEach((m) => opts.push(['M' + m, m]));
    opts.push(['custom', '自訂區間']);
    return opts;
  }
  function setPeriod(v) {
    const ms = allMonths(), f = S.filters; f.period = v;
    if (v === 'all') { f.mStart = ms[0]; f.mEnd = ms[ms.length - 1]; }
    else if (v[0] === 'Q') { const q = Number(v.slice(1)); const qm = ms.filter((m) => Math.ceil(Number(m.slice(5)) / 3) === q); f.mStart = qm[0]; f.mEnd = qm[qm.length - 1]; }
    else if (v[0] === 'M') { f.mStart = f.mEnd = v.slice(1); }
  }
  const monthLabel = (ms) => !ms.length ? '—' : ms.length === 1 ? ms[0] : ms[0] + '–' + ms[ms.length - 1].slice(5);
  function periodKey(m, gran) {
    if (gran === 'quarter') return m.slice(0, 4) + ' Q' + Math.ceil(Number(m.slice(5)) / 3);
    if (gran === 'year') return m.slice(0, 4);
    return m;
  }

  /* ---------- 人員（依期間重算，快取） ---------- */
  function peopleFor(months) {
    const key = months.join(',') + '|' + JSON.stringify(S.cfg.weights) + JSON.stringify(S.cfg.thresholds) + JSON.stringify(S.cfg.capacity);
    if (!S.cache[key]) S.cache[key] = E.buildPeople(S.model, S.cfg, months);
    return S.cache[key];
  }

  /* ---------- 權限 ---------- */
  function perm() { return S.cfg.permissions[S.user.role] || S.cfg.permissions['服務部主管']; }
  function canSee(page) { const p = perm(); return p.pages === '*' || p.pages.indexOf(page) >= 0; }
  function scopePass(p) {
    const sc = perm().scope;
    if (sc === 'plant') return !S.user.plant || p.plant === S.user.plant;
    if (sc === 'self') return p.id === S.user.self;
    return true;
  }
  function scopeMonthlyPass(r, role) {
    const sc = perm().scope;
    if (sc === 'plant') return !S.user.plant || r.actualPlant === S.user.plant || r.latestPlant === S.user.plant;
    if (sc === 'self') return (role + ':' + r.name) === S.user.self;
    return true;
  }
  function saveUser() { lsSet(LS.user, S.user); }

  /* ---------- 篩選 ---------- */
  const PERSON_KEYS = ['name', 'license', 'yMin', 'yMax', 'tenure', 'maturity', 'talent', 'status', 'position', 'band', 'promo', 'minMonths'];
  const personFilterActive = () => PERSON_KEYS.some((k) => S.filters[k] !== '' && S.filters[k] != null);
  function personPass(p, opt) {
    const f = S.filters; opt = opt || {};
    if (!scopePass(p)) return false;
    if (!opt.ignorePlant && f.plant && p.plant !== f.plant) return false;
    if (f.name && String(p.name).indexOf(f.name.trim()) < 0) return false;
    if (f.license && p.license !== f.license) return false;
    if (f.yMin !== '' && !(nn(p.years) && p.years >= Number(f.yMin))) return false;
    if (f.yMax !== '' && !(nn(p.years) && p.years <= Number(f.yMax))) return false;
    if (f.tenure && p.tenureGroup !== f.tenure) return false;
    if (f.maturity && p.maturity !== f.maturity) return false;
    if (f.talent && p.talentType !== f.talent) return false;
    if (f.status && p.status !== f.status) return false;
    if (f.position && p.position !== f.position) return false;
    if (f.band && p.powerBand !== f.band) return false;
    if (f.promo && p.promotion !== f.promo) return false;
    if (f.minMonths !== '' && !(p.validMonths >= Number(f.minMonths))) return false;
    return true;
  }

  /* ---------- 主衍生資料 ---------- */
  function derive() {
    const months = rangeMonths();
    const P = peopleFor(months);
    const prevMonths = months.length > 1 ? months.slice(0, -1) : [];
    const Pprev = prevMonths.length ? peopleFor(prevMonths) : null;
    const ctx = E.roleContext(P, S.cfg);
    const people = { SA: P.SA.filter((p) => personPass(p)), CA: P.CA.filter((p) => personPass(p)) };
    const allScoped = { SA: P.SA.filter(scopePass), CA: P.CA.filter(scopePass) };
    // 月度列：月份在區間、實際廠別符合、人員通過個人篩選
    const passIds = { SA: new Set(P.SA.filter((p) => personPass(p, { ignorePlant: true })).map((p) => p.name)), CA: new Set(P.CA.filter((p) => personPass(p, { ignorePlant: true })).map((p) => p.name)) };
    const pfa = personFilterActive();
    const mfilter = (rows, role, ms) => rows.filter((r) => ms.indexOf(r.month) >= 0 && (!S.filters.plant || r.actualPlant === S.filters.plant) && (!pfa || passIds[role].has(r.name)) && scopeMonthlyPass(r, role));
    const monthly = { SA: mfilter(S.model.saMonthly, 'SA', months), CA: mfilter(S.model.caMonthly, 'CA', months) };
    const monthlyAllMonths = { SA: mfilter(S.model.saMonthly, 'SA', allMonths()), CA: mfilter(S.model.caMonthly, 'CA', allMonths()) };
    return { months, prevMonths, P, Pprev, ctx, people, allScoped, monthly, monthlyAllMonths, pfa };
  }

  /* ---------- 月度彙總 ---------- */
  function monthlySeries(monthly, months, gran) {
    const keys = []; const map = {};
    months.forEach((m) => { const k = periodKey(m, gran || 'month'); if (!map[k]) { map[k] = { key: k, months: [], sa: [], ca: [] }; keys.push(k); } map[k].months.push(m); });
    monthly.SA.forEach((r) => { const k = periodKey(r.month, gran || 'month'); if (map[k]) map[k].sa.push(r); });
    monthly.CA.forEach((r) => { const k = periodKey(r.month, gran || 'month'); if (map[k]) map[k].ca.push(r); });
    return keys.map((k) => {
      const g = map[k], v = (rows, f) => rows.map((r) => r[f]).filter(nn);
      const cars = v(g.sa, 'cars'), rev = v(g.sa, 'revenue'), ord = v(g.ca, 'orders');
      const tc = cars.length ? sum(cars) : null, tr = rev.length ? sum(rev) : null;
      return {
        key: k, months: g.months,
        cars: tc, revenue: tr, orders: ord.length ? sum(ord) : null,
        perCar: tc ? tr / tc : null,
        app: mean(v(g.sa, 'app')), esign: mean(v(g.ca, 'esign')),
        saCsi: mean(v(g.sa, 'csi')), caCsi: mean(v(g.ca, 'csi')),
        a1: mean(v(g.sa, 'a1')), a2: mean(v(g.sa, 'a2')), bodyPaint: mean(v(g.sa, 'bodyPaint')),
        cars3: sum(v(g.sa, 'cars3')), cars38: sum(v(g.sa, 'cars38')), cars8: sum(v(g.sa, 'cars8')),
        saRows: g.sa.length, caRows: g.ca.length
      };
    });
  }

  /* ---------- 服務廠彙總（最新廠別、現行人員） ---------- */
  function plantStats(D, opt) {
    opt = opt || {};
    const roster = {}; (S.model.plants || []).forEach((r) => { roster[r.plant] = r; });
    const names = []; const seen = {};
    const push = (n) => { if (n && !seen[n]) { seen[n] = 1; names.push(n); } };
    (S.model.plants || []).forEach((r) => push(r.plant));
    if (!(S.model.plants || []).length) D.P.SA.concat(D.P.CA).forEach((p) => push(p.plant));
    const EX = S.cfg.excludedPlants || [];
    for (let i = names.length - 1; i >= 0; i--) if (EX.indexOf(names[i]) >= 0) names.splice(i, 1);
    const T = S.cfg.thresholds;
    const cur = (role, plant) => D.people[role].filter((p) => p.status === '現行' && p.plant === plant);
    const rows = names.filter((n) => opt.all || ((!S.filters.plant || n === S.filters.plant) && (perm().scope !== 'plant' || !S.user.plant || n === S.user.plant))).map((n) => {
      const sa = cur('SA', n), ca = cur('CA', n), ro = roster[n] || {};
      const useRoster = opt.all || (!D.pfa && perm().scope !== 'self');
      const o = {
        plant: n,
        saCount: useRoster && nn(ro.saCount) ? ro.saCount : sa.length,
        caCount: useRoster && nn(ro.caCount) ? ro.caCount : ca.length,
        saAvgCars: mean(sa.map((p) => p.avgCars)), capacityRate: mean(sa.map((p) => p.capacityRate)), saAvgRevenue: mean(sa.map((p) => p.avgRevenue)), saPerCar: mean(sa.map((p) => p.perCar)),
        app: mean(sa.map((p) => p.app)), saCsi: mean(sa.map((p) => p.csi)), saPower: mean(sa.map((p) => p.power)),
        caAvgOrders: mean(ca.map((p) => p.avgOrders)), esign: mean(ca.map((p) => p.esign)), caCsi: mean(ca.map((p) => p.csi)), caPower: mean(ca.map((p) => p.power)),
        high: sa.concat(ca).filter((p) => nn(p.power) && p.power >= T.highPower).length,
        saHigh: sa.filter((p) => nn(p.power) && p.power >= T.highPower).length, caHigh: ca.filter((p) => nn(p.power) && p.power >= T.highPower).length,
        coach: sa.concat(ca).filter((p) => p.coach).length,
        revTarget: ro.revTarget, revActual: ro.revActual, revRate: ro.revRate, cumTarget: ro.cumTarget, cumActual: ro.cumActual, cumRate: ro.cumRate, workdays: ro.workdays,
        saPeople: sa, caPeople: ca, excelNote: ro.note || ''
      };
      return o;
    }).filter((o) => o.saCount || o.caCount || o.saPeople.length || o.caPeople.length || o.excelNote);
    // 全公司平均（個人平均口徑）
    const all = { SA: D.people.SA.filter((p) => p.status === '現行'), CA: D.people.CA.filter((p) => p.status === '現行') };
    const avg = {
      plant: '全公司平均', saCount: mean(rows.map((r) => r.saCount)), caCount: mean(rows.map((r) => r.caCount)),
      saAvgCars: mean(all.SA.map((p) => p.avgCars)), saAvgRevenue: mean(all.SA.map((p) => p.avgRevenue)), saPerCar: mean(all.SA.map((p) => p.perCar)),
      app: mean(all.SA.map((p) => p.app)), saCsi: mean(all.SA.map((p) => p.csi)), saPower: mean(all.SA.map((p) => p.power)),
      caAvgOrders: mean(all.CA.map((p) => p.avgOrders)), esign: mean(all.CA.map((p) => p.esign)), caCsi: mean(all.CA.map((p) => p.csi)), caPower: mean(all.CA.map((p) => p.power)),
      high: mean(rows.map((r) => r.high)), coach: mean(rows.map((r) => r.coach)), capacityRate: mean(all.SA.map((p) => p.capacityRate)),
      revRate: (() => { const t = sum(rows.map((r) => r.revTarget || 0)); return t ? sum(rows.map((r) => r.revActual || 0)) / t : null; })(),
      cumRate: (() => { const t = sum(rows.map((r) => r.cumTarget || 0)); return t ? sum(rows.map((r) => r.cumActual || 0)) / t : null; })()
    };
    rows.forEach((r) => {
      const notes = [];
      if (r.caCount === 0) notes.push('出納0人');
      if (r.caCount > 0 && r.saCount === 0) notes.push('無服專（' + (r.plant.indexOf('鈑噴') >= 0 ? '鈑噴據點' : '需確認') + '）');
      if (nn(r.saAvgCars) && nn(avg.saAvgCars) && r.saAvgCars > avg.saAvgCars * T.loadHighRatio) notes.push('服專人均負荷偏高');
      if (nn(r.caAvgOrders) && nn(avg.caAvgOrders) && r.caAvgOrders > avg.caAvgOrders * T.loadHighRatio) notes.push('出納人均負荷偏高');
      if (r.plant === '未辨識') notes.push('來源廠別未辨識');
      r.note = notes.join('；');
      r.light = r.caCount === 0 ? 'red' : notes.length ? 'yellow' : 'green';
    });
    return { rows, avg };
  }

  /* ---------- 選項清單 ---------- */
  function options(P) {
    const all = P.SA.concat(P.CA);
    const uniq = (f) => Array.from(new Set(all.map(f).filter((v) => nn(v) && v !== ''))).sort((a, b) => String(a).localeCompare(String(b), 'zh-Hant'));
    const roster = (S.model.plants || []).map((r) => r.plant);
    const plants = Array.from(new Set(roster.length ? roster : all.map((p) => p.plant))).filter((p) => p && (S.cfg.excludedPlants || []).indexOf(p) < 0);
    return {
      plants, licenses: uniq((p) => p.license), positions: uniq((p) => p.position), statuses: uniq((p) => p.status),
      promos: uniq((p) => p.promotion), talents: S.cfg.grid.maturities.flatMap((m) => S.cfg.grid.types[m]).concat(['資料不足']),
      tenures: S.cfg.tenureGroups.map((g) => g.label), maturities: S.cfg.grid.maturities, bands: ['高戰力', '中戰力', '低戰力', '資料不足']
    };
  }

  function findPerson(id) { const P = peopleFor(rangeMonths()); return P.SA.concat(P.CA).find((p) => p.id === id) || null; }

  /* ---------- 資料檢核（Excel + 系統自動） ---------- */
  function qualityItems() {
    const P = peopleFor(allMonths());
    const allPeople = P.SA.concat(P.CA);
    const names = allPeople.map((p) => p.name);
    const handled = lsGet(LS.checks) || {};
    const stamp = (S.model.meta && S.model.meta.importedAt) || '';
    const monthsOf = (t) => {
      const out = new Set(); const ms = allMonths();
      (String(t).match(/(\d{1,2})月/g) || []).forEach((x) => { const n = String(parseInt(x, 10)).padStart(2, '0'); ms.forEach((m) => { if (m.slice(5) === n) out.add(m); }); });
      (String(t).match(/(\d)\/(\d)\/(\d)(\/\d)*/g) || []).forEach((x) => x.split('/').forEach((n) => ms.forEach((m) => { if (Number(m.slice(5)) === Number(n)) out.add(m); })));
      if (/115\.8|8月考核/.test(t)) ms.filter((m) => m.slice(5) === '08').forEach((m) => out.add(m));
      return Array.from(out).sort();
    };
    const rolesOf = (t) => { const r = []; if (/服專|接車|070|自費鈑噴|APP/.test(t)) r.push('服專'); if (/出納|結帳|9U2|電子簽名|感心卡/.test(t)) r.push('出納'); if (/考核/.test(t) && !r.length) r.push('服專', '出納'); return r; };
    const items = (S.model.checks || []).map((c, i) => {
      const txt = [c.item, c.finding, c.handling].join(' ');
      const id = 'x' + i + ':' + c.item;
      return {
        id, src: 'Excel資料檢核', level: c.level, item: c.item, finding: c.finding, handling: c.handling,
        months: monthsOf(c.item + ' ' + c.finding), roles: rolesOf(txt), people: Array.from(new Set(names.filter((n) => txt.indexOf(n) >= 0))),
        done: handled[id] != null ? handled[id] : !!c.handling, updated: stamp
      };
    });
    // 系統自動檢核
    const sys = [];
    ['SA', 'CA'].forEach((role) => {
      const map = CFGM.FIELD_MAP[role === 'SA' ? '服專總覽' : '出納總覽'].cols;
      const diffs = {};
      P[role].forEach((p) => Object.values(map).forEach((k) => {
        if (['plant', 'name', 'license', 'years', 'status', 'position', 'advice'].indexOf(k) >= 0) return;
        const ex = p.excel[k], me = p[k];
        if (typeof ex === 'number' && nn(me) && Math.abs(ex - me) > 1e-6 * Math.max(1, Math.abs(ex))) (diffs[k] = diffs[k] || []).push(p.name);
        else if (ex == null && typeof me === 'number' && me !== 0 && k.indexOf('pr') === 0) (diffs[k] = diffs[k] || []).push(p.name);
      }));
      Object.keys(diffs).forEach((k) => {
        const label = Object.keys(map).find((h) => map[h] === k) || k;
        const special = k === 'prTenure';
        sys.push({
          id: 'sys-diff-' + role + k, src: '系統重算核對', level: '需留意', item: (role === 'SA' ? '服專' : '出納') + '「' + label.replace(/\n/g, '') + '」系統重算與Excel不一致（' + diffs[k].length + '人）',
          finding: special ? 'Excel 同年資PR 使用 COUNTIFS 條件「<1年」時，Excel 將其解讀為比較運算子（小於字串「1年」），導致「<1年」群組的母體範圍錯誤；其餘年資群一致。' : '系統依月度明細重算之數值與 Excel 總覽不同。',
          handling: special ? '系統依「指標定義」：同職務、同年資群現行人員比較。受影響者僅同年資PR顯示值不同，不影響綜合戰力、九宮格與升階準備度。' : '以系統重算值呈現，請確認來源。',
          months: allMonths(), roles: [role === 'SA' ? '服專' : '出納'], people: diffs[k], done: true, updated: stamp
        });
      });
    });
    const mm = S.model.plantMismatch || [];
    if (mm.length) sys.push({ id: 'sys-plant', src: '系統自動檢核', level: '提醒', item: '月度實際廠別與115.9最新廠別不同（' + mm.length + '筆）', finding: '調廠或跨廠支援人員之歷史月份保留實際廠別。', handling: '人員總覽依最新廠別；月度分析依當月實際廠別，不搬移歷史資料。', months: Array.from(new Set(mm.map((m) => m.month))).sort(), roles: Array.from(new Set(mm.map((m) => m.role === 'SA' ? '服專' : '出納'))), people: Array.from(new Set(mm.map((m) => m.name))), done: true, updated: stamp });
    const roster = S.model.plants || [];
    const caRoster = sum(roster.map((r) => r.caCount || 0)), caData = P.CA.filter((p) => p.status === '現行').length;
    if (caRoster !== caData) sys.push({ id: 'sys-ca-roster', src: '系統自動檢核', level: '提醒', item: '115.9名冊出納 ' + caRoster + ' 人，出納總覽現行 ' + caData + ' 人', finding: roster.filter((r) => (r.caCount || 0) > P.CA.filter((p) => p.status === '現行' && p.plant === r.plant).length).map((r) => r.plant + ' 名冊 ' + r.caCount + ' 人／有資料 ' + P.CA.filter((p) => p.status === '現行' && p.plant === r.plant).length + ' 人').join('；'), handling: '人數依名冊；個人量能、PR 與戰力僅計有資料者，缺資料者不以0分計算。', months: allMonths(), roles: ['出納'], people: [], done: true, updated: stamp });
    const ex = S.cfg.excludedPlants || [];
    const exRows = S.model.saMonthly.concat(S.model.caMonthly).filter((r) => ex.indexOf(r.actualPlant) >= 0);
    sys.push({ id: 'sys-excluded', src: '系統設定', level: '提醒', item: '排除於服務廠管理指標：' + ex.join('、'), finding: '月度原始資料中含 ' + exRows.length + ' 筆屬上述據點（' + Array.from(new Set(exRows.map((r) => r.name))).join('、') + '）。', handling: '不顯示於儀表板、不納入服務廠排名／平均／圖表／總廠數；原始資料保留於資料層供稽核。全公司合計（接車、業績、結帳）仍含全部原始列以與 Excel 管理總覽一致。', months: Array.from(new Set(exRows.map((r) => r.month))).sort(), roles: Array.from(new Set(exRows.map((r) => r.role === 'SA' ? '服專' : '出納'))), people: Array.from(new Set(exRows.map((r) => r.name))), done: true, updated: stamp });
    const noScore = allPeople.filter((p) => p.status === '現行' && !nn(p.power));
    if (noScore.length) sys.push({ id: 'sys-noscore', src: '系統自動檢核', level: '提醒', item: '現行人員資料不足未計綜合戰力（' + noScore.length + '人）', finding: '資料完整度低於 ' + Math.round(S.cfg.thresholds.scoreMinCompleteness * 100) + '% 或無有效月份。', handling: '顯示「資料不足」，不以0分計算、不列入排名與九宮格。', months: allMonths(), roles: Array.from(new Set(noScore.map((p) => p.role === 'SA' ? '服專' : '出納'))), people: noScore.map((p) => p.name), done: true, updated: stamp });
    const last = allMonths().slice(-1)[0];
    if (last) {
      const miss = {};
      ['SA', 'CA'].forEach((role) => {
        const F = CFGM.COMPLETENESS_FIELDS[role];
        const rows = (role === 'SA' ? S.model.saMonthly : S.model.caMonthly).filter((r) => r.month === last && r.status === '現行');
        F.forEach((f) => { if (rows.length && rows.every((r) => !nn(r[f]))) (miss[role] = miss[role] || []).push(f); });
      });
      const lbl = (role, f) => { const m = CFGM.FIELD_MAP[role === 'SA' ? '服專月度明細' : '出納月度明細'].cols; return Object.keys(m).find((h) => m[h] === f); };
      Object.keys(miss).forEach((role) => sys.push({ id: 'sys-miss-' + role, src: '系統自動檢核', level: '提醒', item: last + ' ' + (role === 'SA' ? '服專' : '出納') + '本期資料缺漏（' + miss[role].length + '項）', finding: '整月無資料欄位：' + miss[role].map((f) => lbl(role, f)).join('、'), handling: '留白不以0分計算；平均僅計有效月份。', months: [last], roles: [role === 'SA' ? '服專' : '出納'], people: [], done: true, updated: stamp }));
    }
    return items.concat(sys);
  }
  function setChecked(id, v) { const h = lsGet(LS.checks) || {}; h[id] = v; lsSet(LS.checks, h); }

  const accounts = () => lsGet(LS.accounts) || [
    { name: '服務部主管', role: '服務部主管', plant: '', self: '' },
    { name: 'HRBP', role: 'HRBP', plant: '', self: '' },
    { name: '新店廠 廠長', role: '廠長', plant: '新店廠', self: '' },
    { name: '系統管理員', role: '系統管理員', plant: '', self: '' }
  ];
  const saveAccounts = (a) => lsSet(LS.accounts, a);

  root.Store = {
    S, init, derive, peopleFor, allMonths, rangeMonths, periodOptions, setPeriod, monthLabel, periodKey, monthlySeries, plantStats, options,
    personPass, findPerson, canSee, perm, saveUser, saveConfig, resetConfig, defaultConfig, applyImport, resetModel, snapshots, snapshot,
    qualityItems, setChecked, accounts, saveAccounts, DEFAULT_FILTERS, clone
  };
})(window);
