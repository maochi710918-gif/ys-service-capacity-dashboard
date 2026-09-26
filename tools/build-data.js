// 將 Excel 轉為 app/data/data.js（預設資料）。用法：node build-data.js [excel路徑]
const fs=require('fs'),path=require('path'),XLSX=require('xlsx');
require('../app/js/config.js');const I=require('../app/js/importer.js');
const f=process.argv[2]||'C:/Users/ES/OneDrive/桌面/AI參照/2026服專出納服務量能_綜合分析_人才盤點更新.xlsx';
const {model,report}=I.parseWorkbook(XLSX,XLSX.readFile(f),path.basename(f));
if(report.errors.length){console.error(report.errors);process.exit(1);}
model.meta.importedAt=fs.statSync(f).mtime.toISOString();
const out='/* 自動產生：來源 '+path.basename(f)+' — 請勿手動編輯，改用 tools/build-data.js 或系統「資料匯入」 */\nwindow.RAW_MODEL = '+JSON.stringify(model)+';\nwindow.RAW_REPORT = '+JSON.stringify(report)+';\n';
fs.writeFileSync(path.join(__dirname,'../app/data/data.js'),out);
console.log('ok',report.stats,'warnings',report.warnings.length,(out.length/1024).toFixed(0)+'KB');
