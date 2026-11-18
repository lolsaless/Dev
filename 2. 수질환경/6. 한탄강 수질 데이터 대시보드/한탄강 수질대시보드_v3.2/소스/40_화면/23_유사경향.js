/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   [40_화면/23_유사경향.js] 비슷한 경향 지점 찾기(시계열 화면 아래 카드)
   하는 일 : 지점끼리 월별 값의 순위상관(Spearman ρ)을 계산해 ① 비슷하게 움직이는 지점 묶음(평균 연결 군집) ② 기준 지점과 비슷한 지점 순위를 보여 주고, 누르면 그 지점만 선택한다
   주요 이름: SIM_CFG, simMatrix, simClusters, renderSim, simSelect
   이럴 때 고침: 최소 겹치는 개월 수·기본 기준 ρ(SIM_CFG), 묶음 표시 개수
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const SIM_CFG = { minOverlap: 12, maxGroups: 8, topRef: 12 };
/* 계절 제거: 지점별 같은 달 평균을 뺀 값(이상치 = 그 달 평소보다 높고 낮음) */
function simSeries(n, item, ms, mode){
  const v = series(n, item);
  if(mode!=="anom") return v;
  const mm = Array.from({length:12}, (_,k)=>{ const a = v.filter((x,j)=>x!=null && +ms[j].slice(5)===k+1); return a.length ? a.reduce((p,q)=>p+q,0)/a.length : null; });
  return v.map((x,j)=> x==null || mm[+ms[j].slice(5)-1]==null ? null : x - mm[+ms[j].slice(5)-1]);
}
function simMatrix(names, item, ms, mode){
  const need = Math.min(SIM_CFG.minOverlap, Math.max(6, Math.ceil(ms.length*0.6)));
  const ser = names.map(n=>simSeries(n, item, ms, mode)), N = names.length;
  const R = Array.from({length:N}, ()=>new Array(N).fill(null)), Nn = Array.from({length:N}, ()=>new Array(N).fill(0));
  for(let a=0;a<N;a++){ R[a][a] = 1;
    for(let b=a+1;b<N;b++){ const x=[], y=[];
      for(let j=0;j<ms.length;j++){ const p = ser[a][j], q = ser[b][j]; if(p!=null && q!=null){ x.push(p); y.push(q); } }
      if(x.length >= need){ const r = spearman(x, y).rho; R[a][b] = R[b][a] = r; Nn[a][b] = Nn[b][a] = x.length; } } }
  return {R, Nn, need};
}
/* 평균 연결 군집: 묶음 사이 평균 ρ가 기준 이상인 동안 합친다(겹치는 달이 모자란 쌍은 '다름'으로 봄) */
function simClusters(R, thr){
  let C = R.map((_,i)=>[i]);
  const avg = (A,B)=>{ let s=0, k=0; for(const i of A) for(const j of B){ s += R[i][j]==null ? -1 : R[i][j]; k++; } return s/k; };
  for(;;){ let best = null;
    for(let i=0;i<C.length;i++) for(let j=i+1;j<C.length;j++){ const s = avg(C[i],C[j]); if(s>=thr && (!best || s>best[2])) best = [i,j,s]; }
    if(!best) break;
    C[best[0]] = C[best[0]].concat(C[best[1]]); C.splice(best[1],1); }
  return C.filter(c=>c.length>1).map(c=>{ let s=0,k=0; for(const i of c) for(const j of c) if(i<j && R[i][j]!=null){ s+=R[i][j]; k++; } return {idx:c, mean:k?s/k:null}; })
    .sort((a,b)=>b.idx.length-a.idx.length || b.mean-a.mean);
}
function simSelect(ns, label){
  S.simPrev = [...S.sel];
  S.sel = new Set(ns); reassignColors(ns, false); refresh();
  toast(`${label}: ${ns.length}개 지점만 표시`);
}
function renderSim(){
  if(S.view!=="ts" || !$("simCard")) return;
  const so = S.sim = Object.assign({thr:0.7, scope:"sel", mode:"raw", ref:null}, S.sim||{});
  $("simThr").value = so.thr; $("simScope").value = so.scope; $("simMode").value = so.mode;
  $("simUndo").hidden = !S.simPrev;
  const ms = months(), it = itemOf(S.item);
  const names = so.scope==="all" ? ST.map(s=>s.name) : selectedOrdered();
  if(names.length < 2){ $("simSub").textContent = "지점을 2개 이상 선택하세요."; $("simGroups").innerHTML = ""; $("simList").innerHTML = ""; $("simRef").innerHTML = ""; return; }
  const key = [S.item, S.from, S.to, so.scope, so.mode, names.join("|")].join("§");
  if(cache.simKey !== key){ cache.sim = simMatrix(names, S.item, ms, so.mode); cache.simKey = key; cache.simNames = names; }
  const {R, Nn, need} = cache.sim;
  $("simSub").textContent = `${it.code} · ${mLong(ms[0])}~${mLong(ms[ms.length-1])} · ${so.scope==="all"?"묶음 전체":"선택한"} ${names.length}개 지점 · ${so.mode==="anom"?"계절 제거 후":"월별 값"} Spearman ρ · 같은 달 ${need}개월 이상 겹친 쌍만`;
  /* ① 묶음 */
  const C = simClusters(R, so.thr).slice(0, SIM_CFG.maxGroups);
  $("simGroups").innerHTML = C.length ? C.map((c,k)=>{ const ns = c.idx.map(i=>names[i]);
      return `<div class="simg"><span class="simk">묶음 ${k+1}</span><span class="simn">${ns.length}개 · 평균 ρ ${c.mean==null?"-":c.mean.toFixed(2)}</span>
        <span class="simm">${ns.map(esc).join(", ")}</span><button class="chip" data-simg="${k}">이 지점만 보기</button></div>`; }).join("")
    : `<p class="hint">ρ ≥ ${so.thr} 로 함께 움직이는 지점 묶음이 없습니다. 기준 ρ를 낮추거나 범위를 '묶음 전체'로 넓혀 보세요.</p>`;
  $("simGroups").querySelectorAll("[data-simg]").forEach(b=>b.onclick=()=>simSelect(C[+b.dataset.simg].idx.map(i=>names[i]), `비슷한 경향 묶음 ${+b.dataset.simg+1}`));
  /* ② 기준 지점과 비슷한 지점 */
  if(!names.includes(so.ref)) so.ref = names.find(n=>S.hl.has(n)) || selectedOrdered().find(n=>names.includes(n)) || names[0];
  $("simRef").innerHTML = names.map(n=>`<option ${n===so.ref?"selected":""}>${esc(n)}</option>`).join("");
  const a = names.indexOf(so.ref);
  const top = names.map((n,i)=>({n, r:R[a][i], k:Nn[a][i]})).filter(x=>x.n!==so.ref && x.r!=null).sort((p,q)=>q.r-p.r).slice(0, SIM_CFG.topRef);
  const good = top.filter(x=>x.r>=so.thr);
  $("simList").innerHTML = top.length ? `<table class="dt simt"><thead><tr><th class="l">지점</th><th class="l">하천</th><th>ρ</th><th>겹친 달</th><th class="l">비슷한 정도</th></tr></thead><tbody>${top.map(x=>`<tr class="${x.r>=so.thr?"simok":""}"><td class="l">${esc(x.n)}</td><td class="l rv">${esc(stByName[x.n].river)}</td><td class="num"><b>${x.r.toFixed(2)}</b></td><td class="num">${x.k}</td><td class="l"><span class="simbar" style="width:${Math.max(0,x.r)*100}%"></span>${x.r>=0.8?"매우 비슷":x.r>=0.6?"비슷":x.r>=0.4?"약간":"다름"}</td></tr>`).join("")}</tbody></table>
     <div class="row"><button class="chip" id="simRefGo" ${good.length?"":"disabled"}>기준 + 비슷한 ${good.length}개 지점만 보기</button></div>`
    : `<p class="hint">같은 달이 ${need}개월 이상 겹치는 지점이 없습니다.</p>`;
  if($("simRefGo")) $("simRefGo").onclick=()=>simSelect([so.ref, ...good.map(x=>x.n)], `${so.ref}와(과) 비슷한 지점`);
}
onRefresh(renderSim);
onInit(()=>{
  const set = (k, v)=>{ S.sim = Object.assign(S.sim||{}, {[k]:v}); renderSim(); };
  $("simThr").onchange = e=>set("thr", +e.target.value);
  $("simScope").onchange = e=>set("scope", e.target.value);
  $("simMode").onchange = e=>set("mode", e.target.value);
  $("simRef").onchange = e=>set("ref", e.target.value);
  $("simUndo").onclick = ()=>{ if(!S.simPrev) return; S.sel = new Set(S.simPrev); S.simPrev = null; refresh(); toast("이전 선택으로 돌아갔습니다"); };
});
