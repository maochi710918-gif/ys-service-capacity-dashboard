/* =========================================================================
 * 帳號登入（與「售服績效戰情中心」共用 Supabase 帳號）
 *  - 帳號／密碼／啟用狀態皆由 Supabase 伺服器端驗證，非前端密碼比對
 *  - 首次登入（must_change_password）須先改密碼
 *  - 閒置 30 分鐘自動登出；登入成功／失敗／登出寫入稽核紀錄（log-event Edge Function）
 *  - 帳號新增、停用、重設密碼統一在戰情中心「帳號與權限管理」處理
 *  - role === 'admin' → 系統管理員（可進資料品質、資料匯入、指標與權重設定、權限管理）
 * ========================================================================= */
(function (root) {
  const A = (root.APP_CONFIG && root.APP_CONFIG.DEFAULT_CONFIG.auth) || {};
  const sb = (root.supabase && A.supabaseUrl && A.publishableKey) ? root.supabase.createClient(A.supabaseUrl, A.publishableKey) : null;
  let USER = null, idleTimer = null, started = false, onReady = null;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const email = (acc) => String(acc).trim().toLowerCase() + (A.emailDomain || '@yuxin.internal');

  function logEvent(type, extra) {
    if (!sb) return Promise.resolve();
    return sb.auth.getSession().then((r) => {
      const s = r.data && r.data.session, h = { 'Content-Type': 'application/json' };
      if (s) h.Authorization = 'Bearer ' + s.access_token;
      return fetch(A.supabaseUrl + '/functions/v1/log-event', { method: 'POST', headers: h, body: JSON.stringify(Object.assign({ type, user_agent: navigator.userAgent, app: A.appName }, extra || {})) }).catch(() => { });
    }).catch(() => { });
  }
  function loadProfile() {
    return sb.auth.getSession().then((r) => {
      const s = r.data && r.data.session;
      if (!s) { USER = null; return null; }
      return sb.from('app_users').select('*').eq('id', s.user.id).maybeSingle().then((res) => { USER = res.data || null; return USER; });
    });
  }
  function resetIdle() { if (idleTimer) clearTimeout(idleTimer); idleTimer = setTimeout(() => logout('idle'), (A.idleMinutes || 30) * 60000); }
  ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach((e) => document.addEventListener(e, () => { if (USER) resetIdle(); }, { passive: true }));

  function logout(reason) {
    const p = USER ? logEvent('logout') : Promise.resolve();
    return p.then(() => (sb ? sb.auth.signOut() : null)).then(() => {
      USER = null; if (idleTimer) clearTimeout(idleTimer);
      try { sessionStorage.clear(); } catch (e) { }
      gate(reason === 'idle' ? '閒置過久，已自動登出，請重新登入。' : null);
    });
  }

  const box = (inner) => '<div class="auth-box"><div class="auth-brand"><div class="brand-mark">ES</div><div><b>裕信汽車服務部</b><span>服專／出納 服務量能與人才盤點</span></div></div>' + inner + '<p class="note auth-foot">與「售服績效戰情中心」共用帳號；忘記密碼或新增帳號請洽管理員。</p></div>';
  function showGate(html) {
    const g = $('authGate'); $('app').style.display = 'none'; g.style.display = 'flex'; g.innerHTML = html;
  }
  function gate(message) {
    if (!sb) { showGate(box('<div class="auth-err">尚未設定登入連線（Supabase），請聯絡管理員。</div>')); return; }
    showGate(box((message ? '<div class="auth-err">' + esc(message) + '</div>' : '') +
      '<form id="authForm"><input id="authAcc" type="text" placeholder="帳號" autocomplete="username" autocapitalize="off" spellcheck="false"><input id="authPw" type="password" placeholder="密碼" autocomplete="current-password"><div class="auth-err" id="authErr"></div><button class="btn primary" id="authBtn" type="submit">登入</button></form>'));
    const acc = $('authAcc'), pw = $('authPw'), err = $('authErr'), btn = $('authBtn');
    acc.focus();
    $('authForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const a = acc.value.trim(), p = pw.value;
      if (!a || !p) { err.textContent = '請輸入帳號與密碼'; return; }
      btn.disabled = true; btn.textContent = '登入中...';
      sb.auth.signInWithPassword({ email: email(a), password: p }).then((res) => {
        if (res.error) {
          logEvent('login_fail', { account: a });
          const code = res.error.code || '', st = res.error.status;
          err.innerHTML = /rate|too_many/i.test(code + res.error.message) || st === 429 ? '登入嘗試次數過多，請稍候幾分鐘再試。'
            : !st ? '無法連線登入服務，請確認網路後再試。'
            : '帳號或密碼錯誤。<br><span class="note">請<b>手動重新輸入</b>目前密碼（瀏覽器自動帶入的可能是改密碼前的舊密碼）。若在戰情中心已改過密碼，請用新密碼。</span>';
          pw.value = ''; pw.focus(); btn.disabled = false; btn.textContent = '登入'; return;
        }
        loadProfile().then((u) => {
          if (!u || u.status !== 'active') { err.textContent = u ? '此帳號已被停用，請聯絡管理員' : '找不到帳號資料，請聯絡管理員'; sb.auth.signOut(); btn.disabled = false; btn.textContent = '登入'; return; }
          logEvent('login_success'); resetIdle(); enter();
        });
      });
    });
  }
  function changePassword(forced) {
    showGate(box((forced ? '<div class="auth-warn">⚠️ 您的帳號使用初始／臨時密碼，請先設定新密碼才能使用。</div>' : '') +
      '<div class="note" style="margin-bottom:8px">帳號：<b>' + esc(USER.account) + '</b>（' + esc(USER.name || '') + '）</div>' +
      '<form id="pwForm"><input id="pwCur" type="password" placeholder="目前密碼" autocomplete="current-password"><input id="pwNew" type="password" placeholder="新密碼（至少6碼）" autocomplete="new-password"><input id="pwNew2" type="password" placeholder="再輸入一次新密碼" autocomplete="new-password"><div class="auth-err" id="pwMsg"></div>' +
      '<button class="btn primary" type="submit" id="pwBtn">更新密碼</button>' + (forced ? '' : ' <button class="btn" type="button" id="pwCancel">取消</button>') + '</form><p class="note"><a href="#" id="pwOut">登出</a></p>'));
    const m = $('pwMsg');
    if ($('pwCancel')) $('pwCancel').addEventListener('click', () => enter());
    $('pwOut').addEventListener('click', (e) => { e.preventDefault(); logout(); });
    $('pwForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const c = $('pwCur').value, n = $('pwNew').value, n2 = $('pwNew2').value;
      if (!c || !n) { m.textContent = '請完整輸入'; return; }
      if (n.length < 6) { m.textContent = '新密碼至少需要6碼'; return; }
      if (n !== n2) { m.textContent = '兩次輸入的新密碼不一致'; return; }
      $('pwBtn').disabled = true;
      sb.auth.signInWithPassword({ email: email(USER.account), password: c }).then((r) => {
        if (r.error) { m.textContent = '目前密碼不正確'; $('pwBtn').disabled = false; return; }
        sb.auth.updateUser({ password: n }).then((r2) => {
          if (r2.error) { m.textContent = '更新失敗：' + r2.error.message; $('pwBtn').disabled = false; return; }
          sb.rpc('log_password_changed').then(() => { USER.must_change_password = false; if (root.UI) root.UI.toast('密碼已更新'); enter(); });
        });
      });
    });
  }
  function enter() {
    if (USER && USER.must_change_password) { changePassword(true); return; }
    $('authGate').style.display = 'none'; $('app').style.display = '';
    if (!started) { started = true; onReady && onReady(); } else if (root.App) root.App.rerender();
  }

  function start(cb) {
    onReady = cb;
    if (!sb) { gate(); return; }
    loadProfile().then((u) => {
      if (u && u.status === 'active') { resetIdle(); enter(); }
      else { const was = !!u; USER = null; (was ? sb.auth.signOut() : Promise.resolve()).then(() => gate(was ? '此帳號已被停用，請聯絡管理員。' : null)); }
    }).catch(() => gate('登入服務暫時無法連線，請稍後再試。'));
  }

  root.Auth = { client: () => sb, start, logout, user: () => USER, isAdmin: () => !!(USER && USER.role === 'admin' && USER.status === 'active'), changePassword: () => changePassword(false) };
})(window);
