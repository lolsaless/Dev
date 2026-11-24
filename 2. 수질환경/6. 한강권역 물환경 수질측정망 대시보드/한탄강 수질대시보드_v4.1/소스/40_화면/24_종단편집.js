/* 흐름 그룹마다 상류→하류 순서와 합류할 하류 그룹을 관리한다. */
const PROF_BRANCH_KEY = "hantan-wq-profile-branches-v4-" + GRP;
function readProfileStorage(key){
  try { return JSON.parse(localStorage.getItem(key)) || {}; }
  catch { return {}; }
}
const PROF_LOCAL = readProfileStorage(PROF_BRANCH_KEY);
const PROF_LEGACY = readProfileStorage("hantan-wq-prof-order-v4");
const stationCode = s=>s.code||s.name;
const stationsInRiver = river=>ST.filter(s=>s.river===river);
const stationCodes = ()=>Object.fromEntries(ST.map(s=>[stationCode(s),s]));

function savedBranches(river){
  const branches = PROF_LOCAL[river] ?? D.profBranches?.[GRP]?.[river];
  if(Array.isArray(branches)) return branches;
  const codes = PROF_LEGACY[river] ?? D.profOrder?.[river];
  if(!Array.isArray(codes)) return [];
  const available = new Set(stationsInRiver(river).map(stationCode));
  const matching = codes.filter(code=>available.has(code));
  return matching.length>=2 ? [{name:"기존 종단",next:"",codes:matching}] : [];
}

function branchPath(groups, start){
  const byName = new Map(groups.map(g=>[g.name,g]));
  const seen = new Set(), codes = [];
  for(let group = byName.get(start); group && !seen.has(group.name); group = byName.get(group.next)){
    seen.add(group.name);
    const join = codes.length ? group.codes.indexOf(codes.at(-1)) : -1;
    const from = join + 1;
    codes.push(...group.codes.slice(from));
  }
  return codes;
}

function profileBranches(river){
  const saved = savedBranches(river);
  return saved.length ? saved : [{name:"기본 종단",next:"",codes:stationsInRiver(river).map(stationCode)}];
}

function profChain(river){
  const groups = profileBranches(river), byCode = stationCodes();
  const branch = groups.find(g=>g.name===S.profBranch) || groups[0];
  return branchPath(groups,branch.name).map(code=>byCode[code]).filter(Boolean);
}
const profCustom = river => savedBranches(river).length>0;

let peMap, peLayer;
const PE = {river:null, groups:[], index:0, picking:false, dirty:false, saving:false};
const peGroup = ()=>PE.groups[PE.index];
const peColor = i=>css("--s"+(i%8+1));

function peLoad(river){
  PE.river = river;
  PE.groups = profileBranches(river).map(group=>({...group,codes:[...group.codes]}));
  PE.index = Math.max(0, PE.groups.findIndex(g=>g.name===S.profBranch));
  PE.picking = PE.dirty = false;
}

function openProfEdit(){
  if(!$("peCard").hidden) return;
  $("peCard").hidden = false;
  peLoad(S.profRiver);
  $("peRiver").innerHTML = RIVERS_ALL().map(r=>`<option ${r===PE.river?"selected":""}>${esc(r)}</option>`).join("");
  if(!peMap){
    peMap = L.map("peMap", {zoomControl:true, attributionControl:true}).setView([37.93,127.15],9);
    if(CFG.vworldKey) L.tileLayer(`https://api.vworld.kr/req/wmts/1.0.0/${CFG.vworldKey}/Base/{z}/{y}/{x}.png`,
      {minZoom:6,maxZoom:19,maxNativeZoom:18,attribution:"© V월드",errorTileUrl:""}).addTo(peMap);
    if(D.geo) L.geoJSON(D.geo,{style:{color:css("--map-stroke"),weight:.8,dashArray:"3 3",
      fillColor:css("--map-fill"),fillOpacity:CFG.vworldKey?0:.35},interactive:false}).addTo(peMap);
    peLayer = L.layerGroup().addTo(peMap);
  }
  setTimeout(()=>{ peMap.invalidateSize(); peRender(true); },60);
  $("peCard").scrollIntoView({block:"start"});
}

function peRender(fit){
  const active = peGroup(), sts = stationsInRiver(PE.river), by = stationCodes();
  const on = active.codes.map(code=>by[code]).filter(Boolean);
  const off = sts.filter(s=>!active.codes.includes(stationCode(s)));
  $("peSub").textContent = `${PE.river} · 흐름 ${PE.groups.length}개${PE.dirty?" · 저장 전":""}`;
  $("peBranch").innerHTML = PE.groups.map((g,i)=>`<option value="${i}">${esc(g.name)}</option>`).join("");
  $("peBranch").value = PE.index;
  $("peName").value = active.name;
  $("peNext").innerHTML = '<option value="">연결 없음</option>' + PE.groups.filter(g=>g!==active).map(
    g=>`<option value="${esc(g.name)}">${esc(g.name)}</option>`).join("");
  $("peNext").value = active.next;
  $("peDelete").disabled = PE.groups.length<=1;
  $("pePick").textContent = PE.picking ? "누르기 끝" : "지도에서 순서 다시 지정";
  $("pePick").setAttribute("aria-pressed",PE.picking);
  $("peMsg").textContent = PE.picking
    ? "선택한 그룹의 상류부터 지도 지점을 차례로 누르세요. 마지막으로 누른 지점을 다시 누르면 취소됩니다."
    : "그룹마다 지점을 상류부터 배열하세요. 지류의 마지막 지점을 하류 그룹에도 넣으면 그 지점에서 합류합니다. 공유 지점이 없으면 하류 그룹의 첫 지점으로 이어집니다.";
  peLayer.clearLayers();
  PE.groups.forEach((group,i)=>{
    const points = group.codes.map(code=>by[code]).filter(s=>s?.lat && s?.lon).map(s=>[s.lat,s.lon]);
    if(points.length>1) L.polyline(points,{color:peColor(i),weight:i===PE.index?4:3,opacity:.8,interactive:false}).addTo(peLayer);
    const last = by[group.codes.at(-1)];
    const next = PE.groups.find(g=>g.name===group.next);
    const first = by[next?.codes.includes(group.codes.at(-1)) ? group.codes.at(-1) : next?.codes[0]];
    if(last?.lat && last.lon && first?.lat && first.lon && last!==first)
      L.polyline([[last.lat,last.lon],[first.lat,first.lon]],{color:peColor(i),weight:2,dashArray:"5 6",interactive:false}).addTo(peLayer);
  });
  for(const s of sts){
    if(!s.lat || !s.lon) continue;
    const k = active.codes.indexOf(stationCode(s)), included = k>=0;
    const marker = L.circleMarker([s.lat,s.lon],{radius:included?10:7,color:included?peColor(PE.index):css("--ink-3"),
      weight:2,fillColor:included?peColor(PE.index):css("--panel"),fillOpacity:.85});
    marker.bindTooltip(`<b>${esc(s.name)}</b>${included?` · ${k+1}번째`:""}<br>${esc(s.addr||"")}`);
    marker.on("click",()=>peClick(s));
    marker.addTo(peLayer);
    if(included) L.marker([s.lat,s.lon],{interactive:false,keyboard:false,
      icon:L.divIcon({className:"",iconSize:[0,0],html:`<span class="penum">${k+1}</span>`})}).addTo(peLayer);
  }
  if(fit){
    const points = sts.filter(s=>s.lat&&s.lon).map(s=>[s.lat,s.lon]);
    if(points.length) peMap.fitBounds(points,{padding:[30,30],maxZoom:13});
  }
  $("peOn").innerHTML = on.map(s=>{
    const i = active.codes.indexOf(stationCode(s));
    return `<li><span class="pei">${i+1}</span><span class="pen">${esc(s.name)}</span>
      <button class="btn-s" data-up="${i}" ${i===0?"disabled":""} aria-label="상류 쪽으로 이동">▲</button>
      <button class="btn-s" data-dn="${i}" ${i===active.codes.length-1?"disabled":""} aria-label="하류 쪽으로 이동">▼</button>
      <button class="btn-s" data-rm="${i}" aria-label="지점 빼기">✕</button></li>`;
  }).join("") || '<li class="hint">지도 또는 아래 목록에서 지점을 넣으세요.</li>';
  $("peOff").innerHTML = off.map(s=>`<li><span class="pen">${esc(s.name)}</span><button class="btn-s" data-add="${esc(stationCode(s))}">＋ 넣기</button></li>`).join("") || '<li class="hint">없음</li>';
  $("peOn").querySelectorAll("[data-up]").forEach(b=>b.onclick=()=>peMove(+b.dataset.up,-1));
  $("peOn").querySelectorAll("[data-dn]").forEach(b=>b.onclick=()=>peMove(+b.dataset.dn,1));
  $("peOn").querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>peClick(by[active.codes[+b.dataset.rm]],false));
  $("peOff").querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>peClick(by[b.dataset.add],false));
}

function peChanged(){
  PE.dirty = true;
  peRender();
}

function peMove(i, step){
  const codes = peGroup().codes, j = i+step;
  if(j<0 || j>=codes.length) return;
  [codes[i],codes[j]] = [codes[j],codes[i]];
  peChanged();
}

function peClick(s, sequential=PE.picking){
  const codes = peGroup().codes, code = stationCode(s), i = codes.indexOf(code);
  if(i<0) codes.push(code);
  else if(!sequential || i===codes.length-1) codes.splice(i,1);
  else return;
  peChanged();
}

function peIssue(groups){
  if(groups.some(g=>!g.codes.length)) return "모든 그룹에 지점을 1개 이상 넣으세요.";
  const byName = new Map(groups.map(group=>[group.name,group]));
  for(const group of groups){
    const seen = new Set();
    for(let g=group; g; g=byName.get(g.next)){
      if(seen.has(g.name)) return "하류 연결이 순환합니다. 같은 그룹으로 돌아오지 않게 설정하세요.";
      seen.add(g.name);
    }
    const path = branchPath(groups,group.name);
    if(path.length!==new Set(path).size) return "한 흐름에서 지점이 반복됩니다. 공유하는 합류점은 지류 그룹의 마지막 지점과 하류 그룹의 지점 순서를 확인하세요.";
  }
  return "";
}

async function peSave(reset){
  if(PE.saving) return;
  const river = PE.river;
  const groups = reset ? [] : PE.groups.map(g=>({...g,codes:[...g.codes]}));
  const fallback = groups.find(g=>g.name==="기본 종단");
  if(fallback){
    // 지점코드로 자동 생성된 경로는 합류 전 실제 본류 순서를 나타내지 않는다.
    const joins = groups.filter(g=>g.next===fallback.name)
      .map(g=>fallback.codes.indexOf(g.codes.at(-1))).filter(i=>i>=0);
    if(joins.length) fallback.codes = fallback.codes.slice(Math.min(...joins));
  }
  const issue = peIssue(groups);
  if(issue){ toast(issue); return; }
  const controls = [...$("peCard").querySelectorAll("button,input,select")];
  PE.saving = true;
  $("peCard").inert = true;
  controls.forEach(c=>c.disabled=true);
  try{
    if(SERVER){
      const names = Object.fromEntries(stationsInRiver(river).map(s=>[stationCode(s),s.name]));
      const response = await fetch("/api/profile",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({scope:GRP,river,branches:groups,names})});
      const result = await response.json();
      if(!result.ok) throw new Error(result.error||"저장 실패");
      D.profBranches ||= {};
      D.profBranches[GRP] ||= {};
      D.profBranches[GRP][river] = groups;
      delete PROF_LOCAL[river];
      try { localStorage.setItem(PROF_BRANCH_KEY,JSON.stringify(PROF_LOCAL)); } catch {}
    } else {
      localStorage.setItem(PROF_BRANCH_KEY,JSON.stringify({...PROF_LOCAL,[river]:groups}));
      PROF_LOCAL[river] = groups;
    }
    S.profRiver = river;
    S.profBranch = reset ? "" : peGroup().name;
    peLoad(river);
    refresh();
    toast(reset?"기본 순서로 되돌렸습니다":SERVER?"흐름 그룹을 설정 파일에 저장했습니다":"흐름 그룹을 이 브라우저에 저장했습니다");
  } catch(e){
    toast("저장하지 못했습니다: "+e.message);
  } finally {
    controls.forEach(c=>c.disabled=false);
    $("peCard").inert = false;
    PE.saving = false;
    peRender();
  }
}

onInit(()=>{
  $("pfEdit").onclick = openProfEdit;
  $("peClose").onclick = ()=>{
    if(PE.dirty && !window.confirm("저장하지 않은 종단 편집을 닫을까요?")) return;
    $("peCard").hidden = true;
  };
  $("peRiver").onchange = e=>{
    if(PE.dirty && !window.confirm("저장하지 않은 변경을 버리고 중권역을 바꿀까요?")){
      e.target.value = PE.river;
      return;
    }
    peLoad(e.target.value);
    peRender(true);
  };
  $("peBranch").onchange = e=>{ PE.index = +e.target.value; PE.picking = false; peRender(); };
  $("peNew").onclick = ()=>{
    let n = PE.groups.length+1;
    while(PE.groups.some(g=>g.name===`흐름 ${n}`)) n++;
    PE.index = PE.groups.push({name:`흐름 ${n}`,next:"",codes:[]})-1;
    PE.picking = false;
    peChanged();
    $("peName").select();
  };
  $("peDelete").onclick = ()=>{
    if(PE.groups.length<=1) return;
    const [removed] = PE.groups.splice(PE.index,1);
    for(const g of PE.groups) if(g.next===removed.name) g.next = "";
    PE.index = Math.min(PE.index,PE.groups.length-1);
    PE.picking = false;
    peChanged();
  };
  $("peName").onchange = e=>{
    const name = e.target.value.trim(), group = peGroup();
    if(!name || PE.groups.some(g=>g!==group && g.name===name)){
      e.target.value = group.name;
      toast("비어 있거나 중복된 그룹 이름입니다.");
      return;
    }
    for(const g of PE.groups) if(g.next===group.name) g.next = name;
    group.name = name;
    peChanged();
  };
  $("peNext").onchange = e=>{ peGroup().next=e.target.value; peChanged(); };
  $("pePick").onclick = ()=>{
    PE.picking = !PE.picking;
    if(PE.picking){ peGroup().codes = []; peChanged(); }
    else peRender();
  };
  $("peSave").onclick = ()=>peSave(false);
  $("peReset").onclick = ()=>peSave(true);
});
