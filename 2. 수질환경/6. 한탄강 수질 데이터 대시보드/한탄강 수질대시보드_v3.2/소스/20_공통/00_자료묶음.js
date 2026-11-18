/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   [20_공통/00_자료묶음.js] 자료 묶음(관리 구분) 고르기
   하는 일 : 주소의 #grp=… 또는 이 브라우저에 저장한 묶음(연구원 관리 / 한강유역환경청)을 골라, 그 묶음의 지점·월·측정값으로 D를 바꿔 끼운다. 다른 부품은 바뀐 D를 그대로 쓴다
   주요 이름: GRP, GRPS, GRP_INFO, GRP_DEF, GRP_HIDE, switchGroup
   이럴 때 고침: 묶음별로 숨길 화면(GRP_HIDE), 묶음 전환 방식
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const GRP_KEY = "hantan-wq-group-v3";
const GRPS = D.groups || [{key:"lab", label:"연구원 관리", n:(D.stations||[]).length, desc:""}];
const GRP = (()=>{ const ok = k => GRPS.some(g=>g.key===k);
  const h = (location.hash.match(/grp=([\w-]+)/)||[])[1];
  if(ok(h)) return h;
  try{ const s = localStorage.getItem(GRP_KEY); if(ok(s)) return s; }catch(e){}
  return "lab"; })();
const GRP_INFO = GRPS.find(g=>g.key===GRP) || GRPS[0];
const GRP_DEF = {};                                  // 묶음별 처음 화면(선택 지점·시작 월·종단 하천)
const GRP_HIDE = GRP==="lab" ? [] : ["edit"];         // 이 묶음에서 숨길 화면 — 한강청 지점은 API 원본 좌표를 쓰므로 '지점 관리' 숨김
if(GRP!=="lab" && D[GRP]){
  const g = D[GRP], dates = {};
  for(const [n, arr] of Object.entries(g.datesD||{})){ const o = {}; arr.forEach((d,i)=>{ if(d) o[g.months[i]] = `${g.months[i]}-${String(d).padStart(2,"0")}`; }); dates[n] = o; }
  Object.assign(D, {stations:g.stations, months:g.months, values:g.values, dates, loq:g.loq||{}, qc:g.qc||[],
    yearly:g.yearly||{}, yearlyInfo:g.yearlyInfo||{}, source:g.source, grpNote:g.note||""});
  Object.assign(GRP_DEF, g.defaults||{});
}
for(const g of GRPS) if(g.key!=="lab") delete D[g.key];   // 안 쓰는 묶음은 메모리에서 뺌
document.documentElement.dataset.grp = GRP;
function switchGroup(k){
  if(k===GRP) return;
  try{ localStorage.setItem(GRP_KEY, k); }catch(e){}
  location.hash = "grp=" + k; location.reload();
}
