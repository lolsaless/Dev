/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   [40_화면/24_종단편집.js] 상·하류 종단 편집(지도에서 지점·순서 정하기)
   하는 일 : 상·하류 종단 화면의 [✎ 종단 편집] → 지도에서 중권역을 고르고, 종단에 넣을 지점과 상류→하류 순서를 정해 저장(서버: 수질측정망_설정.xlsx '종단순서' 시트 / 파일: 이 브라우저)
   주요 이름: PROF_KEY, profOrder, profChain, openProfEdit, peRender, peSave
   이럴 때 고침: 편집 지도 모양·저장 방식
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const PROF_KEY = "hantan-wq-prof-order-v4";
let PROF_LOCAL = (()=>{ try{ return JSON.parse(localStorage.getItem(PROF_KEY)||"{}"); }catch(e){ return {}; } })();
/* 중권역 → 지점코드 순서. 이 브라우저에 임시 저장한 것이 설정 파일보다 우선 */
const profOrder = () => Object.assign({}, D.profOrder||{}, PROF_LOCAL);
/* 종단 그래프에 쓸 지점(상류→하류). 저장한 순서가 없으면 목록 순서(지점코드 순) */
function profChain(river){
  const codes = profOrder()[river];
  if(codes && codes.length){ const by = Object.fromEntries(ST.map(s=>[s.code||s.name, s])); const c = codes.map(k=>by[k]).filter(Boolean); if(c.length>=2) return c; }
  return ST.filter(s=>s.river===river);
}
const profCustom = river => !!(profOrder()[river]||[]).length;

let peMap = null, peLayer = null, PE = {river:null, codes:[], picking:false};
function openProfEdit(){
  $("peCard").hidden = false;
  const rivers = RIVERS_ALL();
  if(!rivers.includes(PE.river)) PE.river = rivers.includes(S.profRiver) ? S.profRiver : rivers[0];
  $("peRiver").innerHTML = rivers.map(r=>`<option ${r===PE.river?"selected":""}>${esc(r)}</option>`).join("");
  peLoad(PE.river);
  if(!peMap){
    peMap = L.map("peMap", {zoomControl:true, attributionControl:true});
    if(CFG.vworldKey) L.tileLayer(`https://api.vworld.kr/req/wmts/1.0.0/${CFG.vworldKey}/Base/{z}/{y}/{x}.png`, {minZoom:6, maxZoom:19, maxNativeZoom:18, attribution:"© V월드", errorTileUrl:""}).addTo(peMap);
    if(D.geo) L.geoJSON(D.geo, {style:{color:css("--map-stroke"), weight:.8, dashArray:"3 3", fillColor:css("--map-fill"), fillOpacity:CFG.vworldKey?0:.35}, interactive:false}).addTo(peMap);
    peLayer = L.layerGroup().addTo(peMap);
  }
  setTimeout(()=>{ peMap.invalidateSize(); peRender(true); }, 60);
  $("peCard").scrollIntoView({behavior:"smooth", block:"start"});
}
function peLoad(river){ PE.river = river; PE.codes = profChain(river).map(s=>s.code||s.name); PE.picking = false; PE.dirty = false; }
function peStations(){ return ST.filter(s=>s.river===PE.river); }
function peRender(fit){
  const sts = peStations(), by = Object.fromEntries(ST.map(s=>[s.code||s.name, s]));
  const on = PE.codes.map(k=>by[k]).filter(Boolean), offs = sts.filter(s=>!PE.codes.includes(s.code||s.name));
  $("peSub").textContent = `${PE.river} · 지점 ${sts.length}개 중 ${on.length}개 사용 · ${profCustom(PE.river)?"저장된 순서":"기본 순서(지점코드)"}${PE.dirty?" · 저장 안 함":""}`;
  $("pePick").textContent = PE.picking ? "✔ 누르기 끝" : "지도에서 상류부터 차례로 누르기";
  $("pePick").setAttribute("aria-pressed", PE.picking);
  $("peMsg").innerHTML = PE.picking ? "<b>상류 지점부터</b> 지도 위 원을 차례로 누르세요. 누른 순서대로 1, 2, 3… 이 붙습니다. 다 누르면 [누르기 끝]." :
    "원을 누르면 종단에 넣거나 뺍니다(넣으면 맨 아래=하류 쪽에 붙음). 오른쪽 목록의 ▲▼로 순서를 바꾸고 [저장]하세요.";
  /* 지도 */
  peLayer.clearLayers();
  const pts = on.filter(s=>s.lat).map(s=>[s.lat,s.lon]);
  if(pts.length>1) L.polyline(pts, {color:css("--accent"), weight:3, opacity:.7}).addTo(peLayer);
  for(const s of sts){
    if(!s.lat || !s.lon) continue;
    const k = PE.codes.indexOf(s.code||s.name), inn = k>=0;
    const m = L.circleMarker([s.lat,s.lon], {radius: inn?10:7, color: inn?css("--accent"):css("--ink-3"), weight: 2, fillColor: inn?css("--accent"):css("--panel"), fillOpacity: inn?.9:.8});
    m.bindTooltip(`<b>${esc(s.name)}</b>${inn?` · ${k+1}번째${k===0?" (최상류)":k===PE.codes.length-1?" (최하류)":""}`:" · 빠짐"}<br>${esc(s.addr||"")}`, {direction:"top", offset:[0,-8]});
    m.on("click", ()=>peClick(s));
    m.addTo(peLayer);
    if(inn) L.marker([s.lat,s.lon], {interactive:false, icon:L.divIcon({className:"", iconSize:[0,0], html:`<span class="penum">${k+1}</span>`})}).addTo(peLayer);
  }
  if(fit){ const all = sts.filter(s=>s.lat).map(s=>[s.lat,s.lon]); if(all.length) peMap.fitBounds(all, {padding:[30,30], maxZoom:13}); }
  /* 목록 */
  $("peOn").innerHTML = on.length ? on.map((s,i)=>`<li><span class="pei">${i+1}</span><span class="pen">${esc(s.name)}<small>${i===0?" 최상류":i===on.length-1?" 최하류":""}</small></span>
      <button class="btn-s" data-up="${i}" ${i===0?"disabled":""} title="위로(상류 쪽)">▲</button><button class="btn-s" data-dn="${i}" ${i===on.length-1?"disabled":""} title="아래로(하류 쪽)">▼</button><button class="btn-s" data-rm="${i}" title="빼기">✕</button></li>`).join("")
    : `<li class="hint">지도에서 원을 눌러 지점을 넣으세요.</li>`;
  $("peOff").innerHTML = offs.length ? offs.map(s=>`<li><span class="pen">${esc(s.name)}</span><button class="btn-s" data-add="${esc(s.code||s.name)}">＋ 넣기</button></li>`).join("") : `<li class="hint">없음</li>`;
  $("peOn").querySelectorAll("[data-up]").forEach(b=>b.onclick=()=>peMove(+b.dataset.up, -1));
  $("peOn").querySelectorAll("[data-dn]").forEach(b=>b.onclick=()=>peMove(+b.dataset.dn, 1));
  $("peOn").querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{ PE.codes.splice(+b.dataset.rm,1); PE.dirty=true; peRender(); });
  $("peOff").querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>{ PE.codes.push(b.dataset.add); PE.dirty=true; peRender(); });
}
function peMove(i, d){ const j = i+d; if(j<0||j>=PE.codes.length) return; [PE.codes[i], PE.codes[j]] = [PE.codes[j], PE.codes[i]]; PE.dirty=true; peRender(); }
function peClick(s){
  const k = s.code||s.name, i = PE.codes.indexOf(k);
  if(PE.picking){ if(i<0) PE.codes.push(k); else if(i===PE.codes.length-1) PE.codes.pop(); }
  else { i<0 ? PE.codes.push(k) : PE.codes.splice(i,1); }
  PE.dirty = true; peRender();
}
async function peSave(reset){
  const codes = reset ? [] : PE.codes.slice(), by = Object.fromEntries(ST.map(s=>[s.code||s.name, s]));
  if(!reset && codes.length<2){ toast("종단에는 지점이 2개 이상 있어야 합니다."); return; }
  if(SERVER){
    try{
      const r = await fetch("/api/profile", {method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({river:PE.river, codes, names:codes.map(k=>by[k]?.name||"")})}).then(x=>x.json());
      if(!r.ok) throw new Error(r.error||"저장 실패");
      D.profOrder = D.profOrder||{}; if(codes.length) D.profOrder[PE.river] = codes; else delete D.profOrder[PE.river];
      delete PROF_LOCAL[PE.river]; try{ localStorage.setItem(PROF_KEY, JSON.stringify(PROF_LOCAL)); }catch(e){}
      toast(reset ? `${PE.river}: 기본 순서로 되돌렸습니다(설정 파일 저장)` : `${PE.river}: ${codes.length}개 지점 순서를 설정 파일에 저장했습니다`);
    }catch(e){ toast("저장하지 못했습니다: " + e.message); return; }
  } else {
    if(codes.length) PROF_LOCAL[PE.river] = codes; else delete PROF_LOCAL[PE.river];
    if(reset && D.profOrder) delete D.profOrder[PE.river];
    try{ localStorage.setItem(PROF_KEY, JSON.stringify(PROF_LOCAL)); }catch(e){}
    toast(reset ? `${PE.river}: 기본 순서로 되돌렸습니다(이 브라우저)` : `${PE.river}: 이 브라우저에 저장했습니다(설정 파일에 넣으려면 대시보드_열기로 열어 저장)`);
  }
  if(reset) peLoad(PE.river);
  PE.dirty = false; S.profRiver = PE.river; refresh(); peRender();
}
onInit(()=>{
  $("pfEdit").onclick = openProfEdit;
  $("peClose").onclick = ()=>{ if(PE.dirty && !confirmClose()) return; $("peCard").hidden = true; };
  $("peRiver").onchange = e=>{ peLoad(e.target.value); peRender(true); };
  $("pePick").onclick = ()=>{ PE.picking = !PE.picking; if(PE.picking){ PE.codes = []; PE.dirty = true; } peRender(); };
  $("peSave").onclick = ()=>peSave(false);
  $("peReset").onclick = ()=>peSave(true);
});
function confirmClose(){ $("peMsg").innerHTML = `<b>저장하지 않은 변경이 있습니다.</b> 저장하려면 [저장], 버리려면 [닫기]를 한 번 더 누르세요.`; PE.dirty = false; return false; }
