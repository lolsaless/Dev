/* 측정월이 겹치는 모든 지점 쌍을 비교하고, 모든 내부 쌍이 기준을 충족하는 묶음을 만든다. */
const SIM_MIN_MONTHS = 12;
let simResult = null, simRunning = false;

function simSeries(name, item, months, mode){
  const values = series(name, item);
  if(mode !== "anom") return values;
  const bins = Array.from({length:12}, ()=>[]);
  values.forEach((v,i)=>{ if(v!=null) bins[+months[i].slice(5)-1].push(v); });
  const averages = bins.map(bin=>bin.reduce((sum,v)=>sum+v,0)/bin.length);
  return values.map((v,i)=>v==null ? null : v-averages[+months[i].slice(5)-1]);
}

async function simMatrix(input, progress){
  const {names, item, ms, mode} = input, n = names.length;
  const values = names.map(name=>simSeries(name,item,ms,mode));
  const matrix = Array.from({length:n}, ()=>new Float64Array(n).fill(NaN));
  const pairs = [];
  let checked = 0, eligible = 0, lastYield = performance.now();
  const total = n*(n-1)/2;
  for(let a=0;a<n;a++){
    for(let b=a+1;b<n;b++){
      const x=[], y=[];
      for(let j=0;j<ms.length;j++){
        if(values[a][j]!=null && values[b][j]!=null){ x.push(values[a][j]); y.push(values[b][j]); }
      }
      checked++;
      if(x.length>=SIM_MIN_MONTHS){
        eligible++;
        const rho = pearson(rankArr(x),rankArr(y));
        if(rho>=0.5){
          matrix[a][b] = matrix[b][a] = rho;
          pairs.push({a,b,rho});
        }
      }
    }
    if(performance.now()-lastYield > 30){
      progress(checked,total);
      await new Promise(resolve=>setTimeout(resolve,0));
      lastYield = performance.now();
    }
  }
  pairs.sort((a,b)=>b.rho-a.rho);
  return {input,matrix,pairs,total,eligible};
}

function simClusters({matrix,pairs}, threshold){
  const membership = matrix.map((_,i)=>[i]);
  for(const {a,b,rho} of pairs){
    if(rho<threshold) break;
    const left = membership[a], right = membership[b];
    if(left===right || !left.every(i=>right.every(j=>matrix[i][j]>=threshold))) continue;
    const merged = left.concat(right);
    for(const i of merged) membership[i] = merged;
  }
  return [...new Set(membership)].filter(group=>group.length>=2).map(idx=>{
    let min = 1, sum = 0, count = 0;
    idx.forEach((a,i)=>{
      for(let j=i+1;j<idx.length;j++){
        const score = matrix[a][idx[j]];
        min = Math.min(min,score);
        sum += score;
        count++;
      }
    });
    return {idx,min,mean:sum/count};
  }).sort((a,b)=>b.idx.length-a.idx.length || b.mean-a.mean);
}

function simInput(){
  const scope = $("simScope").value, mode = $("simMode").value;
  const names = scope==="all" ? ST.map(s=>s.name) : S.simPrev ? S.simPrev : selectedOrdered();
  const ms = months(), item = S.item;
  return {names, ms, item, mode, key:JSON.stringify([scope,mode,item,ms[0],ms.at(-1),names])};
}

function renderSim(){
  if(S.view!=="ts" || simRunning) return;
  const input = simInput(), output = $("simGroups");
  $("simUndo").hidden = !S.simPrev;
  $("simRun").disabled = input.names.length<2 || input.ms.length<SIM_MIN_MONTHS;
  $("simSub").textContent = `${input.item} · ${mLong(input.ms[0])}~${mLong(input.ms.at(-1))} · ${input.names.length}개 지점`;
  if($("simRun").disabled){
    output.textContent = "비교하려면 지점 2개 이상과 기간 12개월 이상이 필요합니다.";
    return;
  }
  if(simResult?.input.key!==input.key){
    output.textContent = "비교 실행을 누르면 같은 달이 12개월 이상 겹치는 지점 쌍을 분석합니다.";
    return;
  }
  const threshold = +$("simThr").value;
  const groups = simClusters(simResult,threshold);
  const assigned = groups.reduce((n,g)=>n+g.idx.length,0);
  const summary = `전체 ${simResult.total.toLocaleString()}쌍 중 ${simResult.eligible.toLocaleString()}쌍 비교 가능 · ${groups.length}개 묶음 · 묶음에 포함된 지점 ${assigned}/${input.names.length}개`;
  output.innerHTML = `<p class="hint">${summary}</p>` + groups.map((g,i)=>{
    const names = g.idx.map(idx=>input.names[idx]);
    return `<details><summary>묶음 ${i+1} · ${names.length}개 지점 · 평균 ρ ${g.mean.toFixed(2)} · 최저 ρ ${g.min.toFixed(2)}</summary>
      <p class="sim-members">${names.map(esc).join(" · ")}</p><button class="chip" data-simg="${i}">이 지점만 보기</button></details>`;
  }).join("") + (groups.length?"":'<p class="hint">기준을 충족한 지점 묶음이 없습니다.</p>');
  output.querySelectorAll("[data-simg]").forEach(button=>button.onclick=()=>{
    const names = groups[+button.dataset.simg].idx.map(i=>input.names[i]);
    S.simPrev ||= [...S.sel];
    S.sel = new Set(names);
    reassignColors(names,false);
    refresh();
    $("tsChart").scrollIntoView({block:"center"});
    toast(`${names.length}개 지점을 시계열에 표시했습니다`);
  });
}

onRefresh(renderSim);
onInit(()=>{
  for(const id of ["simScope","simMode","simThr"]) $(id).onchange = renderSim;
  $("simRun").onclick = async ()=>{
    const input = simInput(), run = $("simRun");
    simRunning = true;
    run.disabled = true;
    const progress = (done,total)=>{ $("simGroups").textContent = `지점 쌍 비교 중 · ${done.toLocaleString()} / ${total.toLocaleString()}`; };
    progress(0,input.names.length*(input.names.length-1)/2);
    try{
      await new Promise(resolve=>setTimeout(resolve,0));
      simResult = await simMatrix(input,progress);
    } finally {
      simRunning = false;
      run.disabled = false;
      renderSim();
    }
  };
  $("simUndo").onclick = ()=>{
    if(!S.simPrev) return;
    S.sel = new Set(S.simPrev);
    S.simPrev = null;
    refresh();
  };
});
