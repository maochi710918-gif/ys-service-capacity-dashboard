/* =========================================================================
 * UI 共用元件：格式化、表格（排序／匯出）、圖表、KPI 卡、對話框
 * ========================================================================= */
(function (root) {
  const nn = (v) => v !== null && v !== undefined && !(typeof v === 'number' && isNaN(v));
  const NA = '<span class="na">—</span>';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- 數字格式（空值一律「—」，不顯示 0） ---------- */
  const F = {
    int: (v) => nn(v) ? Math.round(v).toLocaleString('zh-TW') : '—',
    money: (v) => nn(v) ? Math.round(v).toLocaleString('zh-TW') : '—',
    wan: (v) => nn(v) ? (v / 10000).toLocaleString('zh-TW', { maximumFractionDigits: 0 }) + ' 萬' : '—',
    yi: (v) => nn(v) ? (v / 1e8).toFixed(2) + ' 億' : '—',
    pct: (v) => nn(v) ? (v * 100).toFixed(1) + '%' : '—',
    pctSigned: (v) => nn(v) ? (v > 0 ? '+' : '') + (v * 100).toFixed(1) + '%' : '—',
    pr: (v) => nn(v) ? (v * 100).toFixed(1) : '—',
    score: (v) => nn(v) ? v.toFixed(1) : '—',
    signed1: (v) => nn(v) ? (v > 0 ? '+' : '') + v.toFixed(1) : '—',
    csi: (v) => nn(v) ? v.toFixed(1) : '—',
    d1: (v) => nn(v) ? v.toFixed(1) : '—',
    d2: (v) => nn(v) ? v.toFixed(2) : '—',
    d3: (v) => nn(v) ? v.toFixed(3) : '—',
    years: (v) => nn(v) ? v.toFixed(1) + ' 年' : '—',
    months: (v) => nn(v) ? v + ' 個月' : '—',
    text: (v) => nn(v) && v !== '' ? String(v) : '—'
  };
  // 匯出用：數字保留原值、空值留白
  const rawOf = (col, row) => { const v = col.get ? col.get(row) : row[col.key]; return nn(v) ? v : ''; };

  /* ---------- 燈號 ---------- */
  function lightByDelta(delta, goodDir, yellowPct) {
    if (!nn(delta)) return 'blue';
    const d = goodDir < 0 ? -delta : delta;
    if (d >= 0) return 'green';
    if (d >= (yellowPct == null ? -0.05 : yellowPct)) return 'yellow';
    return 'red';
  }
  function lightPR(v) { if (!nn(v)) return 'gray'; return v >= 0.6 ? 'green' : v >= 0.4 ? 'yellow' : 'red'; }
  function lightScore(v, cfg) { if (!nn(v)) return 'gray'; return v >= cfg.thresholds.highPower ? 'green' : v >= cfg.thresholds.midPower ? 'yellow' : 'red'; }
  const pill = (text, color) => '<span class="pill ' + (color || '') + '">' + esc(text) + '</span>';
  const dot = (color) => '<span class="dot ' + color + '"></span>';

  /* ---------- KPI 卡 ---------- */
  // o: {label, value, fmt, unit, cur, prev, curLabel, prevLabel, company, companyLabel, goodDir, light, hint}
  function kpi(o) {
    const f = o.fmt || F.int;
    const has = nn(o.cur) && nn(o.prev);
    const delta = has ? o.cur - o.prev : null;
    const rate = has && o.prev !== 0 ? delta / Math.abs(o.prev) : null;
    let light = o.light || (nn(o.value) ? lightByDelta(rate != null ? rate : delta, o.goodDir || 1, o.yellowPct) : 'gray');
    const dcls = !nn(delta) ? 'flat' : ((o.goodDir || 1) * delta > 0 ? 'up' : (o.goodDir || 1) * delta < 0 ? 'down' : 'flat');
    const sf = o.subFmt || f;
    const df = o.deltaFmt || sf;
    const row = (k, v, cls) => '<span>' + k + '</span><span class="num ' + (cls || '') + '">' + v + '</span>';
    return '<div class="kpi s-' + light + '" title="' + esc(o.hint || '') + '">' +
      '<div class="k-l"><span>' + esc(o.label) + '</span>' + dot(light) + '</div>' +
      '<div class="k-v">' + (nn(o.value) ? f(o.value) : '—') + (o.unit && nn(o.value) ? '<small>' + o.unit + '</small>' : '') + '</div>' +
      '<div class="k-cmp">' +
      row(o.curLabel || '本期', nn(o.cur) ? (o.curFmt || sf)(o.cur) : '—') +
      row(o.prevLabel || '上期', nn(o.prev) ? sf(o.prev) : '—') +
      row('增減', nn(delta) ? (delta > 0 ? '+' : '') + df(delta) + (nn(rate) ? '（' + F.pctSigned(rate) + '）' : '') : '—', dcls) +
      row(o.companyLabel || '全公司', nn(o.company) ? sf(o.company) : '—') +
      '</div></div>';
  }

  /* ---------- 表格 ---------- */
  // opts: {columns:[{key,label,fmt,num,get,html,sticky,wrap,sortVal}], rows, sortKey, sortDir, onRow, rowClass, avgRow, exportName, maxH}
  function table(el, opts) {
    const st = { sortKey: opts.sortKey || null, sortDir: opts.sortDir || -1 };
    function val(c, r) { return c.sortVal ? c.sortVal(r) : (c.get ? c.get(r) : r[c.key]); }
    function render() {
      let rows = opts.rows.slice();
      if (st.sortKey) {
        const c = opts.columns.find((x) => x.key === st.sortKey);
        if (c) rows.sort((a, b) => {
          const va = val(c, a), vb = val(c, b);
          if (!nn(va) && !nn(vb)) return 0; if (!nn(va)) return 1; if (!nn(vb)) return -1;
          return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'zh-Hant')) * st.sortDir;
        });
      }
      const th = opts.columns.map((c) => '<th data-k="' + c.key + '" class="' + (c.num ? 'num ' : '') + (c.sticky ? 'sticky ' : '') + (st.sortKey === c.key ? 'sorted' : '') + '">' + esc(c.label) + '<span class="arr">' + (st.sortKey === c.key ? (st.sortDir > 0 ? '▲' : '▼') : '⇅') + '</span></th>').join('');
      const cell = (c, r) => {
        const v = c.get ? c.get(r) : r[c.key];
        let h = c.html ? c.html(r, v) : (c.fmt ? c.fmt(v) : F.text(v));
        if (h === '—') h = NA;
        return '<td class="' + (c.num ? 'num ' : '') + (c.sticky ? 'sticky ' : '') + (c.wrap ? 'wrap ' : '') + (c.cls ? c.cls(r, v) : '') + '">' + h + '</td>';
      };
      const body = rows.map((r, i) => '<tr data-i="' + i + '" class="' + (opts.onRow ? 'click ' : '') + (opts.rowClass ? opts.rowClass(r) : '') + '">' + opts.columns.map((c) => cell(c, r)).join('') + '</tr>').join('');
      const avg = opts.avgRow ? '<tr class="avg">' + opts.columns.map((c) => cell(c, opts.avgRow)).join('') + '</tr>' : '';
      el.innerHTML = '<div class="tbl-wrap ' + (opts.short ? 'short' : '') + '"><table class="tbl"><thead><tr>' + th + '</tr></thead><tbody>' + (body || '<tr><td colspan="' + opts.columns.length + '" class="empty">無符合條件的資料</td></tr>') + avg + '</tbody></table></div>' +
        (opts.footer === false ? '' : '<div class="tbl-foot"><span>共 ' + rows.length + ' 筆</span><span>點欄位標題可排序' + (opts.onRow ? '；點列可下鑽' : '') + '</span></div>');
      el.querySelectorAll('th').forEach((h) => h.addEventListener('click', () => {
        const k = h.dataset.k;
        if (st.sortKey === k) st.sortDir = -st.sortDir; else { st.sortKey = k; st.sortDir = -1; }
        render();
      }));
      if (opts.onRow) el.querySelectorAll('tbody tr[data-i]').forEach((tr) => tr.addEventListener('click', (e) => {
        if (e.target.closest('.name-link')) return;
        opts.onRow(rows[Number(tr.dataset.i)]);
      }));
      el.querySelectorAll('.name-link').forEach((a) => a.addEventListener('click', (e) => { e.stopPropagation(); root.App.openPerson(a.dataset.id); }));
      st.rows = rows;
    }
    render();
    return { exportRows: () => st.rows || opts.rows, columns: opts.columns, rerender: render };
  }

  /* ---------- 匯出 ---------- */
  function exportData(name, columns, rows, type) {
    const cols = columns.filter((c) => c.export !== false);
    const head = cols.map((c) => c.label);
    const data = rows.map((r) => cols.map((c) => { const v = rawOf(c, r); return typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : String(v).replace(/<[^>]+>/g, ''); }));
    const fname = name + '_' + new Date().toISOString().slice(0, 10);
    if (type === 'csv') {
      const csv = [head].concat(data).map((r) => r.map((v) => { const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname + '.csv'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } else {
      const ws = XLSX.utils.aoa_to_sheet([head].concat(data));
      ws['!cols'] = head.map((h) => ({ wch: Math.max(8, String(h).length * 2 + 2) }));
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 30));
      XLSX.writeFile(wb, fname + '.xlsx');
    }
    toast('已匯出 ' + rows.length + ' 筆');
  }
  const exportBtns = (id) => '<button class="btn sm" data-exp="xlsx" data-t="' + id + '">⤓ Excel</button><button class="btn sm" data-exp="csv" data-t="' + id + '">⤓ CSV</button>';
  function bindExport(scope, id, name, getT) {
    scope.querySelectorAll('[data-t="' + id + '"][data-exp]').forEach((b) => b.addEventListener('click', () => {
      const t = getT(); exportData(name, t.columns, t.exportRows(), b.dataset.exp);
    }));
  }

  /* ---------- 圖表 ---------- */
  const charts = [];
  const C = {
    navy: '#16294a', navy2: '#2b4c80', blue: '#3b82f6', sky: '#93c5fd', red: '#c3002f', gray: '#9ca3af', green: '#15803d', amber: '#d97706', teal: '#0f766e', slate: '#64748b',
    series: ['#16294a', '#c3002f', '#3b82f6', '#9ca3af', '#0f766e', '#d97706', '#7c3aed', '#64748b']
  };
  const baseOpt = {
    textStyle: { fontFamily: 'Noto Sans TC, Microsoft JhengHei, sans-serif' },
    grid: { left: 52, right: 52, top: 38, bottom: 34, containLabel: false },
    tooltip: { trigger: 'axis', confine: true, valueFormatter: undefined },
    legend: { top: 4, textStyle: { fontSize: 11 }, itemWidth: 14, itemHeight: 8 }
  };
  function chart(el, option) {
    if (!el) return null;
    const ex = echarts.getInstanceByDom(el); if (ex) ex.dispose();
    const c = echarts.init(el, null, { renderer: 'canvas' });
    const opt = Object.assign({}, baseOpt, option);
    if (option.grid) opt.grid = Object.assign({}, baseOpt.grid, option.grid);
    if (option.tooltip) opt.tooltip = Object.assign({}, baseOpt.tooltip, option.tooltip);
    if (option.legend) opt.legend = Object.assign({}, baseOpt.legend, option.legend);
    c.setOption(opt);
    charts.push(c);
    return c;
  }
  function disposeCharts() { while (charts.length) { const c = charts.pop(); try { c.dispose(); } catch (e) { } } }
  let rt; root.addEventListener && root.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => charts.forEach((c) => { try { c.resize(); } catch (e) { } }), 120); });

  /* ---------- modal / toast ---------- */
  function modal(title, html, after) {
    const m = document.getElementById('modal');
    document.getElementById('modalTitle').textContent = title;
    const b = document.getElementById('modalBody'); b.innerHTML = html;
    m.hidden = false;
    if (after) after(b);
  }
  function closeModal() { document.getElementById('modal').hidden = true; }
  let tt;
  function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, 2200); }

  const card = (title, body, o) => {
    o = o || {};
    return '<div class="card ' + (o.cls || '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + '><div class="card-h"><h3>' + title + '</h3>' + (o.sub ? '<span class="sub">' + o.sub + '</span>' : '') + (o.tools ? '<div class="tools">' + o.tools + '</div>' : '') + '</div><div class="card-b ' + (o.flush ? 'flush' : '') + '">' + body + '</div></div>';
  };
  const seg = (name, items, cur) => '<div class="seg" data-seg="' + name + '">' + items.map((i) => '<button data-v="' + esc(i[0]) + '" class="' + (String(i[0]) === String(cur) ? 'on' : '') + '">' + esc(i[1]) + '</button>').join('') + '</div>';
  function bindSeg(scope, name, fn) {
    scope.querySelectorAll('[data-seg="' + name + '"] button').forEach((b) => b.addEventListener('click', () => fn(b.dataset.v)));
  }
  const nameLink = (p) => '<span class="name-link" data-id="' + esc(p.id) + '">' + esc(p.name) + '</span>';

  root.UI = { F, NA, esc, nn, kpi, table, exportData, exportBtns, bindExport, chart, disposeCharts, C, modal, closeModal, toast, card, seg, bindSeg, pill, dot, lightByDelta, lightPR, lightScore, nameLink };
})(window);
