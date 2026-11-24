/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   [20_공통/07_농도색.js] 농도 색·크기(지도·히트맵·종단 공통)
   하는 일 : 값이 낮으면 옅은 파랑, 높을수록 붉은색(CONC_STOPS)으로 칠하고, 원 크기를 키운다. 범위는 0~1로 맞춘 값(t)을 받는다
   주요 이름: CONC_STOPS, concColor, concT, concSize, concLegend, GRAPH_COLOR_GROUPS, CONC_PRESETS, applyGraphColors(색상 설정 반영)
   이럴 때 고침: 농도 색 단계(CONC_STOPS)·원 크기 범위(concSize)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* 낮음 → 높음: 옅은 파랑 · 파랑 · 연노랑 · 주황 · 빨강 */
const CONC_STOPS = ["#dbeaf7", "#8fbfe6", "#f3dc8c", "#ee8a46", "#cf2a1e"];
function concColor(t){
  if(t==null || isNaN(t)) return css("--panel-2");
  t = Math.max(0, Math.min(1, t)); const s = CONC_STOPS, p = t*(s.length-1), i = Math.min(s.length-2, Math.floor(p)), f = p-i;
  const a = s[i].match(/\w\w/g).map(x=>parseInt(x,16)), b = s[i+1].match(/\w\w/g).map(x=>parseInt(x,16));
  return "#"+a.map((x,k)=>Math.round(x+(b[k]-x)*f).toString(16).padStart(2,"0")).join("");
}
/* 값 → 0~1 (lo~hi 밖은 끝값). hi 는 보통 상위 95% 값(이상값 하나가 색을 다 차지하지 않게) */
const concT = (v, lo, hi) => v==null ? null : Math.max(0, Math.min(1, (v-lo)/((hi-lo)||1)));
/* 원 크기(반지름 px): 낮음 min → 높음 max */
const concSize = (t, min=5, max=17) => t==null ? min : min + (max-min)*t;
/* 값 목록 → {lo, hi} (최솟값 ~ 상위 95%) */
function concRange(vals){ const v = vals.filter(x=>x!=null).sort((a,b)=>a-b); return {lo: v[0] ?? 0, hi: v[Math.floor((v.length-1)*.95)] ?? 1}; }
/* 범례 HTML: 색 띠 + 작은/큰 원 */
function concLegend(lo, hi, dec, unit){
  return `<div class="concbar" style="background:linear-gradient(90deg,${CONC_STOPS.join(",")})"></div>
    <div class="concends"><span><i class="cdot" style="width:8px;height:8px;background:${CONC_STOPS[0]}"></i>${fmt(lo,dec)}</span><span>${fmt(hi,dec)}+ <i class="cdot" style="width:18px;height:18px;background:${CONC_STOPS.at(-1)}"></i></span></div>
    <div class="concnote">낮음 옅은 파랑 → 높음 빨강 · 높을수록 원이 큼${unit?` · ${esc(unit)}`:""}</div>`;
}

/* ═════════ 그래프 색상 설정(색상 설정 창) ═════════
   S.colors 에 사용자가 고른 색을 저장하고, 문서 맨 위(:root)의 CSS 색 변수를 덮어써서 모든 그래프에 반영한다.
   GRAPH_COLOR_GROUPS: 색상 설정 창에 보이는 묶음·순서·설명. 새 색을 넣으려면 여기와 01_색상_글꼴.css 에 변수를 더한다 */
const CONC_DEF = CONC_STOPS.slice();
const GRAPH_COLOR_GROUPS = [
  {title:"그래프 선", keys:[["g-main","주 선(한 지점 그래프·종단 강조 월·추세)"],["g-sub","비교 선(직전 12개월 등)"],["g-limit","기준선(생활환경기준 등급)"],["g-target","목표선"]]},
  {title:"판정·강조", keys:[["above","평균보다 높음 ▲"],["below","평균보다 낮음 ▼"],["base","기본 선(지점이 많을 때 강조 안 한 지점)"],["spike","⚡ 특이 경향 선"]]},
  {title:"시료번호 색 (자동 배정 순서 1~16)", grid:true, keys:[1,2,3,4,5,6,7,8].map(i=>["s"+i,i+"번"]).concat([1,2,3,4,5,6,7,8].map(i=>["t"+i,(i+8)+"번"]))},
  {title:"농도 색 (낮음 → 높음, 지도·히트맵·종단)", grid:true, conc:true, keys:CONC_DEF.map((_,i)=>["c"+i, ["낮음","","중간","","높음"][i]||""])}
];
/* 농도 색 미리 정한 조합 */
const CONC_PRESETS = {
  "기본(파랑→빨강)": CONC_DEF.slice(),
  "초록→빨강": ["#e3f2df","#9ed29a","#f3e08c","#ee9a4a","#c8281e"],
  "한 색(파랑 진하기)": ["#e4eef9","#a9c9ee","#5f9bdc","#2a6bc0","#0d3a75"],
  "색약 배려(파랑→주황)": ["#e6eef8","#9ab8de","#d9d2c4","#f0a35a","#b5520a"],
  "회색조(흑백 인쇄)": ["#f0f0f0","#c4c4c4","#969696","#5e5e5e","#202020"]
};
function applyGraphColors(){
  const root = document.documentElement.style, c = S.colors || {};
  for(const g of GRAPH_COLOR_GROUPS) if(!g.conc) for(const [k] of g.keys){ if(c[k]) root.setProperty("--"+k, c[k]); else root.removeProperty("--"+k); }
  CONC_DEF.forEach((d,i)=>{ CONC_STOPS[i] = c["c"+i] || d; });
}
applyGraphColors();
