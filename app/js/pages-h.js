/* =========================================================================
 * 頁面 H：帳號與登入紀錄（與「售服績效戰情中心」共用 Supabase audit_log）
 *  資料庫 RLS 已限制：一般帳號只看得到自己的紀錄；管理員看全部。
 *  匯出 Excel 時呼叫 log_export 寫入「匯出紀錄」。
 * ========================================================================= */
(function (root) {
  const { UI } = root;
  const { esc, table, card } = UI;
  const Pages = root.Pages;
  const LABEL = { login_success: '登入成功', login_fail: '登入失敗', logout: '登出', update_account: '修改帳號', update_password: '修改密碼', admin_reset_password: '管理員重設密碼', status_change: '帳號狀態變更', permission_change: '權限調整', export_log: '匯出紀錄' };
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (s) => { if (!s) return '—'; const d = new Date(s); return isNaN(d) ? s : d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const detailTxt = (d) => { if (!d) return '—'; if (typeof d === 'string') return d; const o = Object.assign({}, d); delete o.app; return Object.keys(o).length ? JSON.stringify(o) : '—'; };
  let st = { account: '', type: '', result: '', from: '', to: '', rows: null, loading: false, err: '' };

  function query() {
    const sb = root.Auth && root.Auth.client && root.Auth.client();
    if (!sb) return Promise.reject(new Error('尚未登入'));
    let q = sb.from('audit_log').select('*').order('created_at', { ascending: false }).limit(1000);
    if (st.account) q = q.or('actor_account.eq.' + st.account + ',target_account.eq.' + st.account);
    if (st.type) q = q.eq('action_type', st.type);
    if (st.result) q = q.eq('result', st.result);
    if (st.from) q = q.gte('created_at', st.from + 'T00:00:00');
    if (st.to) q = q.lte('created_at', st.to + 'T23:59:59');
    return q.then((res) => { if (res.error) throw res.error; return res.data || []; });
  }
  function load() {
    st.loading = true; st.err = '';
    query().then((r) => { st.rows = r; }).catch((e) => { st.err = e.message || String(e); st.rows = []; }).then(() => { st.loading = false; root.App.render(); });
  }

  Pages.audit = function (el) {
    const u = root.Auth && root.Auth.user();
    if (!u) { el.innerHTML = '<div class="empty">請先登入。</div>'; return; }
    const admin = root.Auth.isAdmin();
    if (st.rows == null && !st.loading) { load(); }
    const rows = st.rows || [];
    const sel = (id, opts, v) => '<select id="' + id + '">' + opts.map((o) => '<option value="' + esc(o[0]) + '"' + (o[0] === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
    el.innerHTML = '<div class="page-head"><div><h1>帳號與登入紀錄</h1><p>與「售服績效戰情中心」共用帳號與稽核紀錄；' + (admin ? '管理員可查看全部帳號紀錄。' : '僅顯示您自己的紀錄。') + '</p></div></div>' +
      '<div class="grid g2b">' + card('我的帳號', '<div class="kv" style="grid-template-columns:90px 1fr"><span>帳號</span><b>' + esc(u.account) + '</b><span>姓名</span><span>' + esc(u.name || '—') + '</span><span>身分</span><span>' + esc(u.job_title || (admin ? '管理員' : '一般使用者')) + (admin ? ' ' + UI.pill('管理員', 'red') : '') + '</span><span>狀態</span><span>' + (u.status === 'active' ? UI.pill('啟用', 'green') : UI.pill(u.status, 'gray')) + '</span></div>' +
        '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn primary" id="auPw">修改密碼</button><a class="btn" href="https://maochi710918-gif.github.io/yuxin-service-dashboard/" target="_blank" rel="noopener">前往戰情中心（帳號與權限管理）</a></div>' +
        '<p class="note">新增、停用、重設密碼與權限調整請在戰情中心「帳號與權限管理」操作，兩個網站同步生效。</p>') +
      card('查詢條件', '<div class="form-grid">' +
        (admin ? '<div class="f"><label>帳號</label><input id="auAcc" value="' + esc(st.account) + '" placeholder="全部帳號"></div>' : '') +
        '<div class="f"><label>活動類型</label>' + sel('auType', [['', '全部']].concat(Object.keys(LABEL).map((k) => [k, LABEL[k]])), st.type) + '</div>' +
        '<div class="f"><label>結果</label>' + sel('auRes', [['', '全部'], ['success', '成功'], ['fail', '失敗']], st.result) + '</div>' +
        '<div class="f"><label>起日</label><input type="date" id="auFrom" value="' + esc(st.from) + '"></div><div class="f"><label>迄日</label><input type="date" id="auTo" value="' + esc(st.to) + '"></div>' +
        '</div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn primary" id="auGo">查詢</button><button class="btn" id="auClr">清除</button></div>') + '</div>' +
      '<div style="height:12px"></div>' + card('稽核紀錄' + (st.loading ? '（載入中…）' : '（' + rows.length + ' 筆' + (rows.length >= 1000 ? '，顯示最新 1,000 筆' : '') + '）'),
        (st.err ? '<div class="banner bad"><b>讀取失敗</b><span>' + esc(st.err) + '</span></div>' : '') + '<div id="auT"></div>',
        { flush: true, tools: '<button class="btn sm" id="auXls">⤓ 匯出 Excel</button><button class="btn sm" id="auRe">重新整理</button>' });
    el.querySelector('#auPw').addEventListener('click', () => root.Auth.changePassword());
    const read = () => { st.account = admin && el.querySelector('#auAcc') ? el.querySelector('#auAcc').value.trim() : ''; st.type = el.querySelector('#auType').value; st.result = el.querySelector('#auRes').value; st.from = el.querySelector('#auFrom').value; st.to = el.querySelector('#auTo').value; };
    el.querySelector('#auGo').addEventListener('click', () => { read(); load(); });
    el.querySelector('#auClr').addEventListener('click', () => { st = { account: '', type: '', result: '', from: '', to: '', rows: null, loading: false, err: '' }; load(); });
    el.querySelector('#auRe').addEventListener('click', () => load());
    const cols = [{ key: 'created_at', label: '時間', get: (r) => r.created_at, html: (r) => fmt(r.created_at) },
      { key: 'acc', label: '帳號', get: (r) => r.target_account || r.actor_account || '—' },
      { key: 'type', label: '活動類型', get: (r) => LABEL[r.action_type] || r.action_type },
      { key: 'result', label: '結果', get: (r) => (r.result === 'success' ? '成功' : '失敗'), html: (r) => r.result === 'success' ? '<b class="up">成功</b>' : '<b class="down">失敗</b>' },
      { key: 'actor', label: '操作者', get: (r) => r.actor_account || '—' },
      { key: 'app', label: '來源系統', get: (r) => (r.detail && r.detail.app) || r.app || '—' },
      { key: 'ip', label: '來源IP', get: (r) => r.ip_address || '無法取得' },
      { key: 'ua', label: '裝置／瀏覽器', get: (r) => r.user_agent || '無法取得', html: (r) => '<span title="' + esc(r.user_agent || '') + '" style="display:inline-block;max-width:220px;overflow:hidden;text-overflow:ellipsis;vertical-align:bottom">' + esc(r.user_agent || '無法取得') + '</span>' },
      { key: 'detail', label: '內容', wrap: true, get: (r) => detailTxt(r.detail) }];
    const t = table(el.querySelector('#auT'), { columns: cols, rows, sortKey: 'created_at' });
    el.querySelector('#auXls').addEventListener('click', () => {
      const summary = [st.account && '帳號=' + st.account, st.type && '類型=' + (LABEL[st.type] || st.type), st.result && '結果=' + (st.result === 'success' ? '成功' : '失敗'), st.from && '起=' + st.from, st.to && '迄=' + st.to].filter(Boolean).join('；') || '全部';
      const aoa = [['匯出時間', fmt(new Date().toISOString())], ['查詢條件', summary], [], cols.map((c) => c.label)].concat(t.exportRows().map((r) => cols.map((c) => c.key === 'created_at' ? fmt(r.created_at) : String(c.get(r) == null ? '' : c.get(r)))));
      const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 30 }, { wch: 40 }];
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, '稽核紀錄'); XLSX.writeFile(wb, '服專出納儀表板_稽核紀錄_' + Date.now() + '.xlsx');
      const sb = root.Auth.client(); if (sb) sb.rpc('log_export', { filter_summary: { text: summary, app: '服專出納服務量能儀表板' } }).then(() => { });
      UI.toast('已匯出 ' + t.exportRows().length + ' 筆');
    });
  };
})(window);
