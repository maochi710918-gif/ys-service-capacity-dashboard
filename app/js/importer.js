/* =========================================================================
 * Excel 匯入：讀取所有工作表 → 依欄位對應表轉為資料模型 → 驗證
 * 瀏覽器（SheetJS 全域 XLSX）與 Node（tools/build-data.js）共用此檔。
 * ========================================================================= */
(function (root) {
  const CFG = root.APP_CONFIG || (typeof require !== 'undefined' ? require('./config.js') : null);

  const clean = (s) => String(s == null ? '' : s).replace(/[\r\n\s]+/g, '').trim();
  const isBlank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

  function sheetRows(XLSX, ws) {
    return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
  }

  /** 解析單一工作表：找出表頭列（第一欄 = headerKey），回傳物件陣列 */
  function parseTable(XLSX, wb, sheetName, spec, report) {
    const ws = wb.Sheets[sheetName];
    if (!ws) { report.errors.push({ sheet: sheetName, msg: '缺少工作表「' + sheetName + '」' }); return []; }
    const rows = sheetRows(XLSX, ws);
    const hIdx = rows.findIndex((r) => r && clean(r[0]) === clean(spec.headerKey));
    if (hIdx < 0) { report.errors.push({ sheet: sheetName, msg: '找不到表頭列（第一欄應為「' + spec.headerKey + '」）' }); return []; }
    const header = rows[hIdx].map(clean);
    const colIndex = {};
    const mapClean = {};
    Object.keys(spec.cols).forEach((k) => { mapClean[clean(k)] = spec.cols[k]; });
    header.forEach((h, i) => { if (h && mapClean[h] && colIndex[mapClean[h]] === undefined) colIndex[mapClean[h]] = i; });
    // 必要欄位
    spec.required.forEach((req) => {
      if (colIndex[mapClean[clean(req)]] === undefined) report.errors.push({ sheet: sheetName, msg: '缺少必要欄位「' + req + '」' });
    });
    // 欄位名稱檢查：對應表中有但檔案中沒有
    Object.keys(spec.cols).forEach((k) => {
      if (colIndex[spec.cols[k]] === undefined && spec.required.indexOf(k) < 0) report.warnings.push({ sheet: sheetName, msg: '欄位「' + k.replace(/\n/g, '') + '」未找到，該指標將顯示「資料未提供」' });
    });
    const out = [];
    for (let r = hIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || isBlank(row[0])) continue;
      const o = { _row: r + 1 };
      Object.keys(colIndex).forEach((key) => {
        let v = row[colIndex[key]];
        if (isBlank(v)) v = null;
        else if (typeof v === 'string') v = v.trim();
        o[key] = v;
      });
      out.push(o);
    }
    return out;
  }

  function normMonth(v) {
    if (v == null) return null;
    if (typeof v === 'number') { // Excel 日期序號
      const d = new Date(Math.round((v - 25569) * 86400 * 1000));
      return d.getUTCFullYear() + '/' + String(d.getUTCMonth() + 1).padStart(2, '0');
    }
    const m = String(v).match(/(\d{4})\D?(\d{1,2})/);
    return m ? m[1] + '/' + m[2].padStart(2, '0') : null;
  }

  /** 讀「綜合戰力指數」工作表中的權重，作為系統預設 */
  function parseWeights(XLSX, wb, report) {
    const ws = wb.Sheets['綜合戰力指數'];
    if (!ws) { report.warnings.push({ sheet: '綜合戰力指數', msg: '缺少權重工作表，沿用系統預設權重' }); return null; }
    const rows = sheetRows(XLSX, ws);
    const labelToKey = {};
    Object.keys(CFG.DEFAULT_CONFIG.dimensions).forEach((role) => {
      CFG.DEFAULT_CONFIG.dimensions[role].forEach((d) => { labelToKey[role + '|' + d.label] = d.key; });
    });
    const res = { SA: {}, CA: {} };
    let cur = null;
    rows.forEach((r) => {
      if (!r) return;
      const a = clean(r[0]);
      if (a === '服專') cur = 'SA'; else if (a === '出納') cur = 'CA'; else if (a) cur = null;
      if (cur && typeof r[2] === 'number') {
        const k = labelToKey[cur + '|' + clean(r[1])];
        if (k) res[cur][k] = r[2];
      }
    });
    return res;
  }

  /** 讀「人才九宮格」工作表（供核對） */
  function parseGridSheet(XLSX, wb) {
    const ws = wb.Sheets['人才九宮格'];
    if (!ws) return null;
    const rows = sheetRows(XLSX, ws);
    const res = { SA: {}, CA: {} };
    let cur = null;
    rows.forEach((r) => {
      if (!r) return;
      const a = clean(r[0]);
      if (a.indexOf('服專人才九宮格') >= 0) cur = 'SA';
      if (a.indexOf('出納人才九宮格') >= 0) cur = 'CA';
      if (cur && ['高成熟', '中成熟', '發展期'].indexOf(a) >= 0) {
        [1, 2, 3].forEach((c) => {
          const m = String(r[c] || '').match(/^(.+?)｜(\d+)人/);
          if (m) res[cur][m[1]] = Number(m[2]);
        });
      }
    });
    return res;
  }

  /** 讀「管理總覽」核心數字（供核對） */
  function parseOverview(XLSX, wb) {
    const ws = wb.Sheets['管理總覽'];
    if (!ws) return null;
    const rows = sheetRows(XLSX, ws);
    const ref = {};
    for (let i = 0; i < rows.length - 1; i++) {
      const r = rows[i] || [], n = rows[i + 1] || [];
      r.forEach((h, c) => { if (typeof h === 'string' && typeof n[c] === 'number') ref[clean(h)] = n[c]; });
    }
    const note = rows[1] && rows[1][0];
    const monthly = [];
    rows.forEach((r) => { if (r && /^\d{4}\/\d{2}$/.test(String(r[0] || '').trim()) && typeof r[1] === 'number') monthly.push({ month: String(r[0]).trim(), cars: r[1], revenue: r[2], orders: r[3] }); });
    return { ref, note: note || '', monthly };
  }

  /** 主流程：workbook → { model, report } */
  function parseWorkbook(XLSX, wb, fileName) {
    const report = { fileName: fileName || '', sheets: wb.SheetNames.slice(), errors: [], warnings: [], stats: {} };
    const M = CFG.FIELD_MAP;
    const saPeople = parseTable(XLSX, wb, '服專總覽', M['服專總覽'], report);
    const caPeople = parseTable(XLSX, wb, '出納總覽', M['出納總覽'], report);
    const saMonthly = parseTable(XLSX, wb, '服專月度明細', M['服專月度明細'], report);
    const caMonthly = parseTable(XLSX, wb, '出納月度明細', M['出納月度明細'], report);
    const plants = parseTable(XLSX, wb, '服務廠量能', M['服務廠量能'], report);
    const plantMonthly = parseTable(XLSX, wb, '廠別月度量能', M['廠別月度量能'], report);
    const checks = parseTable(XLSX, wb, '資料檢核', M['資料檢核'], report);
    const definitions = parseTable(XLSX, wb, '指標定義', M['指標定義'], report);
    const sources = parseTable(XLSX, wb, '資料來源', M['資料來源'], report);
    const weights = parseWeights(XLSX, wb, report);
    const gridRef = parseGridSheet(XLSX, wb);
    const overview = parseOverview(XLSX, wb);

    // 月份正規化 + 月份檢查
    [saMonthly, caMonthly, plantMonthly].forEach((arr, i) => {
      const nm = ['服專月度明細', '出納月度明細', '廠別月度量能'][i];
      arr.forEach((r) => {
        const m = normMonth(r.month);
        if (!m) report.errors.push({ sheet: nm, row: r._row, msg: '月份格式無法辨識：' + r.month });
        r.month = m;
      });
    });
    saPeople.forEach((p) => { p.role = 'SA'; });
    caPeople.forEach((p) => { p.role = 'CA'; });
    saMonthly.forEach((r) => { r.role = 'SA'; });
    caMonthly.forEach((r) => { r.role = 'CA'; });

    // 重複資料檢查
    const dup = (arr, keyFn, sheet) => {
      const seen = {};
      arr.forEach((r) => {
        const k = keyFn(r);
        if (/undefined|null/.test(k)) return;
        if (seen[k]) report.warnings.push({ sheet, row: r._row, msg: '重複資料：' + k + '（首次出現於第' + seen[k] + '列）' });
        else seen[k] = r._row;
      });
    };
    dup(saPeople, (r) => r.name, '服專總覽');
    dup(caPeople, (r) => r.name, '出納總覽');
    dup(saMonthly, (r) => r.month + '｜' + r.name, '服專月度明細');
    dup(caMonthly, (r) => r.month + '｜' + r.name, '出納月度明細');

    // 空值檢查（必要欄位）
    const reqNull = (arr, spec, sheet) => {
      arr.forEach((r) => {
        spec.required.forEach((req) => {
          const k = spec.cols[req];
          if (r[k] == null && !(sheet.indexOf('總覽') >= 0 && ['license', 'years'].indexOf(k) >= 0 && r.status !== '現行'))
            report.warnings.push({ sheet, row: r._row, msg: '必要欄位「' + req + '」空值' + (r.name ? '（' + r.name + '）' : '') });
        });
      });
    };
    reqNull(saPeople, M['服專總覽'], '服專總覽');
    reqNull(caPeople, M['出納總覽'], '出納總覽');

    // 最新廠別 vs 實際廠別
    const mismatch = [];
    saMonthly.concat(caMonthly).forEach((r) => {
      if (r.latestPlant && r.actualPlant && r.latestPlant !== r.actualPlant)
        mismatch.push({ role: r.role, name: r.name, month: r.month, latest: r.latestPlant, actual: r.actualPlant });
    });

    const months = Array.from(new Set(saMonthly.concat(caMonthly).map((r) => r.month).filter(Boolean))).sort();
    report.stats = {
      saPeople: saPeople.length, caPeople: caPeople.length,
      saMonthly: saMonthly.length, caMonthly: caMonthly.length,
      plants: plants.length, plantMonthly: plantMonthly.length,
      checks: checks.length, months, plantMismatch: mismatch.length
    };
    report.affectedMonths = months;
    report.affectedPeople = Array.from(new Set(saPeople.concat(caPeople).map((p) => p.name)));

    const model = {
      meta: { fileName: fileName || '', importedAt: new Date().toISOString(), note: overview ? overview.note : '', months },
      saPeople, caPeople, saMonthly, caMonthly, plants, plantMonthly, checks, definitions, sources,
      excelWeights: weights, gridRef, overviewRef: overview ? overview.ref : {}, overviewMonthly: overview ? overview.monthly : [], plantMismatch: mismatch
    };
    return { model, report };
  }

  const api = { parseWorkbook, normMonth };
  root.Importer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
