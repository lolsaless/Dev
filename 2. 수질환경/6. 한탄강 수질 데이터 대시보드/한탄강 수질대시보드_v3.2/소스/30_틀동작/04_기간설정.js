/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   [30_틀동작/04_기간설정.js] 기간 설정 막대(모든 화면 위)
   하는 일 : 시작·끝 연도/월 고르기, 빠른 기간 버튼(최근 1·3·5·10년, 올해, 작년, 전체), 고른 기간 표시. 왼쪽 패널 '기간'과 같은 값(S.from·S.to)을 바꾼다
   주요 이름: PERIOD_QUICK, renderPeriod, setPeriod, monthIdx
   이럴 때 고침: 빠른 기간 버튼 종류(PERIOD_QUICK)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const PERIOD_QUICK = [["1y","최근 1년"],["3y","최근 3년"],["5y","최근 5년"],["10y","최근 10년"],["thisY","올해"],["lastY","작년"],["all","전체"]];
const P_YEARS = [...new Set(M.map(m=>m.slice(0,4)))];
/* 'YYYY-MM' → M 의 위치. 정확히 없으면 dir>0 이면 그 뒤 첫 달, dir<0 이면 그 앞 마지막 달 */
function monthIdx(ym, dir){
  const i = M.indexOf(ym); if(i>=0) return i;
  if(dir>0){ const k = M.findIndex(m=>m>ym); return k<0 ? M.length-1 : k; }
  let k = -1; M.forEach((m,j)=>{ if(m<ym) k=j; }); return k<0 ? 0 : k;
}
function setPeriod(a, b){
  a = Math.max(0, Math.min(a, M.length-1)); b = Math.max(0, Math.min(b, M.length-1));
  if(a>b) [a,b] = [b,a];
  S.from = a; S.to = b; syncOpts(); refresh();
}
function quickPeriod(k){
  const last = M[M.length-1], ly = +last.slice(0,4), lm = +last.slice(5);
  const back = n => { const t = ly*12 + (lm-1) - (n*12-1); return `${Math.floor(t/12)}-${String(t%12+1).padStart(2,"0")}`; };
  if(k==="all") return setPeriod(0, M.length-1);
  if(k==="thisY") return setPeriod(monthIdx(ly+"-01", 1), M.length-1);
  if(k==="lastY") return setPeriod(monthIdx((ly-1)+"-01", 1), monthIdx((ly-1)+"-12", -1));
  setPeriod(monthIdx(back(parseInt(k)), 1), M.length-1);
}
function renderPeriod(){
  const a = M[S.from], b = M[S.to];
  const ySel = (id, v) => { $(id).innerHTML = P_YEARS.map(y=>`<option ${y===v?"selected":""}>${y}</option>`).join(""); };
  const mSel = (id, y, v) => { const ms = M.filter(m=>m.startsWith(y+"-")).map(m=>m.slice(5));
    $(id).innerHTML = ms.map(m=>`<option value="${m}" ${m===v?"selected":""}>${+m}월</option>`).join(""); };
  ySel("pFromY", a.slice(0,4)); mSel("pFromM", a.slice(0,4), a.slice(5));
  ySel("pToY", b.slice(0,4)); mSel("pToM", b.slice(0,4), b.slice(5));
  const n = S.to - S.from + 1, yrs = new Set(M.slice(S.from, S.to+1).map(m=>m.slice(0,4))).size;
  $("pInfo").textContent = `${mLong(a)} ~ ${mLong(b)} · ${n}개월(${yrs}개 연도)` + (n<24 ? " · 추세 해석은 24개월 이상 권장" : "");
  document.querySelectorAll("#pQuick button").forEach(x=>x.setAttribute("aria-pressed", "false"));
  $("perBar").hidden = M.length < 2;
}
onRefresh(renderPeriod);
onInit(()=>{
  $("pQuick").innerHTML = PERIOD_QUICK.map(([k,l])=>`<button data-q="${k}" aria-pressed="false">${l}</button>`).join("");
  $("pQuick").querySelectorAll("button").forEach(b=>b.onclick=()=>{ quickPeriod(b.dataset.q); b.setAttribute("aria-pressed","true"); toast(`기간: ${mLong(M[S.from])} ~ ${mLong(M[S.to])}`); });
  const fromSel = () => setPeriod(monthIdx(`${$("pFromY").value}-${$("pFromM").value||"01"}`, 1), S.to);
  const toSel = () => setPeriod(S.from, monthIdx(`${$("pToY").value}-${$("pToM").value||"12"}`, -1));
  $("pFromY").onchange = ()=>{ $("pFromM").value = ""; setPeriod(monthIdx(`${$("pFromY").value}-01`, 1), S.to); };
  $("pFromM").onchange = fromSel;
  $("pToY").onchange = ()=>{ setPeriod(S.from, monthIdx(`${$("pToY").value}-12`, -1)); };
  $("pToM").onchange = toSel;
});
