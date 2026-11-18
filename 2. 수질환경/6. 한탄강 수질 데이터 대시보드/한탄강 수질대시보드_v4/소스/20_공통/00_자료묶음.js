/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   [20_공통/00_자료묶음.js] 자료 묶음(관리 구분) 고르기
   하는 일 : 주소의 #grp=… 또는 이 브라우저에 저장한 묶음(조사기관: 경기도 보건환경연구원이 맨 위, 나머지는 지점 수 순)을 골라, 그 묶음의 지점·월·측정값으로 D를 바꿔 끼운다. 다른 부품은 바뀐 D를 그대로 쓴다
   주요 이름: GRP, GRPS, GRP_INFO, GRP_DEF, GRP_HIDE, switchGroup, unpack
   이럴 때 고침: 묶음별로 숨길 화면(GRP_HIDE), 묶음 전환 방식
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* 묶음 목록(빌드가 만듦, tools/api_data.py): 수질측정망 API 자료의 조사기관별 지점 묶음 */
const GRP_KEY = "hantan-wq-group-v4";
const GRPS = D.groups || [];
const GRP = (()=>{ const ok = k => GRPS.some(g=>g.key===k);
  const h = (location.hash.match(/grp=([\w-]+)/)||[])[1];
  if(ok(h)) return h;
  try{ const s = localStorage.getItem(GRP_KEY); if(ok(s)) return s; }catch(e){}
  return GRPS[0].key; })();
const GRP_INFO = GRPS.find(g=>g.key===GRP) || GRPS[0];
const GRP_DEF = Object.assign({}, GRP_INFO.defaults||{});   // 묶음별 처음 화면(선택 지점·시작 월·종단 하천)
const GRP_HIDE = [];                                          // 묶음별로 숨길 화면 id(필요할 때만)
if(GRP_INFO.api && D.api){
  const A = D.api, orgs = GRP_INFO.orgs;
  const sts = A.stations.filter(s=>!orgs || orgs.includes(s.org)), keep = new Set(sts.map(s=>s.name));
  const values = {}, dates = {};
  /* '첫 값 위치|값,값,,값' → 월 수만큼의 배열(빈칸 = null) — tools/api_data.py 의 pack_values 와 짝 */
  const unpack = str => { const a = new Array(A.months.length).fill(null); if(!str) return a;
    const [st, body] = str.split("|"); body.split(",").forEach((v,i)=>{ if(v!=="") a[+st+i] = +v; }); return a; };
  for(const s of sts){
    values[s.name] = Object.fromEntries(Object.entries(A.valuesC[s.name]||{}).map(([c,str])=>[c, unpack(str)]));
    const o = {}; (A.datesD[s.name]||[]).forEach((d,i)=>{ if(d) o[A.months[i]] = `${A.months[i]}-${String(d).padStart(2,"0")}`; }); dates[s.name] = o;
  }
  Object.assign(D, {stations:sts, months:A.months, values, dates, loq:{}, qc:A.qc.filter(q=>keep.has(q.st)),
    yearly:{}, yearlyInfo:{}, source:A.source, grpNote:A.note||""});
}
delete D.api;                                            // 나눠 담았으니 원본은 메모리에서 뺌
document.documentElement.dataset.grp = GRP;
function switchGroup(k){
  if(k===GRP) return;
  try{ localStorage.setItem(GRP_KEY, k); }catch(e){}
  location.hash = "grp=" + k; location.reload();
}
