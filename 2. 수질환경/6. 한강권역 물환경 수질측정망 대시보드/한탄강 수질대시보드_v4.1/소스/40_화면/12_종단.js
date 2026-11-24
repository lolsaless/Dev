/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   [40_화면/12_종단.js] 상·하류 종단 화면
   하는 일 : 하천별 상류→하류 그래프, 월 켜기/끄기, 구간별 변화표(그 중권역의 모든 지류 지점)
   주요 이름: renderProf, profileRoutes, profTableRows, renderProfTable, PF_COLS_AUTO_MONTHS, PF_UP_PCT
   이럴 때 고침: 종단 그래프·구간 변화 기준(30%)·표 열(연평균/월별) 자동 전환 기준
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
registerView({ id:"prof", label:"상·하류 종단", kpi:true, item:true, render:()=>renderProf(),
  bind(){
    $("pfCopy").onclick=()=>copyText(tsvText(cache.pfTsv||[]));
    document.querySelectorAll("#pfCols button").forEach(b=>b.onclick=()=>{ S.pfCols=b.dataset.c; persist(); renderProfTable(); });
  }});
/* 구간별 변화 표: 기간이 이 개월 수를 넘으면 '자동'일 때 월별 대신 연평균 열로 줄인다 */
const PF_COLS_AUTO_MONTHS = 24;
const PF_UP_PCT = 30;   // 상류 대비 이 % 이상 증가하면 ▲
/* ═════════ 상·하류 종단 ═════════ */
function renderProf(){
  const it = itemOf(S.item), ms = months();
  const seg = $("pfRivers");
  seg.innerHTML = RIVERS().map(r=>`<button data-r="${esc(r)}" aria-pressed="${r===S.profRiver}">${esc(r)} ${ST.filter(s=>s.river===r).length}</button>`).join("");
  seg.querySelectorAll("button").forEach(b=>b.onclick=()=>{ S.profRiver=b.dataset.r; S.profBranch=""; refresh(); });
  const groups = profileBranches(S.profRiver);
  const branch = groups.find(g=>g.name===S.profBranch) || groups[0];
  const path = [];
  for(let g=branch; g && !path.includes(g.name); g=groups.find(other=>other.name===g.next)) path.push(g.name);
  const chain = profChain(S.profRiver);
  $("pfTitle").textContent = `${S.profRiver} ${it.name} 상류 → 하류`;
  $("pfSub").textContent = `${chain.length}개 지점 · ${profCustom(S.profRiver)?path.join(" → "):"지점코드 순서"} · 단위 ${it.unit} · 점 색·크기 = 농도(옅은 파랑 낮음 → 빨강 높음)`;
  const routes=profileRoutes(groups,chain);
  const combined=routes.length>1 && S.profCompare!==false;
  const plotted=combined ? routes : [{name:branch.name,stations:chain}];
  const stations=profileColumns(plotted), cats=stations.map(st=>st.name);
  const indices=new Map(cats.map((name,index)=>[name,index]));
  const records=Object.fromEntries(stations.map(st=>{
    const values=series(st.name,S.item);
    return [st.name,{values,stats:stats(values)}];
  }));
  const ink2=css("--ink-2"), ink3=css("--ink-3"), panel=css("--panel");
  const log=S.opt.scale==="log";
  const shown=value=>Number.isFinite(value) && (!log || value>0);
  let last=ms.length-1;
  while(last>=0 && !stations.some(st=>shown(records[st.name].values[last]))) last--;
  const focus=ms.includes(S.profMonth)?ms.indexOf(S.profMonth):last;
  const values=stations.flatMap(st=>records[st.name].values.filter(shown));
  const range=concRange(values);
  const cpt=v=>concT(v,range.lo,range.hi);
  const monthly=plotted.flatMap(route=>ms.flatMap((_,i)=>i!==focus && S.profBackground!==false ?
    [route.stations.map(st=>[indices.get(st.name),records[st.name].values[i]])] : []));
  const background=[];
  for(const points of monthly){
    for(let j=1;j<points.length;j++){
      const [a,b]=[points[j-1],points[j]];
      if(shown(a[1]) && shown(b[1])) background.push([...a,...b]);
    }
  }
  const ser=[];
  if(background.length) ser.push({name:"다른 월",type:"custom",silent:true,z:1,data:background,
    encode:{x:[0,2],y:[1,3]},renderItem:(params,api)=>{
      const a=api.coord([api.value(0),api.value(1)]), b=api.coord([api.value(2),api.value(3)]);
      return {type:"line",shape:{x1:a[0],y1:a[1],x2:b[0],y2:b[1]},style:{stroke:ink3,opacity:Math.min(.09,3/ms.length),lineWidth:1}};
    }});
  const routeColors=plotted.map((_,i)=>css("--s"+(i%8+1)));
  const routeData=(route,get)=>route.stations.map(st=>{
    const value=get(records[st.name]);
    return {value:[indices.get(st.name),shown(value)?value:null],
      symbolSize:shown(value)?concSize(cpt(value),6,15):0,itemStyle:{color:shown(value)?concColor(cpt(value)):panel}};
  });
  plotted.forEach((route,i)=>{
    const label=combined?route.name+" · ":"", color=combined?routeColors[i]:css("--g-main");
    if(focus>=0) ser.push({name:label+mLong(ms[focus]),type:"line",z:5,data:routeData(route,r=>r.values[focus]),
      connectNulls:false,lineStyle:{width:2.6,color},itemStyle:{color}});
    ser.push({name:label+"기간 평균",type:"line",z:6,data:routeData(route,r=>r.stats.mean),
      connectNulls:false,symbol:"rect",lineStyle:{width:2,type:"dashed",color:combined?color:css("--ink")},itemStyle:{color}});
  });
  const highlights=stations.flatMap(st=>{
    const {values,stats}=records[st.name], max=values.indexOf(stats.max), min=values.indexOf(stats.min);
    return values.flatMap((v,i)=>{
      if(!shown(v)) return [];
      const flags=[i===max?"최대":null,i===min?"최소":null,qcAt(st.name,ms[i],S.item).some(q=>q.type==="outlier")?"이상값 의심":null].filter(Boolean);
      return flags.length ? [{value:[indices.get(st.name),v],month:ms[i],flags,itemStyle:{
        color:css(flags.includes("이상값 의심")?"--qc-out":flags.includes("최대")?"--above":"--below")}}] : [];
    });
  });
  ser.push({name:"최대·최소·이상값 의심",type:"scatter",z:8,symbol:"diamond",symbolSize:9,data:highlights});
  let limW=0;   // 기준선 라벨이 들어갈 오른쪽 여백
  if(S.opt.limits){
    const t=targetOf(S.item), max=values.reduce((max,v)=>Math.max(max,v),0);
    const unique=new Map((D.limits[S.item]||[]).filter(l=>shown(l.max)&&l.max<=max*1.15).map(l=>[l.max,l.code]));
    const lines=[...unique].map(([v,code])=>({yAxis:v,text:`${code} ≤${v}`}));
    if(shown(t)) lines.push({yAxis:t,text:`목표 ${t}`,lineStyle:{color:css("--g-target"),type:"solid"},label:{color:css("--g-target"),fontWeight:600}});
    const ml=limitMarkLines(lines,max); limW=ml.width;
    if(lines.length) ser.push({name:"__limits",type:"line",data:[],silent:true,markLine:{silent:true,symbol:"none",
      lineStyle:{color:css("--g-limit"),type:"dotted"},label:{position:"end",distance:6,color:css("--g-limit"),fontSize:11},data:ml}});
  }
  const title=`${S.profRiver} ${it.name} ${combined?"합류 농도 비교":"상류 → 하류"}`;
  $("pfTitle").textContent=title;
  $("pfSub").textContent=combined ? `${plotted.length}개 흐름 · 공유 지점에서 같은 값으로 만남 · 단위 ${it.unit} · 가로 간격은 배치용` :
    `${chain.length}개 지점 · ${profCustom(S.profRiver)?path.join(" → "):"지점코드 순서"} · 단위 ${it.unit}`;
  chartOn("pfChart").setOption({animation:false,textStyle:{fontFamily:css("--f-ui")},
    grid:{left:12,right:Math.max(26,limW+14),top:35,bottom:12,containLabel:true},
    tooltip:{trigger:"item",confine:true,backgroundColor:panel,borderColor:css("--line"),textStyle:{color:css("--ink"),fontSize:12},
      formatter:p=>`${esc(cats[p.value[0]])} · ${p.data.flags ? mLong(p.data.month)+" · "+p.data.flags.join("·") : esc(p.seriesName)}<br>${fmt(p.value[1],it.dec)} ${it.unit}`},
    xAxis:{type:"category",data:cats,axisLabel:{color:ink2,fontSize:cats.length>30?11:12,rotate:cats.length>20?60:cats.length>7?30:0,
      /* 지점 하나당 폭이 글자 높이보다 좁으면 겹치는 이름은 건너뜀(마우스를 올리면 지점명 표시) */
      interval:($("pfChart").clientWidth-120)/Math.max(1,cats.length)>=15?0:"auto",hideOverlap:true},axisTick:{show:false}},
    yAxis:{type:log?"log":"value",name:it.unit,nameTextStyle:{color:ink2},splitLine:{lineStyle:{color:css("--line-2")}},axisLabel:{color:ink2}},
    series:ser},true);
  const lg = $("pfLegend");
  lg.innerHTML = `${routes.length>1?'<label><input id="pfCompare" type="checkbox" '+(combined?"checked":"")+'> 합류하는 흐름 함께 보기</label>':""}
    ${combined?plotted.map((r,i)=>`<span><i class="key" style="background:${routeColors[i]};height:3px"></i>${esc(r.name)}</span>`).join(""):""}
    <label>강조 월 <select id="pfMonth"><option value="">최근 관측월</option>${ms.map(m=>`<option value="${m}" ${m===S.profMonth?"selected":""}>${mLong(m)}</option>`).join("")}</select></label>
    <label><input type="checkbox" id="pfBg" ${S.profBackground!==false?"checked":""}> 나머지 월 흐리게 표시</label>
    <span>■ 기간 평균 · ◆ 최대(빨강) · 최소(파랑) · 이상값 의심(자주)</span>`;
  if($("pfCompare")) $("pfCompare").onchange=e=>{ S.profCompare=e.target.checked; refresh(); };
  $("pfMonth").onchange = e=>{ S.profMonth=e.target.value; refresh(); };
  $("pfBg").onchange = e=>{ S.profBackground=e.target.checked; refresh(); };
  renderProfTable();
}

/* ── 구간별 변화 표 ───────────────────────────────────────────────
   그 중권역(예: 한탄강)의 모든 지류 지점을 흐름 그룹 순서대로 한 표에 보여 준다(흐름을 따로 고르지 않음).
   '상류 대비'는 그 지점이 들어 있는 흐름에서 바로 위 지점과 비교한다.
   여러 흐름이 만나는 지점은 첫 흐름의 바로 위 지점과 비교하고, 나머지 상류는 '합류'로 적는다.
   열: 자동(기간 ≤ PF_COLS_AUTO_MONTHS개월이면 월별, 넘으면 연평균) · 연평균 · 월별 */
function profTableRows(river){
  const groups = profileBranches(river), by = stationCodes(), rows = [], at = new Map();
  for(const g of groups){
    const path = branchPath(groups, g.name).filter(code=>by[code]);
    path.forEach((code,i)=>{
      const up = i>0 ? by[path[i-1]] : null;
      if(at.has(code)){
        const r = at.get(code);
        if(up && !r.up) r.up = up;
        else if(up && up!==r.up && !r.joins.includes(up)) r.joins.push(up);
        return;
      }
      const owner = groups.find(x=>x.codes.includes(code)) || g;
      const r = {st:by[code], flow:owner.name, up, joins:[]};
      at.set(code, r); rows.push(r);
    });
  }
  for(const s of stationsInRiver(river)) if(!at.has(stationCode(s))) rows.push({st:s, flow:"종단 미포함", up:null, joins:[]});
  return rows;
}
function renderProfTable(){
  const it = itemOf(S.item), ms = months(), rows = profTableRows(S.profRiver);
  const mode = S.pfCols==="year" || S.pfCols==="month" ? S.pfCols : (ms.length>PF_COLS_AUTO_MONTHS ? "year" : "month");
  document.querySelectorAll("#pfCols button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.c===(S.pfCols||"auto")));
  const custom = profCustom(S.profRiver), flows = new Set(rows.map(r=>r.flow)).size;
  /* 열: 월별이면 측정월 그대로, 연평균이면 해마다 관측값 평균(n개월) */
  const years = [...new Set(ms.map(m=>m.slice(0,4)))];
  const cols = mode==="month" ? ms.map((m,i)=>({label:mLabel(m), key:m, idx:[i]}))
    : years.map(y=>{ const idx = ms.flatMap((m,i)=>m.startsWith(y)?[i]:[]); return {label:y+(idx.length<12?"*":""), key:y, idx}; });
  const meanAt = (v,idx)=>{ const x = idx.map(i=>v[i]).filter(Number.isFinite); return x.length ? {v:x.reduce((a,b)=>a+b,0)/x.length, n:x.length} : {v:null, n:0}; };
  const means = new Map(rows.map(r=>[r.st.name, stats(series(r.st.name,S.item)).mean]));
  $("pfTblTitle").textContent = `구간별 변화 · ${S.profRiver} 전체 ${rows.length}개 지점`;
  $("pfTblSub").textContent = `상류 대비 = 같은 흐름에서 바로 위 지점과 비교한 기간 평균 변화 · ▲ ${PF_UP_PCT}% 이상 증가`
    + (custom ? ` · 흐름 ${flows}개` : " · 지점코드 순서")
    + ` · 열: ${mode==="month" ? `월별 ${ms.length}개월` : `연평균 ${cols.length}개 연도(*는 일부 달만 있는 해)`}`;
  let h = `<thead><tr><th class="l stc">지점</th>${custom?'<th class="l">흐름</th>':""}<th class="l">비교 상류</th><th>기간 평균</th><th>상류 대비</th><th>변화율</th>`
    + cols.map(c=>`<th${mode==="year"?` title="${c.key}년 ${c.idx.length}개월"`:""}>${c.label}</th>`).join("") + `</tr></thead><tbody>`;
  const tsv = [["지점",...(custom?["흐름"]:[]),"비교 상류","기간 평균","상류 대비","변화율(%)",...cols.map(c=>mode==="month"?c.key:c.label+"년 평균")]];
  for(const r of rows){
    const sv = series(r.st.name,S.item), st = stats(sv), prev = r.up ? means.get(r.up.name) : null;
    const d = (st.n && prev!=null) ? st.mean-prev : null, rate = d!=null && prev ? d/prev*100 : null, big = rate!=null && rate>=PF_UP_PCT;
    const upText = r.up ? r.up.name + (r.joins.length ? ` (합류: ${r.joins.map(x=>x.name).join(", ")})` : "") : "";
    const vals = cols.map(c=>mode==="month" ? {v:Number.isFinite(sv[c.idx[0]])?sv[c.idx[0]]:null, n:1} : meanAt(sv,c.idx));
    const nums = vals.map(x=>x.v).filter(Number.isFinite), hi = Math.max(...nums), lo = Math.min(...nums);
    const cells = mode==="month"
      ? sv.map((v,k)=>{ const key = v!=null && (v===hi || v===lo || qcAt(r.st.name,ms[k],S.item).some(q=>q.type==="outlier"));
          return cellHtml(r.st.name,ms[k],S.item,v,st,it.dec).replace('<td class="num','<td class="num '+(key?"pf-key":"pf-muted")); }).join("")
      : vals.map((x,k)=>x.v==null ? '<td class="num"></td>' :
          `<td class="num ${nums.length>1 && x.v===hi?"up pf-key":nums.length>1 && x.v===lo?"dn pf-key":""}" title="${cols[k].key}년 ${x.n}개월 평균">${fmt(x.v,it.dec)}</td>`).join("");
    h += `<tr class="${S.hl.has(r.st.name)?"hl":""}"><td class="l stc" data-st="${esc(r.st.name)}" title="${esc(r.st.addr||"")}">${esc(r.st.name)}</td>${custom?`<td class="l pf-flow">${esc(r.flow)}</td>`:""}`
      + `<td class="l pf-up" title="${esc(upText)}">${esc(r.up?r.up.name:"—")}${r.joins.length?' <span class="pf-join">합류</span>':""}</td>`
      + `<td class="num stat"><b>${fmt(st.mean,it.dec)}</b></td><td class="num ${d>0?"up":d<0?"dn":""}">${d==null?"":(d>0?"+":"")+fmt(d,it.dec)}</td>`
      + `<td class="num ${big?"up":""}">${rate==null?"":(Math.round(rate)>0?"+":"")+(Math.round(rate)||0)+"%"}${big?' <span class="g">▲</span>':""}</td>${cells}</tr>`;
    tsv.push([r.st.name, ...(custom?[r.flow]:[]), upText, st.mean!=null?+st.mean.toFixed(4):"", d!=null?+d.toFixed(4):"", rate!=null?+rate.toFixed(1):"", ...vals.map(x=>x.v!=null?+x.v.toFixed(4):"")]);
  }
  const tb = $("pfTbl"); tb.innerHTML = h + "</tbody>";
  tb.querySelectorAll("td[data-st]").forEach(x=>x.onclick=()=>toggleHl(x.dataset.st));
  cache.pfTsv = tsv;
}

// 비교할 흐름은 공유 지점이 있는 실제 경로다. 하류 구간만 반복하는 그룹은 제외한다.
function profileRoutes(groups,chain){
  const by=stationCodes();
  const candidates=groups.map(g=>({name:g.name,codes:branchPath(groups,g.name).filter(code=>by[code])}));
  const routes=candidates.filter((route,i)=>route.codes.length>1 && !candidates.some((other,j)=>
    i!==j && (other.codes.length>route.codes.length || (other.codes.length===route.codes.length && j<i)) &&
    route.codes.every((code,k)=>code===other.codes[other.codes.length-route.codes.length+k])));
  const active=new Set(chain.map(stationCode));
  return routes.filter(route=>route.codes.some(code=>active.has(code)) && routes.some(other=>other!==route &&
    route.codes.some((code,i)=>i>0 && other.codes.includes(code) && other.codes[other.codes.indexOf(code)-1]!==route.codes[i-1])))
    .map(route=>({name:route.name,stations:route.codes.map(code=>by[code])}));
}

// 같은 지점에는 한 x좌표만 준다. 공유 지점은 모든 상류 지점보다 오른쪽에 둔다.
function profileColumns(routes){
  const depths=new Map();
  routes.forEach(route=>route.stations.forEach((station,i)=>{
    const depth=route.stations.length-1-i;
    depths.set(station,Math.max(depths.get(station)??0,depth));
  }));
  return [...depths.keys()].sort((a,b)=>depths.get(b)-depths.get(a));
}
