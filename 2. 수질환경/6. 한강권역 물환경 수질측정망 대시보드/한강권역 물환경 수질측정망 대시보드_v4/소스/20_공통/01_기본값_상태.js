/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   [20_공통/01_기본값_상태.js] 기본값·화면 상태·도우미
   하는 일 : 데이터(D) 꺼내기, 설정(CFG), 화면 상태(S)·저장(persist), 지점 수정 덮어쓰기, 하천 목록, 날짜·글자 도우미
   주요 이름: ST, M, ITEMS, CFG, S, defaults, persist, applyEdits, RIVERS_ALL, mLabel, esc, col, PAL
   이럴 때 고침: 처음 열 때 기본 화면(항목·선택·옵션 기본값), 저장할 상태 항목
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* ═════════ 기본값 · 상태 ═════════ */
/* 묶음(조사기관)마다 화면 상태를 따로 저장 */
const SKEY = "hantan-wq-dashboard-v4-" + GRP, EKEY = "hantan-wq-station-edits-v4-" + GRP;
const store = { get(){ try{ return JSON.parse(localStorage.getItem(SKEY)||"{}"); }catch(e){ return {}; } },
                set(v){ try{ localStorage.setItem(SKEY, JSON.stringify(v)); }catch(e){} },
                clear(){ try{ localStorage.removeItem(SKEY); }catch(e){} } };
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const $ = id => document.getElementById(id);
D.geo = D.geo || window.GEO_SIGUNGU || null;
const ST = D.stations, M = D.months, ITEMS = D.items, CFG = buildCfg();
const stByName = Object.fromEntries(ST.map(s=>[s.name,s]));
/* 지점 관리: 원본값 보관 + 저장 전 수정값(EDITS)을 화면에 덮어씀 */
const EDIT_FIELDS = {order:"정렬순서", river:"하천명", sigun:"시군", addr:"주소", lat:"위도", lon:"경도", coord:"좌표상태", coordSrc:"좌표출처", note:"비고"};
const ORIG = Object.fromEntries(ST.map(s=>[s.name, Object.fromEntries(Object.keys(EDIT_FIELDS).map(k=>[k, s[k]]))]));
let EDITS = (()=>{ try{ return JSON.parse(localStorage.getItem(EKEY)||"{}"); }catch(e){ return {}; } })();
let SERVER = false;
function applyEdits(){
  for(const s of ST){ Object.assign(s, ORIG[s.name], EDITS[s.name]||{}); }
  ST.sort((a,b)=>(a.order??999)-(b.order??999));
}
for(const n of Object.keys(EDITS)) if(!stByName[n]) delete EDITS[n];
applyEdits();
const RIVERS_ALL = () => { const o = []; ST.forEach(s=>{ if(!o.includes(s.river)) o.push(s.river); }); return o; };
const RIVERS = () => RIVERS_ALL().filter(r=>ST.filter(s=>s.river===r).length>1);
const itemOf = c => ITEMS.find(i=>i.code===c) || {code:c,name:c,unit:"",dec:2};
const multiYear = new Set(M.map(m=>m.slice(0,4))).size>1;
const mLabel = m => multiYear ? `${m.slice(2,4)}년 ${+m.slice(5)}월` : (+m.slice(5))+"월";   // v3.2: 19.09 → 19년 9월
const mLong = m => m ? m.slice(0,4)+"년 "+(+m.slice(5))+"월" : "";
const esc = s => String(s??"").replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function defaults(){
  return {
    item: ITEMS.some(i=>i.code===CFG.item) ? CFG.item : (ITEMS.some(i=>i.code==="색도")?"색도":ITEMS[0].code),
    view: "ts", sel: (GRP_DEF.sel||[]).filter(n=>stByName[n]).length ? GRP_DEF.sel.filter(n=>stByName[n]) : ST.map(s=>s.name), hl: [],
    custom: {}, slots: {}, slotPerm: null, colors: {},
    opt: {band: CFG.band||"sd", k: CFG.k||1, p: CFG.p||30, labels:"auto", mean:true, limits:true, scale:"linear", gaps:false, spike:true, spikeZ: CFG.spike||8},
    from: (GRP_DEF.from>=0 && GRP_DEF.from<M.length) ? GRP_DEF.from : 0, to: M.length-1, heatMode: "value",
    profRiver: RIVERS().includes(GRP_DEF.profRiver) ? GRP_DEF.profRiver : RIVERS().includes("신천") ? "신천" : RIVERS()[0], profHidden: [],
    base: CFG.basemap || "자동", mapMonth: "last", mapLabels: true, mapLines: false, qcFilter: "all", qcSel: false,
    anaTab: "trend", anaCell: null, anaPair: null, exThr: null, open: [], ipColors: {}
  };
}
const saved = store.get();
const S = Object.assign(defaults(), saved, {opt: Object.assign(defaults().opt, saved.opt||{})});
S.sel = new Set((S.sel||[]).filter(n=>stByName[n])); S.hl = new Set((S.hl||[]).filter(n=>stByName[n]));
S.profHidden = new Set(S.profHidden||[]); S.open = new Set(S.open||[]);
/* v4: 관리 구분을 바꾸기 직전의 화면·항목·기간을 그대로 이어받음(switchGroup 이 남긴 값) */
const CARRY_KEY = "hantan-wq-carry-v4";
try{ const c = JSON.parse(localStorage.getItem(CARRY_KEY)||"null"); localStorage.removeItem(CARRY_KEY);
  if(c){ if(c.view) S.view = c.view; if(ITEMS.some(i=>i.code===c.item)) S.item = c.item;
    const a = M.indexOf(c.from), b = M.indexOf(c.to); if(a>=0 && b>=a){ S.from = a; S.to = b; }
    if(c.mapMonth) S.mapMonth = c.mapMonth; if(c.anaTab) S.anaTab = c.anaTab; if(c.heatMode) S.heatMode = c.heatMode; if(c.ipColors) S.ipColors = c.ipColors; } }catch(e){}
if(!(S.from>=0 && S.from<M.length)) S.from = 0;
if(!(S.to>=S.from && S.to<M.length)) S.to = M.length-1;
if(!ITEMS.some(i=>i.code===S.item)) S.item = defaults().item;
if(!RIVERS().includes(S.profRiver)) S.profRiver = defaults().profRiver;
S.q = ""; S.retired = false;
const persist = () => store.set({item:S.item, view:S.view, sel:[...S.sel], hl:[...S.hl], custom:S.custom, slots:S.slots, slotPerm:S.slotPerm, opt:S.opt,
  colors:S.colors, heatMode:S.heatMode, from:S.from, to:S.to, profRiver:S.profRiver, profHidden:[...S.profHidden],
  base:S.base, mapLabels:S.mapLabels, mapLines:S.mapLines, qcFilter:S.qcFilter, qcSel:S.qcSel, anaTab:S.anaTab, anaPair:S.anaPair, exThr:S.exThr, open:[...S.open], ipColors:S.ipColors});
const persistEdits = () => { try{ localStorage.setItem(EKEY, JSON.stringify(EDITS)); }catch(e){} };

const col = k => S.colors[k] || css("--"+k);
const PAL = () => [1,2,3,4,5,6,7,8].map(i=>css("--s"+i)).concat([1,2,3,4,5,6,7,8].map(i=>css("--t"+i)));
