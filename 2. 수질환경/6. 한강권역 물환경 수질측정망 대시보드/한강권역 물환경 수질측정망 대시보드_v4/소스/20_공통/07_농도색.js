/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   [20_공통/07_농도색.js] 농도 색·크기(지도·히트맵·종단 공통)
   하는 일 : 값이 낮으면 옅은 파랑, 높을수록 붉은색(CONC_STOPS)으로 칠하고, 원 크기를 키운다. 범위는 0~1로 맞춘 값(t)을 받는다
   주요 이름: CONC_STOPS, concColor, concT, concSize, concLegend
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
