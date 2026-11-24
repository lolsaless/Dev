/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   [40_화면/13_히트맵.js] 히트맵 화면
   하는 일 : 지점×월 색칸(측정값/평균 대비), 칸을 누르면 그 지점의 연도×1~12월 색칸(최근 연도가 맨 위)
   주요 이름: renderHeat, openHeatDetail, HEAT_ROW, HEAT_GRID, heatCellLabel
   이럴 때 고침: 히트맵 색·라벨·칸 높이(HEAT_ROW) — 두 히트맵이 같은 값을 써서 칸 크기가 같다
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
registerView({ id:"heat", label:"히트맵", kpi:true, item:true, render:()=>renderHeat(),
  bind(){
    $("hmDetailClose").onclick=()=>{ S.hmStation=null; $("hmDetail").hidden=true; };
    $("hmDetailStation").onchange=e=>openHeatDetail(e.target.value);
    $("hmDetailCopy").onclick=()=>copyText(tsvText(cache.hmTsv||[]));
    document.querySelectorAll("#hmMode button").forEach(b=>b.onclick=()=>{ S.heatMode=b.dataset.m; refresh(); });
  }});
/* 두 히트맵(지점×월, 연도×월)이 함께 쓰는 크기 — 한 줄 높이(px)와 그래프 여백 */
const HEAT_ROW = 28;
const HEAT_GRID = {left:12, right:20, top:30, bottom:58, containLabel:true};
const heatHeight = rows => rows*HEAT_ROW + HEAT_GRID.top + HEAT_GRID.bottom + 8;
/* 칸 안 숫자: 칸이 글자보다 좁으면 숨긴다(겹쳐서 읽을 수 없게 되는 것 방지). 숨겨도 마우스를 올리면 값이 보인다 */
function heatCellLabel(el, cols, sample){
  const cell = (el.clientWidth - 120) / Math.max(1, cols);
  return cell >= sample.length*6.6 + 6;
}
function heatVisual(vals, mode, dec){
  const v = vals.filter(Number.isFinite).sort((a,b)=>a-b);
  const q = p => v.length ? v[Math.min(v.length-1, Math.floor(p*(v.length-1)))] : 0;
  if(mode==="value"){ const min = v[0] ?? 0, max = q(.97) || 1;
    return {min, max, inRange:{color:CONC_STOPS.slice()}, text:[fmt(max,dec)+"+", fmt(min,dec)]}; }
  const m = Math.max(Math.abs(q(.03)), Math.abs(q(.97)), 10);
  return {min:-m, max:m, inRange:{color:[css("--q550"),css("--q250"),css("--mid"),css("--r400"),css("--r600")]}, text:["+"+Math.round(m)+"%", "-"+Math.round(m)+"%"]};
}
function heatLabelColor(vm, mode){
  const rng = (vm.max - vm.min) || 1, ink = css("--ink");
  return v => mode==="value" ? ((v-vm.min)/rng > 0.8 ? "#ffffff" : "#13201f") : (Math.abs(v)/vm.max > 0.6 ? "#ffffff" : ink);
}
function heatBase(vm){
  const panel = css("--panel"), ink = css("--ink");
  return {animation:false, textStyle:{fontFamily:css("--f-ui")}, grid:HEAT_GRID,
    tooltip:{confine:true, backgroundColor:panel, borderColor:css("--line"), textStyle:{color:ink,fontSize:12}},
    visualMap:{type:"continuous", ...vm, seriesIndex:0, calculable:false, orient:"horizontal", left:"center", bottom:6, itemHeight:220, itemWidth:10,
      textGap:8, textStyle:{color:css("--ink-2"), fontSize:12}, dimension:2}};
}
function renderHeat(){
  const it = itemOf(S.item), names = selectedOrdered(), ms = months();
  $("hmTitle").textContent = `${it.name} 지점 × 월`;
  $("hmSub").textContent = S.heatMode==="value" ? `측정값(${it.unit}) · 옅은 파랑 낮음 → 빨강 높음` : `지점 평균 대비 증감률 · 빨강=평균보다 높음, 파랑=낮음`;
  document.querySelectorAll("#hmMode button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.m===S.heatMode));
  const el = $("hmChart"); el.style.height = heatHeight(Math.max(1,names.length)) + "px";
  const ch = chartOn("hmChart"); ch.resize();
  const ys = names.slice().reverse(), ink = css("--ink"), panel = css("--panel");
  const data = [], vals = [];
  ys.forEach((n,yi)=>{ const v = series(n,S.item), s = stats(v);
    v.forEach((x,xi)=>{ if(x==null) return; const dev = s.mean? (x-s.mean)/s.mean*100 : 0, val = S.heatMode==="value"?x:dev;
      data.push({value:[xi, yi, val], raw:x, dev, q:qcTop(n, ms[xi], S.item), lq:loqText(n, ms[xi], S.item)}); vals.push(val); }); });
  const vm = heatVisual(vals, S.heatMode, it.dec);
  cache.hmValueVM = S.heatMode==="value" ? vm : null;
  const labColor = heatLabelColor(vm, S.heatMode);
  data.forEach(d=>{ d.label = {color: labColor(d.value[2])};
    if(d.q) d.itemStyle = {borderColor: d.q.type==="outlier"?css("--qc-out"):css("--warn"), borderWidth:2.5, borderType: d.q.type==="outlier"?"dotted":"dashed"}; });
  const dec = Math.min(it.dec,2), showLab = heatCellLabel(el, ms.length, fmt(vm.max, dec));
  const base = heatBase(vm);
  ch.setOption(Object.assign(base, {
    tooltip:Object.assign(base.tooltip, {formatter:p=>`<b>${esc(ys[p.value[1]])}</b> · ${mLong(ms[p.value[0]])}<br>${p.data.lq||fmt(p.data.raw,it.dec)} ${it.unit}<br><span style="color:${css("--ink-3")}">지점 평균 대비 ${p.data.dev>=0?"+":""}${p.data.dev.toFixed(0)}%</span>${p.data.q?`<br><span style="color:${css("--warn")}">${QC_LABEL[p.data.q.type]}: ${esc(p.data.q.note)}</span>`:""}`}),
    xAxis:{type:"category", data:ms.map(mLabel), position:"top", axisLine:{show:false}, axisTick:{show:false}, axisLabel:{color:css("--ink-2"), fontSize:12}},
    yAxis:{type:"category", triggerEvent:true, data:ys, axisLine:{show:false}, axisTick:{show:false}, axisLabel:{color:css("--ink-2"), fontSize:12, formatter:n=>S.hl.has(n)?`{b|${n}}`:n, rich:{b:{fontWeight:700,color:ink,fontSize:12}}}},
    series:[{type:"heatmap", data, itemStyle:{borderColor:panel, borderWidth:2, borderRadius:3},
      label:{show:showLab, fontSize:11, fontFamily:css("--f-num"), formatter:p=>p.data.lq||fmt(p.data.raw, dec)},
      emphasis:{itemStyle:{borderColor:ink, borderWidth:1.5}}}]
  }), true);
  $("hmFootNote").textContent = showLab ? "칸이나 지점명을 누르면 그 지점의 연도별 1~12월 히트맵이 열립니다."
    : "기간이 길어 칸 안 숫자는 숨겼습니다(마우스를 올리면 값 표시). 칸이나 지점명을 누르면 그 지점의 연도별 1~12월 히트맵이 열립니다.";
  ch.off("click");
  ch.on("click",p=>{
    if(p.componentType==="yAxis") openHeatDetail(p.value,true);
    else if(p.seriesType==="heatmap") openHeatDetail(ys[p.value[1]],true);
  });
  if(names.includes(S.hmStation)) openHeatDetail(S.hmStation);
  else $("hmDetail").hidden=true;
}

/* 지점 하나의 연도 × 1~12월 히트맵. 보유 자료 전체 중 값이 있는 해만, 최근 연도가 맨 위(내림차순) */
function openHeatDetail(station, scroll=false){
  const names=selectedOrdered();
  if(!names.includes(station)) return;
  S.hmStation=station;
  const it=itemOf(S.item), values=D.values[station]?.[S.item]||[], relative=S.heatMode==="dev";
  const index=new Map(M.map((m,i)=>[m,i]));
  const monthsOf=Array.from({length:12},(_,i)=>String(i+1).padStart(2,"0"));
  const has=y=>monthsOf.some(mm=>Number.isFinite(values[index.get(`${y}-${mm}`)]));
  const yearsAll=[...new Set(M.map(m=>m.slice(0,4)))].filter(has);   // 오래된 해 → 최근 해
  const valid=values.filter(Number.isFinite), mean=stats(valid).mean;
  $("hmDetail").hidden=false;
  $("hmDetailStation").innerHTML=names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("");
  $("hmDetailStation").value=station;
  $("hmDetailTitle").textContent=`${station} · ${it.name} · 연도 × 월`;
  $("hmDetailInfo").textContent=yearsAll.length ? `${yearsAll.at(-1)}년(위) → ${yearsAll[0]}년(아래) · ${relative?"전체 관측 평균 대비(%)":it.unit} · 회색 칸은 미측정` : "측정값이 없습니다";
  const el=$("hmDetailChart");
  el.style.height=heatHeight(Math.max(1,yearsAll.length))+"px";
  const ch=chartOn("hmDetailChart"); ch.resize();
  /* y축: echarts는 첫 항목을 맨 아래에 두므로 오래된 해부터 넣으면 최근 해가 맨 위가 된다 */
  const ys=yearsAll, data=[], blank=[], vals=[];
  ys.forEach((y,yi)=>monthsOf.forEach((mm,xi)=>{
    const m=`${y}-${mm}`, v=values[index.get(m)];
    if(!Number.isFinite(v)){ blank.push([xi,yi,0]); return; }
    const dev=mean ? 100*(v-mean)/mean : 0;
    data.push({value:[xi,yi,relative?dev:v], raw:v, dev, m, q:qcTop(station,m,S.item), lq:loqText(station,m,S.item)});
    vals.push(relative?dev:v);
  }));
  /* 측정값 색은 위 지점×월 히트맵과 같은 눈금을 써서 두 그림의 색을 그대로 비교할 수 있게 함 */
  const vm=(!relative && cache.hmValueVM) ? cache.hmValueVM : heatVisual(vals, relative?"dev":"value", it.dec);
  const labColor=heatLabelColor(vm, relative?"dev":"value"), ink=css("--ink"), panel=css("--panel");
  data.forEach(d=>{ d.label={color:labColor(d.value[2])};
    if(d.q) d.itemStyle={borderColor:d.q.type==="outlier"?css("--qc-out"):css("--warn"), borderWidth:2.5, borderType:d.q.type==="outlier"?"dotted":"dashed"}; });
  const dec=Math.min(it.dec,2), sample=relative?"+100%":fmt(vm.max,dec);
  const base=heatBase(vm);
  ch.setOption(Object.assign(base, {
    tooltip:Object.assign(base.tooltip, {formatter:p=>p.seriesIndex===1 ? `${ys[p.value[1]]}년 ${p.value[0]+1}월 · 미측정` :
      `<b>${esc(station)}</b> · ${mLong(p.data.m)}<br>${p.data.lq||fmt(p.data.raw,it.dec)} ${it.unit}<br><span style="color:${css("--ink-3")}">전체 관측 평균 대비 ${p.data.dev>=0?"+":""}${p.data.dev.toFixed(0)}%</span>${p.data.q?`<br><span style="color:${css("--warn")}">${QC_LABEL[p.data.q.type]}: ${esc(p.data.q.note)}</span>`:""}`}),
    xAxis:{type:"category", data:monthsOf.map(m=>(+m)+"월"), position:"top", axisLine:{show:false}, axisTick:{show:false}, axisLabel:{color:css("--ink-2"), fontSize:12}},
    yAxis:{type:"category", data:ys.map(y=>y+"년"), axisLine:{show:false}, axisTick:{show:false}, axisLabel:{color:css("--ink-2"), fontSize:12}},
    series:[{type:"heatmap", data, itemStyle:{borderColor:panel, borderWidth:2, borderRadius:3},
        label:{show:heatCellLabel(el,12,sample), fontSize:11, fontFamily:css("--f-num"), formatter:p=>relative ? (p.data.dev>=0?"+":"")+Math.round(p.data.dev)+"%" : (p.data.lq||fmt(p.data.raw,dec))},
        emphasis:{itemStyle:{borderColor:ink, borderWidth:1.5}}},
      {type:"heatmap", data:blank, silent:false, itemStyle:{color:css("--panel-2"), borderColor:panel, borderWidth:2, borderRadius:3},
        label:{show:false}, emphasis:{disabled:true}}]
  }), true);
  /* 표 복사(엑셀 붙여넣기): 최근 연도부터 */
  cache.hmTsv=[["연도",...monthsOf.map(m=>(+m)+"월")], ...ys.slice().reverse().map(y=>[y, ...monthsOf.map(mm=>{ const m=`${y}-${mm}`, v=values[index.get(m)];
    return Number.isFinite(v) ? (loqText(station,m,S.item)||v) : ""; })])];
  if(scroll) $("hmDetail").scrollIntoView({block:"start"});
}
