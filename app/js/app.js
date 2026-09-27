/* =========================================================================
 * App 殼層：選單、角色切換、全域篩選、路由
 * ========================================================================= */
(function (root) {
  const { Store, UI } = root; const S = Store.S; const esc = UI.esc;
  const NAV = [
    ['board', '戰力總表', '總覽'], ['overview', '管理總覽', '總覽'], ['plants', '服務廠比較', '總覽'], ['sa', '服專分析', '量能分析'], ['ca', '出納分析', '量能分析'],
    ['person', '個人分析', '量能分析'], ['monthly', '月度推移', '量能分析'], ['carage', '車齡結構', '量能分析'], ['power', '綜合戰力', '人才盤點'],
    ['grid', '人才九宮格', '人才盤點'], ['ladder', '升階與人才梯隊', '人才盤點'], ['rank', '排行與異常', '人才盤點'], ['quality', '資料品質', '資料與系統'],
    ['import', '資料匯入', '資料與系統'], ['settings', '指標與權重設定', '資料與系統'], ['perms', '權限管理', '資料與系統']
  ];
  const ADMIN_PAGES = ['import', 'settings', 'perms'];
  const Pages = root.Pages = root.Pages || {};
  const $ = (id) => document.getElementById(id);

  function canSee(page) {
    // 資料匯入、指標與權重設定：僅系統管理員；權限管理頁所有人可進入（切換示範身分），僅管理員可編輯
    if (page === 'import' || page === 'settings') return S.user.role === '系統管理員';
    if (page === 'perms') return true;
    return Store.canSee(page);
  }

  function renderNav() {
    let g = '', h = '';
    NAV.forEach(([k, label, grp], i) => {
      if (grp !== g) { h += '<div class="grp">' + grp + '</div>'; g = grp; }
      h += '<a href="#/' + k + '" data-k="' + k + '" class="' + (S.page === k ? 'on ' : '') + (canSee(k) ? '' : 'disabled') + '"><span class="no">' + (i + 1) + '</span>' + label + '</a>';
    });
    $('nav').innerHTML = h;
    $('nav').querySelectorAll('a').forEach((a) => a.addEventListener('click', () => document.getElementById('app').classList.remove('nav-open')));
    const m = S.model.meta || {};
    $('sideFoot').innerHTML = '資料：' + esc(m.fileName || '—') + '<br>' + (S.source === 'import' ? '來源：使用者匯入' : '來源：預設Excel') + '　期間 ' + Store.monthLabel(Store.allMonths());
    $('dataStamp').textContent = '資料期間 ' + Store.monthLabel(Store.allMonths()) + '｜人員依115.9最新廠別';
  }

  /* ---------- 篩選列 ---------- */
  function renderFilters() {
    const f = S.filters, P = Store.peopleFor(Store.allMonths()), O = Store.options(P), ms = Store.allMonths();
    const sc = Store.perm().scope;
    const sel = (key, label, opts, all, locked) => '<div class="f ' + (locked ? 'locked' : '') + '"><label>' + label + '</label><select data-f="' + key + '" ' + (locked ? 'disabled' : '') + '>' + (all === false ? '' : '<option value="">' + (all || '全部') + '</option>') + opts.map((o) => { const v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(v) + '"' + (String(f[key]) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select></div>';
    const names = P.SA.concat(P.CA).filter((p) => Store.personPass(p, { ignorePlant: true }) || true).map((p) => p.name);
    let h = '';
    h += sel('period', '年／季／月', Store.periodOptions(), false);
    h += '<div class="f"><label>日期區間</label><div class="pair"><select data-f="mStart">' + ms.map((m) => '<option' + (m === f.mStart ? ' selected' : '') + '>' + m + '</option>').join('') + '</select><span>~</span><select data-f="mEnd">' + ms.map((m) => '<option' + (m === f.mEnd ? ' selected' : '') + '>' + m + '</option>').join('') + '</select></div></div>';
    h += sel('gran', '圖表粒度', [['month', '月'], ['quarter', '季'], ['year', '年']], false);
    h += sel('plant', '服務廠', O.plants, '全部服務廠', sc === 'plant' || sc === 'self');
    h += '<div class="f"><label>人員角色</label><select data-role-sel>' + [['all', '全部（綜合）'], ['SA', '服專'], ['CA', '出納']].map((o) => '<option value="' + o[0] + '"' + (S.role === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>';
    h += '<div class="f ' + (sc === 'self' ? 'locked' : '') + '"><label>姓名</label><input data-f="name" list="nameList" value="' + esc(f.name) + '" placeholder="輸入姓名" ' + (sc === 'self' ? 'disabled' : '') + '><datalist id="nameList">' + Array.from(new Set(names)).map((n) => '<option value="' + esc(n) + '">').join('') + '</datalist></div>';
    h += sel('license', '證照級別', O.licenses);
    h += '<div class="f"><label>年資區間（年）</label><div class="pair"><input class="sm" type="number" step="0.5" min="0" data-f="yMin" value="' + esc(f.yMin) + '" placeholder="最低"><span>~</span><input class="sm" type="number" step="0.5" min="0" data-f="yMax" value="' + esc(f.yMax) + '" placeholder="最高"></div></div>';
    h += sel('tenure', '年資群', O.tenures);
    h += sel('maturity', '人才成熟度', O.maturities);
    h += sel('talent', '人才類型', O.talents);
    h += sel('status', '人員狀態', O.statuses);
    h += sel('position', '現職', O.positions);
    h += sel('band', '戰力區間', O.bands.map((b) => [b, b === '高戰力' ? '高戰力 ≥' + S.cfg.thresholds.highPower : b === '中戰力' ? '中戰力 ' + S.cfg.thresholds.midPower + '–' + (S.cfg.thresholds.highPower - 0.01) : b === '低戰力' ? '低戰力 <' + S.cfg.thresholds.midPower : b]));
    h += sel('promo', '升階準備度', O.promos);
    h += sel('minMonths', '有效資料月份', ms.map((m, i) => [String(i + 1), '≥ ' + (i + 1) + ' 個月']));
    h += '<div class="fbtns"><button class="btn" id="fClear">清除篩選</button><button class="btn primary" id="fCompany">回到全公司</button></div>';
    $('filterbar').innerHTML = h;
    $('filterbar').querySelectorAll('[data-f]').forEach((el) => {
      const ev = el.tagName === 'INPUT' ? 'input' : 'change';
      let t;
      el.addEventListener(ev, () => {
        clearTimeout(t);
        t = setTimeout(() => {
          const k = el.dataset.f; f[k] = el.value;
          if (k === 'period') Store.setPeriod(el.value);
          if (k === 'mStart' || k === 'mEnd') { f.period = 'custom'; if (f.mStart > f.mEnd) { if (k === 'mStart') f.mEnd = f.mStart; else f.mStart = f.mEnd; } }
          render(k === 'period' || k === 'mStart' || k === 'mEnd');
        }, el.tagName === 'INPUT' ? 350 : 0);
      });
    });
    $('filterbar').querySelector('[data-role-sel]').addEventListener('change', (e) => setRole(e.target.value));
    $('fClear').addEventListener('click', clearFilters);
    $('fCompany').addEventListener('click', () => { clearFilters(); setRole('all'); go('board'); });
  }
  function clearFilters() {
    const keep = { period: 'all' };
    Object.assign(S.filters, Store.clone(Store.DEFAULT_FILTERS), keep);
    Store.setPeriod('all');
    applyScopeLocks();
    render(true);
  }
  function applyScopeLocks() {
    const sc = Store.perm().scope;
    if (sc === 'plant') S.filters.plant = S.user.plant || '';
    if (sc === 'self') { const p = Store.findPerson(S.user.self); S.filters.name = p ? p.name : ''; S.filters.plant = ''; if (p) S.role = p.role; }
  }
  const FILTER_LABEL = { plant: '服務廠', name: '姓名', license: '證照', yMin: '年資≥', yMax: '年資≤', tenure: '年資群', maturity: '成熟度', talent: '人才類型', status: '人員狀態', position: '現職', band: '戰力區間', promo: '升階準備度', minMonths: '有效月份≥' };
  function renderChips() {
    const f = S.filters; const chips = [];
    if (f.period !== 'all') chips.push(['__period', '期間：' + Store.monthLabel(Store.rangeMonths())]);
    Object.keys(FILTER_LABEL).forEach((k) => { if (f[k] !== '' && f[k] != null) chips.push([k, FILTER_LABEL[k] + '：' + f[k]]); });
    if (S.role !== 'all') chips.push(['__role', '角色：' + (S.role === 'SA' ? '服專' : '出納')]);
    $('filterChips').innerHTML = chips.map((c) => '<span class="chip">' + esc(c[1]) + '<button data-c="' + c[0] + '" title="移除">✕</button></span>').join('');
    $('filterChips').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.c;
      if (k === '__period') Store.setPeriod('all'); else if (k === '__role') S.role = 'all'; else S.filters[k] = '';
      applyScopeLocks(); render(true);
    }));
  }

  function setRole(r) {
    S.role = r;
    $('roleSwitch').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.role === r));
    render(true);
  }

  /* ---------- 路由 ---------- */
  function parseHash() {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    const [page, ...rest] = h.split('/');
    S.page = NAV.some((n) => n[0] === page) ? page : 'board';
    if (S.page === 'person' && rest.length) S.personId = rest.join('/');
  }
  function go(page, arg) { location.hash = '#/' + page + (arg ? '/' + encodeURIComponent(arg) : ''); }
  function openPerson(id) { UI.closeModal(); go('person', id); }

  let lastFilterSig = '';
  function render(refreshFilters) {
    UI.disposeCharts();
    applyScopeLocks();
    const sig = JSON.stringify([S.filters, S.role, S.user, S.cfg.thresholds]);
    if (refreshFilters || sig !== lastFilterSig) { renderFilters(); lastFilterSig = sig; }
    renderNav(); renderChips();
    $('roleSwitch').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.role === S.role));
    const nav = NAV.find((n) => n[0] === S.page);
    $('pageTitle').textContent = nav ? nav[1] : '';
    document.title = (nav ? nav[1] + '｜' : '') + '服專出納戰情儀表板';
    const el = $('content');
    if (!canSee(S.page)) { el.innerHTML = '<div class="card lock"><h2>🔒 無檢視權限</h2><p>目前身分「' + esc(S.user.role) + '」無法檢視「' + esc(nav ? nav[1] : '') + '」。請切換身分後檢視。</p><button class="btn primary" id="toAdmin">切換為系統管理員</button></div>';
      $('toAdmin').addEventListener('click', () => setUserRole('系統管理員')); return; }
    const page = Pages[S.page];
    if (!page) { el.innerHTML = '<div class="empty">頁面建置中</div>'; return; }
    try {
      const D = Store.derive();
      page(el, D);
    } catch (e) {
      console.error(e);
      el.innerHTML = '<div class="banner bad"><b>頁面錯誤</b><span>' + esc(e.message) + '</span></div>';
    }
    // 圖表初始化於 DOM 插入後：確保尺寸正確
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }

  function renderUserRole() {
    const roles = Object.keys(S.cfg.permissions);
    $('userRole').innerHTML = roles.map((r) => '<option' + (S.user.role === r ? ' selected' : '') + '>' + r + '</option>').join('');
  }
  function setUserRole(role, extra) {
    S.user.role = role; Object.assign(S.user, extra || {});
    if (role !== '廠長') S.user.plant = extra && extra.plant || (role === '廠長' ? S.user.plant : '');
    if (role !== '個人') S.user.self = '';
    if (Store.perm().scope !== 'plant' && Store.perm().scope !== 'self') { S.filters.plant = ''; S.filters.name = ''; }
    Store.saveUser(); renderUserRole(); applyScopeLocks();
    if (!canSee(S.page)) { const first = NAV.find((n) => canSee(n[0])); if (first) { go(first[0]); } }
    render(true);
  }
  function askUserRole(role) {
    const P = Store.peopleFor(Store.allMonths());
    if (role === '廠長') {
      const O = Store.options(P);
      UI.modal('選擇廠長所屬服務廠', '<div class="form-grid"><div class="f"><label>服務廠</label><select id="uPlant">' + O.plants.map((p) => '<option' + (p === S.user.plant ? ' selected' : '') + '>' + esc(p) + '</option>').join('') + '</select></div></div><p class="note">廠長身分僅能檢視自己服務廠的人員與月度資料。</p><button class="btn primary" id="uOk">確認</button>', (b) => {
        b.querySelector('#uOk').addEventListener('click', () => { UI.closeModal(); setUserRole('廠長', { plant: b.querySelector('#uPlant').value }); });
      });
    } else if (role === '個人') {
      const list = P.SA.concat(P.CA).filter((p) => p.status === '現行');
      UI.modal('選擇個人身分', '<div class="form-grid"><div class="f"><label>人員</label><select id="uSelf">' + list.map((p) => '<option value="' + esc(p.id) + '">' + esc(p.plant + '｜' + p.name + '（' + (p.role === 'SA' ? '服專' : '出納') + '）') + '</option>').join('') + '</select></div></div><p class="note">個人身分只能檢視自己的資料。</p><button class="btn primary" id="uOk">確認</button>', (b) => {
        b.querySelector('#uOk').addEventListener('click', () => { const id = b.querySelector('#uSelf').value; UI.closeModal(); setUserRole('個人', { self: id }); go('person', id); });
      });
    } else setUserRole(role);
  }

  function boot() {
    Store.init();
    parseHash();
    renderUserRole();
    $('userRole').addEventListener('change', (e) => { const r = e.target.value; renderUserRole(); e.target.value = S.user.role; askUserRole(r); });
    $('roleSwitch').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setRole(b.dataset.role)));
    $('menuBtn').addEventListener('click', () => $('app').classList.toggle('nav-open'));
    $('scrim').addEventListener('click', () => $('app').classList.remove('nav-open'));
    $('filterToggle').addEventListener('click', () => {
      if (window.innerWidth <= 760) $('app').classList.toggle('filters-open');
      else $('app').classList.toggle('filters-collapsed');
      $('filterToggle').textContent = (window.innerWidth <= 760 ? $('app').classList.contains('filters-open') : !$('app').classList.contains('filters-collapsed')) ? '⚲ 收合篩選' : '⚲ 展開篩選';
    });
    if (window.innerWidth <= 760) $('filterToggle').textContent = '⚲ 展開篩選';
    $('modalClose').addEventListener('click', UI.closeModal);
    $('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') UI.closeModal(); });
    window.addEventListener('hashchange', () => { parseHash(); render(); window.scrollTo(0, 0); });
    render(true);
  }

  root.App = { go, openPerson, render, setRole, setUserRole, askUserRole, NAV, rerender: () => render(true) };
  document.addEventListener('DOMContentLoaded', boot);
})(window);
