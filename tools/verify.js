const XLSX=require('xlsx');const C=require('../app/js/config.js');const I=require('../app/js/importer.js');const E=require('../app/js/engine.js');
const f=process.argv[2]||'C:/Users/ES/OneDrive/桌面/AI參照/2026服專出納服務量能_綜合分析_人才盤點更新.xlsx';
const {model}=I.parseWorkbook(XLSX,XLSX.readFile(f),'x');
const cfg=JSON.parse(JSON.stringify(C.DEFAULT_CONFIG));
const people=E.buildPeople(model,cfg,model.meta.months);
let bad=0,checked=0;const fieldsBad={};
for(const role of ['SA','CA']){
 const map=C.FIELD_MAP[role==='SA'?'服專總覽':'出納總覽'].cols;
 for(const p of people[role]){
  for(const k of Object.values(map)){
   if(['plant','name','license','years','status','position','advice'].includes(k))continue;
   const H=(model.headers||{})[role==='SA'?'服專總覽':'出納總覽'];if(H&&!H[k])continue;
   const ex=p.excel[k], me=p[k];checked++;
   let ok;
   if(ex==null) ok = (me==null) || (typeof me==='number' && k.match(/^(total|ng|key)/) && me===0);
   else if(typeof ex==='number') ok = me!=null && Math.abs(ex-me)<1e-6*Math.max(1,Math.abs(ex));
   else ok = String(ex)===String(me);
   if(!ok){bad++;fieldsBad[k]=(fieldsBad[k]||0)+1; if(fieldsBad[k]<=3) console.log(role,p.name,k,'excel=',ex,'engine=',me);}
  }
 }
}
console.log('checked',checked,'mismatch',bad,fieldsBad);
// grid
for(const role of ['SA','CA']){const g={};people[role].filter(p=>p.status==='現行').forEach(p=>g[p.talentType]=(g[p.talentType]||0)+1);
 const ref=model.gridRef[role];const diffs=Object.keys(ref).filter(k=>ref[k]!==(g[k]||0));console.log(role,'grid diffs',diffs, 'current',people[role].filter(p=>p.status==='現行').length);}
