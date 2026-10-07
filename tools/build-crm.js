// 將 CRM 查詢結果（去識別化）轉為 app/data/crm.js
// 用法：node build-crm.js <CRM.xlsx> [查詢日 YYYY-MM-DD，預設取檔名中的日期]
const fs = require('fs'), path = require('path'), XLSX = require('xlsx');
const C = require('../app/js/config.js'); const I = require('../app/js/importer.js');
const f = process.argv[2];
const wb = XLSX.readFile(f);
const qd = process.argv[3] || (path.basename(f).match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || new Date().toISOString().slice(0, 10);
const { rows, report } = I.parseCrm(XLSX, wb, path.basename(f), qd);
const out = '/* 自動產生：CRM 查詢結果（去識別化）' + path.basename(f) + ' — 請用 tools/build-crm.js 或系統「資料匯入」更新 */\nwindow.CRM_DATA = ' + JSON.stringify({ meta: { file: path.basename(f), queryDate: qd, count: rows.length }, rows }) + ';\n';
fs.writeFileSync(path.join(__dirname, '../app/data/crm.js'), out);
console.log('rows', rows.length, 'warnings', report.warnings.length, (out.length / 1024).toFixed(0) + 'KB', report.warnings.slice(0, 5));
