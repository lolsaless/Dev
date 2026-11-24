/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   [40_화면/22_자료해석.js] 자료 해석 화면
   하는 일 : 선택한 지점·기간·항목의 경향을 통계로 계산해 문장으로 풀어 쓴다(종합 해석·연평균·계절 패턴·지점별 표·7개 항목 종합)
   주요 이름: renderInterp, interpStation, ITEM_NOTE, INTERP_CFG, IP_COLOR_DEF, ipColor
   이럴 때 고침: 해석 문구(ITEM_NOTE), 판단 기준(INTERP_CFG: 유의수준·계절 비율·최근 기간), 화면 구성
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
registerView({ id:"interp", label:"자료 해석", kpi:false, item:true, render:()=>renderInterp(),
  bind(){
    $("ipCopy").onclick=()=>copyText(cache.ipText||"");
    $("ipTblCopy").onclick=()=>copyText(tsvText(cache.ipTsv||[]));
    $("ipMd").onclick=()=>saveFile(`자료해석_${GRP_INFO.label}_${S.item}_${cache.ipRange||""}.md`, URL.createObjectURL(new Blob([cache.ipMd||""],{type:"text/markdown"})));
  }});

/* ── 판단 기준(바꿀 수 있는 값) ───────────────────────────── */
const INTERP_CFG = {
  p: 0.05, pWeak: 0.10,         // 추세 유의수준(뚜렷함 / 약한 경향)
  recent: 12,                   // '최근' = 선택 기간 끝에서 12개월
  before: 36,                   // 비교 대상 = 그 앞 36개월
  wetMonths: [6,7,8,9],         // 강우기(홍수기)
  dryMonths: [12,1,2,3],        // 갈수기(겨울)
  seasonHi: 1.3,                // 강우기/갈수기 평균 비율이 이 값 이상 → 강우기 높음, 1/이 값 이하 → 갈수기 높음
  minN: 12,                     // 지점 해석에 필요한 최소 측정 개월
  corrStrong: 0.5,              // 항목 간 상관 언급 기준 |ρ|
};
/* ── 항목별 일반 해석(가능성 수준의 설명, 원인 단정 아님) ──────────────── */
const ITEM_NOTE = {
  "BOD": {what:"미생물이 분해할 수 있는 유기물", grp:"유기물", up:"생활하수·축산 폐수처럼 분해가 쉬운 유기물 유입이 늘었을 가능성",
          wet:"강우 초기 비점오염(도로·농경지 씻김) 유출 영향", dry:"갈수기 유량이 줄어 하·폐수 방류수가 덜 희석된 영향"},
  "TOC": {what:"분해가 어려운 것까지 포함한 유기물 전체", grp:"유기물", up:"난분해성 유기물(산단·처리 방류수) 또는 조류(녹조) 증가 가능성",
          wet:"강우 시 토양 유기물·비점오염 유출 영향", dry:"갈수기 방류수 비중이 커진 영향"},
  "COD": {what:"산화제로 잰 유기물(일부 무기물 포함)", grp:"유기물", up:"유기물 부하 증가 가능성(TOC와 함께 확인)",
          wet:"강우 시 유기물 유출 영향", dry:"갈수기 희석 감소 영향"},
  "SS":  {what:"물에 떠 있는 입자(흙·조류 등)", grp:"입자·색", up:"토지 개발·공사, 하상 교란 또는 조류 증가 가능성",
          wet:"강우 유출로 토사가 들어온 영향(가장 흔한 원인)", dry:"갈수기 조류 증식 또는 점오염원 영향"},
  "T-N": {what:"질소 전체(질산성·암모니아성·유기성)", grp:"영양염", up:"하수처리 방류수·축산·농경지 비료 영향 증가 가능성",
          wet:"강우 시 농경지·축산 비점오염 유출 영향", dry:"겨울철 낮은 수온으로 질소 제거(탈질·식물 흡수)가 줄고 유량이 적어 높아지는 일반적 형태"},
  "T-P": {what:"인 전체 — 녹조(부영양화) 관리의 핵심 항목", grp:"영양염", up:"하수처리 방류·축산 영향 증가 가능성",
          wet:"강우 시 토사에 붙은 입자성 인이 쓸려 들어온 영향", dry:"갈수기 방류수 희석 감소 영향"},
  "색도": {what:"물의 색(염료·부식질 등)", grp:"입자·색", up:"염색·피혁 등 산업단지 배출 영향 가능성",
          wet:"강우 시 부식질·토사 유입 영향", dry:"갈수기 산단 방류수 비중이 커진 영향"},
};
/* 받침에 따라 '으로/로' */
function iga(w){ const m = String(w).match(/[가-힣](?=[^가-힣]*$)/); if(!m) return "이(가)"; return (m[0].charCodeAt(0)-0xAC00)%28 ? "이" : "가"; }
function ro(w){ const m = String(w).match(/[가-힣](?=[^가-힣]*$)/); if(!m) return "으로"; const c = (m[0].charCodeAt(0)-0xAC00)%28; return c===0||c===8 ? "로" : "으로"; }
const IP_GROUPS = [["유기물",["BOD","TOC","COD"]],["영양염",["T-N","T-P"]],["입자·색",["SS","색도"]]];

/* ── 계절 막대 색(사용자 지정, S.ipColors 에 저장) ─────────────────── */
const IP_COLOR_DEF = {wet:"#2a78d6", dry:"#eb6834", mid:"#9aaba9"};
const ipColor = k => (S.ipColors||{})[k] || IP_COLOR_DEF[k];
onInit(()=>{
  ["wet","dry","mid"].forEach(k=>{ const el = $("ipC_"+k); el.value = ipColor(k);
    el.onchange = ()=>{ S.ipColors = Object.assign({}, S.ipColors, {[k]: el.value}); refresh(); }; });
  $("ipCReset").onclick = ()=>{ S.ipColors = {}; ["wet","dry","mid"].forEach(k=>$("ipC_"+k).value = IP_COLOR_DEF[k]); refresh(); toast("막대 색을 기본값으로 되돌렸습니다"); };
});
/* ── 계산 도우미 ─────────────────────────────────────────── */
const meanOf = a => { const v = a.filter(x=>x!=null); return v.length ? v.reduce((x,y)=>x+y,0)/v.length : null; };
const pctChg = (a, b) => (a!=null && b) ? (a-b)/b*100 : null;
const sgnPct = (v, d=0) => v==null ? "-" : (v>0?"+":"")+v.toFixed(d)+"%";
/* 기준선: 생활환경기준 'II(약간좋음)' 상한 또는 목표값 */
function refLimit(item){
  const L = D.limits[item]; if(L && L.length){ const g = L.find(x=>x.code==="II"); if(g && g.max!=null) return {v:g.max, label:"II등급(약간좋음) 상한"}; }
  const t = targetOf(item); if(t!=null) return {v:t, label:"목표"};
  return null;
}
function trendWord(r){
  if(!r || !r.ok) return {t:"자료 부족", k:"na"};
  if(r.p < INTERP_CFG.p) return r.slope>0 ? {t:"뚜렷한 증가", k:"up"} : {t:"뚜렷한 감소", k:"dn"};
  if(r.p < INTERP_CFG.pWeak) return r.slope>0 ? {t:"증가 경향(약함)", k:"up2"} : {t:"감소 경향(약함)", k:"dn2"};
  return {t:"뚜렷한 추세 없음", k:"flat"};
}
/* 한 지점·한 항목 해석 */
function interpStation(n, item, ms){
  const v = series(n, item), it = itemOf(item), s = stats(v);
  const r = mannKendall(v, ms), k = INTERP_CFG;
  const tw = ms.length < 24 ? {t:"판단 보류(기간 짧음)", k:"na"} : trendWord(r);   // 2년 미만은 계절 변동과 추세를 구분할 수 없음
  const last = v.length - 1;
  const rec = meanOf(v.slice(Math.max(0, last-k.recent+1)));
  const bef = meanOf(v.slice(Math.max(0, last-k.recent-k.before+1), Math.max(0, last-k.recent+1)));
  const clim = Array.from({length:12}, (_,i)=>meanOf(v.filter((x,j)=>+ms[j].slice(5)===i+1)));
  const yrs = new Set(ms.filter((m,j)=>v[j]!=null).map(m=>m.slice(0,4))).size;
  let peak = null, ratio = null;
  if(yrs>=2){ const c = clim.map((x,i)=>[x,i+1]).filter(x=>x[0]!=null); if(c.length>=6){ peak = c.sort((a,b)=>b[0]-a[0])[0][1]; }
    const w = meanOf(k.wetMonths.map(m=>clim[m-1])), d = meanOf(k.dryMonths.map(m=>clim[m-1])); ratio = (w!=null && d) ? w/d : null; }
  const ref = refLimit(item), vv = v.filter(x=>x!=null);
  const exceed = ref && vv.length ? vv.filter(x=>x>ref.v+1e-12).length/vv.length*100 : null;
  const j = judge(item, rec);
  const pctYr = r.ok && r.med ? (LONG() ? r.slope*12/r.med*100 : null) : null;
  const need = Math.min(k.minN, Math.max(4, Math.ceil(ms.length*0.6)));   // 기간이 짧으면 기준을 낮춤(참고용 해석)
  return {n, it, s, r, tw, rec, bef, chg: pctChg(rec, bef), clim, peak, ratio, exceed, j, pctYr, yrs, enough: s.n >= need, need};
}
function seasonText(ratio, item){
  if(ratio==null) return null; const N = ITEM_NOTE[item] || {}, h = INTERP_CFG.seasonHi;
  if(ratio >= h) return {k:"wet", t:`강우기(6~9월)가 갈수기(12~3월)보다 ${ratio.toFixed(1)}배 높음`, why:N.wet};
  if(ratio <= 1/h) return {k:"dry", t:`갈수기(12~3월)가 강우기(6~9월)보다 ${(1/ratio).toFixed(1)}배 높음`, why:N.dry};
  return {k:"flat", t:"계절 차이 작음", why:null};
}
/* 한 줄 해석(지점) */
function stationLine(x){
  if(!x.enough) return `측정 ${x.s.n}개월로 자료가 적어(${x.need}개월 미만) 해석을 보류합니다.`;
  const u = x.it.unit, d = x.it.dec, parts = [];
  parts.push(`${x.tw.t}${x.pctYr!=null && x.tw.k!=="flat" && x.tw.k!=="na" ? `(${sgnPct(x.pctYr,1)}/년)` : ""}`);
  if(x.rec!=null) parts.push(`최근 1년 평균 ${fmt(x.rec,d)}${u}${x.j.text?`(${x.j.text})`:""}`);
  if(x.chg!=null && Math.abs(x.chg)>=20) parts.push(`직전 3년보다 ${sgnPct(x.chg)}`);
  const se = seasonText(x.ratio, x.it.code); if(se && se.k!=="flat") parts.push(se.k==="wet"?"강우기에 높음":"갈수기에 높음");
  if(x.exceed!=null && x.exceed>=30) parts.push(`기준 초과 ${x.exceed.toFixed(0)}%`);
  return parts.join(" · ");
}

/* ── 화면 ─────────────────────────────────────────────────── */
function renderInterp(){
  const names = selectedOrdered(), ms = months(), item = S.item, it = itemOf(item), N = ITEM_NOTE[item] || {}, K = INTERP_CFG;
  const rng = `${mLong(ms[0])}~${mLong(ms[ms.length-1])}`;
  cache.ipRange = `${ms[0]}_${ms[ms.length-1]}`;
  $("ipTitle").textContent = `${it.name} 자료 해석`;
  $("ipSub").textContent = `${GRP_INFO.label} · ${names.length}개 지점 · ${rng}`;
  if(!names.length){ $("ipSum").innerHTML = `<p class="hint">왼쪽에서 지점을 선택하세요.</p>`; $("ipTbl").innerHTML=""; $("ipItems").innerHTML=""; chartOn("ipYear").clear(); chartOn("ipSeason").clear(); return; }
  const X = names.map(n=>interpStation(n, item, ms)), ok = X.filter(x=>x.enough);
  const ref = refLimit(item), d = it.dec, u = it.unit;
  const L = []; // [제목, 문장(HTML)]
  /* 1. 자료 개요 */
  const nVal = X.reduce((a,x)=>a+x.s.n,0), cover = nVal/(names.length*ms.length)*100;
  L.push(["자료", `${rng} ${names.length}개 지점의 ${it.name} 월별 값 <b>${nVal.toLocaleString()}개</b>(빈칸 제외, 채움률 ${cover.toFixed(0)}%)를 분석했습니다. ${it.name}은(는) ${N.what||"측정 항목"}을 나타냅니다.`
    + (ms.length<24 ? ` <b>기간이 ${ms.length}개월로 짧아</b> 추세·계절 해석은 참고용입니다(왼쪽 '기간'을 3년 이상으로 넓히면 정확해집니다).` : "")]);
  if(!ok.length){ L.push(["주의", `모든 지점의 측정 개월 수가 부족해 해석할 수 없습니다.`]); }
  else {
    /* 2. 수준 */
    const byMean = ok.filter(x=>x.s.mean!=null).sort((a,b)=>b.s.mean-a.s.mean), hi = byMean[0], lo = byMean[byMean.length-1];
    const allMean = meanOf(ok.map(x=>x.s.mean));
    let lv = `기간 평균은 <b>${esc(lo.n)} ${fmt(lo.s.mean,d)}</b> ~ <b>${esc(hi.n)} ${fmt(hi.s.mean,d)}</b> ${u}이고, 지점 평균의 평균은 ${fmt(allMean,d)} ${u}입니다.`;
    if(byMean.length>=3 && lo.s.mean>0 && hi.s.mean/lo.s.mean>=3) lv += ` 가장 높은 곳이 가장 낮은 곳의 <b>${(hi.s.mean/lo.s.mean).toFixed(1)}배</b>로 지점 간 차이가 큽니다.`;
    const gs = {}; ok.forEach(x=>{ if(x.j.text) gs[x.j.text]=(gs[x.j.text]||0)+1; });
    if(Object.keys(gs).length) lv += ` 최근 1년 평균으로 본 ${targetOf(item)!=null?"목표 달성":"생활환경기준 등급"}: ${Object.entries(gs).sort().map(([k,v])=>`${k} ${v}곳`).join(", ")}.`;
    if(ref){ const ex = ok.filter(x=>x.exceed!=null && x.exceed>=30).sort((a,b)=>b.exceed-a.exceed);
      lv += ex.length ? ` ${ref.label}(${fmt(ref.v,d)})을 넘는 달이 30% 이상인 지점: ${ex.slice(0,5).map(x=>`${esc(x.n)}(${x.exceed.toFixed(0)}%)`).join(", ")}${ex.length>5?` 외 ${ex.length-5}곳`:""}.` : ` 모든 지점에서 ${ref.label}(${fmt(ref.v,d)})을 넘는 달이 30% 미만입니다.`; }
    L.push(["수준", lv]);
    /* 3. 추세 */
    const up = ok.filter(x=>x.tw.k==="up"), dn = ok.filter(x=>x.tw.k==="dn"), flat = ok.filter(x=>!["up","dn"].includes(x.tw.k));
    const nm = a => a.slice(0,6).map(x=>`${esc(x.n)}${x.pctYr!=null?`(${sgnPct(x.pctYr,1)}/년)`:""}`).join(", ") + (a.length>6?` 외 ${a.length-6}곳`:"");
    let tr;
    if(ms.length < 24){
      const f3 = meanOf(ok.map(x=>meanOf(series(x.n,item).slice(0,3)))), l3 = meanOf(ok.map(x=>meanOf(series(x.n,item).slice(-3))));
      tr = `기간이 ${ms.length}개월이라 <b>추세 판단은 하지 않습니다</b>(이 기간의 오르내림은 계절 변화와 구분할 수 없음). 참고로 처음 3개월 평균 ${fmt(f3,d)} → 마지막 3개월 평균 ${fmt(l3,d)} ${u}(${sgnPct(pctChg(l3,f3))})입니다.`;
      L.push(["추세", tr]);
    } else {
    tr = `Mann-Kendall 검정(p&lt;${K.p}) 결과 <b class="up">뚜렷한 증가 ${up.length}곳</b>, <b class="dn">뚜렷한 감소 ${dn.length}곳</b>, 뚜렷한 추세 없음 ${flat.length}곳입니다.`;
    if(up.length) tr += ` 증가: ${nm(up.sort((a,b)=>(b.pctYr||0)-(a.pctYr||0)))}.`;
    if(dn.length) tr += ` 감소: ${nm(dn.sort((a,b)=>(a.pctYr||0)-(b.pctYr||0)))}.`;
    if(up.length > dn.length*2 && up.length>=2) tr += ` 선택 지점 전반에서 <b>악화 방향</b>이 우세합니다${N.up?` — ${N.up}이 있어 오염원 변화를 확인할 필요가 있습니다`:""}.`;
    else if(dn.length > up.length*2 && dn.length>=2) tr += ` 선택 지점 전반에서 <b>개선 방향</b>이 우세합니다(하수처리 고도화·오염원 관리 효과 가능성).`;
    else if(up.length && dn.length) tr += ` 지점마다 방향이 엇갈려, 수계 전체보다 <b>지점 주변 오염원</b> 차이로 보는 것이 자연스럽습니다.`;
    L.push(["추세", tr]);
    }
    /* 4. 최근 변화 */
    const rec = meanOf(ok.map(x=>x.rec)), bef = meanOf(ok.filter(x=>x.bef!=null).map(x=>x.bef)), ch = pctChg(rec, bef);
    if(rec!=null && bef!=null){
      const big = ok.filter(x=>x.chg!=null && Math.abs(x.chg)>=30).sort((a,b)=>Math.abs(b.chg)-Math.abs(a.chg));
      L.push(["최근 변화", `최근 1년(${mLong(ms[Math.max(0,ms.length-K.recent)])}~) 평균 ${fmt(rec,d)} ${u}은 직전 3년 평균 ${fmt(bef,d)} ${u}보다 <b>${sgnPct(ch)}</b> ${Math.abs(ch)<10?"(비슷한 수준)":ch>0?"높습니다":"낮습니다"}.`
        + (big.length ? ` 변화가 큰 지점(±30% 이상): ${big.slice(0,6).map(x=>`${esc(x.n)} ${sgnPct(x.chg)}`).join(", ")}.` : "")
        + (ms.at(-1) && +ms.at(-1).slice(5)<12 ? ` 최근 1년에 강우기가 몇 번 들어갔는지에 따라 값이 달라질 수 있습니다.` : "")]);
    }
    /* 5. 계절 */
    const climAll = Array.from({length:12}, (_,i)=>meanOf(ok.map(x=>x.clim[i])));
    const yrsMax = Math.max(...ok.map(x=>x.yrs));
    if(yrsMax>=2){
      const ord = climAll.map((v,i)=>[v,i+1]).filter(x=>x[0]!=null).sort((a,b)=>b[0]-a[0]);
      const w = meanOf(K.wetMonths.map(m=>climAll[m-1])), dd = meanOf(K.dryMonths.map(m=>climAll[m-1])), se = seasonText(w!=null&&dd?w/dd:null, item);
      const nW = ok.filter(x=>seasonText(x.ratio,item)?.k==="wet").length, nD = ok.filter(x=>seasonText(x.ratio,item)?.k==="dry").length;
      L.push(["계절", `월별 평균은 <b>${ord.slice(0,2).map(x=>x[1]+"월").join("·")}</b>에 가장 높고 ${ord.slice(-2).map(x=>x[1]+"월").join("·")}에 가장 낮습니다. ${se?se.t:""}${se&&se.why?` → ${se.why}${ro(se.why)} 볼 수 있습니다`:""}. (지점별: 강우기 높음 ${nW}곳 · 갈수기 높음 ${nD}곳)`]);
    }
    /* 6. 상·하류 */
    const sp = [];
    for(const rv of [...new Set(ok.map(x=>stByName[x.n].river))]){
      const rs = ok.filter(x=>stByName[x.n].river===rv && x.s.mean!=null); if(rs.length<3) continue;
      const a = rs[0], b = rs[rs.length-1], mx = rs.slice().sort((p,q)=>q.s.mean-p.s.mean)[0];
      sp.push(`${esc(rv)}: ${esc(a.n)} ${fmt(a.s.mean,d)} → ${esc(b.n)} ${fmt(b.s.mean,d)}(${sgnPct(pctChg(b.s.mean,a.s.mean))}), 최고 ${esc(mx.n)}`);
    }
    if(GRP!=="lab"){ sp.length = 0;      // 한강청 '하천'은 중권역이라 상·하류 비교 대신 지점 구분(하천수·산단하천·호소수)별 비교
      const kinds = {}; ok.forEach(x=>{ const kd = stByName[x.n].kind||"하천수"; if(x.s.mean!=null) (kinds[kd]=kinds[kd]||[]).push(x.s.mean); });
      const ks = Object.entries(kinds).map(([k,a])=>[k, meanOf(a), a.length]);
      if(ks.length>=2){ ks.sort((a,b)=>b[1]-a[1]); L.push(["지점 구분", `구분별 평균: ${ks.map(([k,v,n])=>`${esc(k)} ${fmt(v,d)}(${n}곳)`).join(", ")}${ks.at(-1)[1]>0?` — ${esc(ks[0][0])}${iga(ks[0][0])} ${esc(ks.at(-1)[0])}의 ${(ks[0][1]/ks.at(-1)[1]).toFixed(1)}배`:""}.`]); }
    }
    if(sp.length) L.push(["상·하류", sp.slice(0,4).join(" / ") + ". <span class=\"hint\">(목록 순서를 상류→하류로 가정 — 지점 순서가 다르면 해석이 달라집니다)</span>"]);
    /* 7. 항목 간 관계 */
    const mi = ms.map(m=>M.indexOf(m)), rel = [];
    for(const o of ITEMS){ if(o.code===item) continue; const x=[], y=[];
      for(const n of names){ const va=D.values[n][item], vb=D.values[n][o.code]; for(const i of mi) if(va[i]!=null && vb[i]!=null){ x.push(va[i]); y.push(vb[i]); } }
      const r = spearman(x,y); if(r.rho!=null && Math.abs(r.rho)>=K.corrStrong) rel.push([o.code, r.rho, r.n]); }
    rel.sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
    if(rel.length){ const t = rel.slice(0,3).map(([c,rho])=>`${c}(ρ=${rho.toFixed(2)})`).join(", ");
      const g1 = (ITEM_NOTE[item]||{}).grp, same = rel.filter(x=>(ITEM_NOTE[x[0]]||{}).grp===g1).length;
      let why = ""; const top = rel.slice(0,3).map(x=>x[0]);
      if(top.includes("SS") || (item==="SS" && top.some(c=>["T-P","COD","색도"].includes(c)))) why = " 입자(SS)와 함께 움직이므로 강우 유출·토사 영향이 겹치는 것으로 보입니다.";
      else if(top.some(c=>["BOD","TOC","COD","T-N","T-P"].includes(c)) && ["BOD","TOC","COD","T-N","T-P"].includes(item)) why = " 유기물·영양염이 함께 움직여 하·폐수 방류수나 생활·축산 오수처럼 같은 오염원의 영향을 의심할 수 있습니다.";
      else if(top.includes("색도") || item==="색도") why = " 색도와 함께 움직여 산단 방류수 같은 특정 배출원 영향을 확인할 필요가 있습니다.";
      L.push(["항목 관계", `${it.code}와(과) 함께 오르내리는 항목: ${t}.${why}${same?"":""} <span class="hint">(상관은 원인을 증명하지 않음)</span>`]);
    }
    /* 8. 자료 품질 */
    const qcN = D.qc.filter(q=>names.includes(q.st) && (!q.item || q.item===item) && (!q.m || ms.includes(q.m))).length;
    const thin = X.filter(x=>!x.enough).map(x=>x.n);
    L.push(["자료 품질", `자동 점검 표시 ${qcN}건(자료 점검 탭에서 확인)${thin.length?` · 측정 개월 수가 부족해 해석에서 뺀 지점: ${thin.slice(0,6).map(esc).join(", ")}${thin.length>6?` 외 ${thin.length-6}곳`:""}`:""}.`
      + (GRP!=="lab" ? " 수질측정망(API) 자료는 같은 달 여러 회차를 평균한 값이며, 측정 주기가 바뀐 해(2016년 전후 등)가 있어 오래된 자료와 비교할 때 주의가 필요합니다." : "")]);
  }
  L.push(["읽는 법", `이 해석은 통계 결과를 문장으로 옮긴 <b>자동 해석</b>입니다. '가능성'으로 적은 원인은 일반적인 수질 지식에 따른 것이므로, 보고서에 쓸 때는 유량·강우·오염원 현황(방류수, 산단, 축산 등)과 함께 확인하세요.`]);
  $("ipSum").innerHTML = `<dl class="ipdl">${L.map(([a,b])=>`<dt>${a}</dt><dd>${b}</dd>`).join("")}</dl>`;
  const plain = h => h.replace(/<[^>]+>/g,"").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&");
  cache.ipText = `[${it.name} 자료 해석] ${GRP_INFO.label} · ${names.length}개 지점 · ${rng}\n` + L.map(([a,b])=>`■ ${a}: ${plain(b)}`).join("\n");

  /* 차트: 연평균 추이 / 월별 평균 */
  const years = [...new Set(ms.map(m=>m.slice(0,4)))];
  const ann = years.map(y=>{ const per = ok.map(x=>meanOf(x.s.n ? series(x.n,item).filter((v,j)=>ms[j].startsWith(y)) : [])).filter(v=>v!=null);
    return {y, mean: meanOf(per), min: per.length?Math.min(...per):null, max: per.length?Math.max(...per):null, k: per.length, mon: new Set(ms.filter(m=>m.startsWith(y))).size}; });
  const ink2 = css("--ink-2"), line = css("--line"), lastPart = ann.length && ann.at(-1).mon<12;
  const cats = ann.map((a,i)=>a.y + (i===ann.length-1 && lastPart ? "*" : ""));
  const base = {animationDuration:300, textStyle:{fontFamily:css("--f-ui")}, tooltip:{trigger:"axis", backgroundColor:css("--panel"), borderColor:line, textStyle:{color:css("--ink")}},
    yAxis:{type:"value", name:u, nameTextStyle:{color:ink2}, axisLabel:{color:ink2, fontFamily:css("--f-num")}, splitLine:{lineStyle:{color:css("--line-2")}}}};
  const refLine = ref ? {silent:true, symbol:"none", lineStyle:{color:css("--warn"), type:"dashed"}, label:{formatter:`${ref.label} ${ref.v}`, color:css("--warn"), position:"insideEndTop", fontSize:11}, data:[{yAxis:ref.v}]} : undefined;
  chartOn("ipYear").setOption(Object.assign({}, base, {grid:{left:12,right:20,top:44,bottom:8,containLabel:true},
    legend:{top:0, right:10, textStyle:{color:ink2, fontSize:12}, data:["지점 평균","지점 범위(최소~최대)"]},
    xAxis:{type:"category", data:cats, axisLabel:{color:ink2, fontSize:12, hideOverlap:true}, axisLine:{lineStyle:{color:line}}},
    series:[
      {name:"__lo", type:"line", stack:"rng", data:ann.map(a=>a.min), lineStyle:{opacity:0}, symbol:"none", silent:true, tooltip:{show:false}},
      {name:"지점 범위(최소~최대)", type:"line", stack:"rng", data:ann.map(a=>a.max!=null&&a.min!=null?+(a.max-a.min).toFixed(6):null), lineStyle:{opacity:0}, symbol:"none", areaStyle:{color:css("--accent-soft")}, tooltip:{show:false}},
      {name:"지점 평균", type:"line", data:ann.map(a=>a.mean!=null?+a.mean.toFixed(d+1):null), connectNulls:true, symbolSize:6, lineStyle:{color:css("--g-main"), width:2.2}, itemStyle:{color:css("--g-main")}, markLine:refLine}]}), true);
  const clim = Array.from({length:12}, (_,i)=>meanOf(ok.map(x=>x.clim[i])));
  chartOn("ipSeason").setOption(Object.assign({}, base, {grid:{left:12,right:20,top:44,bottom:8,containLabel:true},
    xAxis:{type:"category", data:Array.from({length:12},(_,i)=>(i+1)+"월"), axisLabel:{color:ink2, fontSize:12, interval:0}, axisLine:{lineStyle:{color:line}}},
    series:[{name:"월별 평균", type:"bar", data:clim.map((v,i)=>({value:v!=null?+v.toFixed(d+1):null, itemStyle:{color: K.wetMonths.includes(i+1)?ipColor("wet"):K.dryMonths.includes(i+1)?ipColor("dry"):ipColor("mid")}})), markLine:refLine}]}), true);
  $("ipChartFoot").innerHTML = `<span>왼쪽: 해마다 지점별 평균을 낸 뒤 지점 평균(선)과 범위(띠)${lastPart?` · <b>${ann.at(-1).y}*</b>는 일부 달만 있는 해`:""}</span><span>오른쪽: 같은 달끼리 평균 — <b style="color:${ipColor("wet")}">■</b> 강우기(6~9월) · <b style="color:${ipColor("dry")}">■</b> 갈수기(12~3월) · <b style="color:${ipColor("mid")}">■</b> 그 밖의 달 (색은 오른쪽 위에서 바꿈)</span>`;

  /* 지점별 표 */
  let h = `<thead><tr><th class="l stc">지점</th><th class="l">하천</th><th>측정</th><th>기간 평균</th><th>최근 1년</th><th class="l">판정*</th><th class="l">추세</th><th>변화율</th><th>p</th><th>최고 달</th>${ref?`<th>기준 초과</th>`:""}<th class="l">한 줄 해석</th></tr></thead><tbody>`;
  const tsv = [["지점","하천","측정(개월)","기간 평균","최근 1년 평균","판정","추세","변화율(%/년)","p","최고 달",...(ref?["기준 초과(%)"]:[]),"한 줄 해석"]];
  for(const x of X){ const st = stByName[x.n], line1 = stationLine(x);
    h += `<tr class="${S.hl.has(x.n)?"hl":""}"><td class="l stc" data-st="${esc(x.n)}">${esc(x.n)}</td><td class="l rv">${esc(st.river)}</td><td class="num">${x.s.n}</td><td class="num">${fmt(x.s.mean,d)}</td><td class="num"><b>${fmt(x.rec,d)}</b></td><td class="l">${x.j.html||""}</td>
      <td class="l"><span class="tw tw-${x.tw.k}">${x.tw.t}</span></td><td class="num">${x.pctYr!=null&&x.r.ok?sgnPct(x.pctYr,1):""}</td><td class="num">${x.r.ok?pTxt(x.r.p):""}</td><td class="num">${x.peak?x.peak+"월":""}</td>${ref?`<td class="num">${x.exceed!=null?x.exceed.toFixed(0)+"%":""}</td>`:""}<td class="l ipline">${esc(line1)}</td></tr>`;
    tsv.push([x.n, st.river, x.s.n, x.s.mean!=null?+x.s.mean.toFixed(4):"", x.rec!=null?+x.rec.toFixed(4):"", x.j.text||"", x.tw.t, x.pctYr!=null?+x.pctYr.toFixed(2):"", x.r.ok?+x.r.p.toFixed(4):"", x.peak||"", ...(ref?[x.exceed!=null?+x.exceed.toFixed(1):""]:[]), line1]);
  }
  const tb = $("ipTbl"); tb.innerHTML = h + "</tbody>";
  tb.querySelectorAll("td[data-st]").forEach(x=>x.onclick=()=>toggleHl(x.dataset.st));
  $("ipTblSub").textContent = `${it.code} (${u}) · 변화율 = Sen 기울기 ÷ 중앙값${LONG()?"":" (기간이 2년 미만이라 표시 안 함)"} · * 최근 1년 평균으로 판정`;
  cache.ipTsv = tsv;

  /* 7개 항목 종합 */
  const IT = ITEMS.map(o=>{ const xs = names.map(n=>interpStation(n, o.code, ms)).filter(x=>x.enough);
    const up = xs.filter(x=>x.tw.k==="up").length, dn = xs.filter(x=>x.tw.k==="dn").length;
    const rec = meanOf(xs.map(x=>x.rec)), med = median(xs.filter(x=>x.pctYr!=null).map(x=>x.pctYr));
    const se = seasonText(meanOf(xs.map(x=>x.ratio).filter(v=>v!=null)), o.code);
    return {o, n:xs.length, up, dn, rec, med, j: judge(o.code, rec), se}; });
  const word = g => { const a = IT.filter(x=>g[1].includes(x.o.code) && x.n); if(!a.length) return null;
    const u2 = a.reduce((s,x)=>s+x.up,0), d2 = a.reduce((s,x)=>s+x.dn,0);
    return `${g[0]}(${a.map(x=>x.o.code).join("·")}): ` + (u2>d2*2 && u2>=2 ? "<b class=\"up\">악화 우세</b>" : d2>u2*2 && d2>=2 ? "<b class=\"dn\">개선 우세</b>" : u2||d2 ? "지점별로 엇갈림" : "뚜렷한 변화 없음") + ` (증가 ${u2} · 감소 ${d2} 지점-항목)`; };
  const gw = IP_GROUPS.map(word).filter(Boolean);
  let ih = `<p class="ipgrp">${gw.join("<br>")}</p><table class="dt"><thead><tr><th class="l">항목</th><th>해석 지점</th><th>최근 1년 평균</th><th class="l">판정</th><th>증가</th><th>감소</th><th>변화율 중앙값</th><th class="l">계절</th></tr></thead><tbody>`;
  for(const x of IT) ih += `<tr${x.o.code===item?' class="hl"':""}><td class="l"><button class="linkbtn" data-it="${x.o.code}">${esc(x.o.code)}</button></td><td class="num">${x.n}</td><td class="num">${x.rec!=null?fmt(x.rec,x.o.dec)+" "+esc(x.o.unit):"—"}</td><td class="l">${x.j.html||""}</td><td class="num up">${x.up||""}</td><td class="num dn">${x.dn||""}</td><td class="num">${x.med!=null&&LONG()?sgnPct(x.med,1)+"/년":""}</td><td class="l">${x.se?esc(x.se.t):""}</td></tr>`;
  $("ipItems").innerHTML = ih + "</tbody></table>";
  $("ipItems").querySelectorAll("button[data-it]").forEach(b=>b.onclick=()=>{ S.item=b.dataset.it; renderHeader(); refresh(); });
  /* MD 저장용 */
  const mdT = rows => rows.map((r,i)=>"| "+r.map(c=>String(c).replace(/\|/g,"/")).join(" | ")+" |"+(i===0?"\n|"+r.map(()=>"---").join("|")+"|":"")).join("\n");
  cache.ipMd = `# ${it.name} 자료 해석\n\n- 묶음: ${GRP_INFO.label}\n- 지점: ${names.length}개 (${names.join(", ")})\n- 기간: ${rng}\n- 만든 날: ${new Date().toLocaleString("ko-KR")} (대시보드 v${window.APP_VERSION||"?"}, 자료 ${D.generated})\n\n## 종합 해석\n\n`
    + L.map(([a,b])=>`- **${a}**: ${plain(b)}`).join("\n")
    + `\n\n## 항목 종합\n\n${gw.map(g=>"- "+plain(g)).join("\n")}\n\n${mdT([["항목","해석 지점","최근 1년 평균","판정","증가","감소","변화율 중앙값","계절"], ...IT.map(x=>[x.o.code, x.n, fmt(x.rec,x.o.dec)+" "+x.o.unit, x.j.text||"", x.up, x.dn, x.med!=null&&LONG()?sgnPct(x.med,1)+"/년":"", x.se?x.se.t:""])])}`
    + `\n\n## 지점별 해석 (${it.code})\n\n${mdT(tsv)}\n\n> 자동 해석입니다. 원인은 가능성 수준이며 유량·강우·오염원 자료로 확인이 필요합니다.\n`;
}
