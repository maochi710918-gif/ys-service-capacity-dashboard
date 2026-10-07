const XLSX=require('xlsx');require('../app/js/config.js');const I=require('../app/js/importer.js');const E=require('../app/js/engine.js');
const f='C:/Users/ES/OneDrive/桌面/AI參照/凱涵/2026服專出納服務量能_綜合分析_人才盤點_1-9月更新更正版.xlsx';
const {model}=I.parseWorkbook(XLSX,XLSX.readFile(f),'x');global.M=model;
const P=E.buildPeople(model,JSON.parse(JSON.stringify(require('../app/js/config.js').DEFAULT_CONFIG)),model.meta.months);global.P=P;
const show=(role,n)=>{const p=P[role].find(x=>x.name===n);const e=p.excel;console.log('==',n,p.status,'employ',e.employMonths,'basis',e.avgBasis,'|',e.coverage);
 p.monthly.forEach(r=>console.log(r.month,r.actualPlant,'cars',r.cars,'rev',r.revenue,'app',r.app,r.appCount,r.appBase,'csi',r.csi,'ngFee',r.ngFee,'key',r.keyUnlock,'flag',r.employedFlag,'wd',r.workdays,'cap',r.capRate,'orders',r.orders));
 ['avgCars','avgRevenue','perCar','app','volatility','trendCars','trendRevenue','trendCsi','completeness','ngFeePer100','keyPer100','avgOrders','esign','trendOrders'].forEach(k=>console.log(' ',k,'excel',e[k],'eng',p[k]));};
module.exports=show;
if(require.main===module){show('SA','吳俊彥');show('SA','莊正秀');show('SA','張景智');show('SA','許譯仁');}
