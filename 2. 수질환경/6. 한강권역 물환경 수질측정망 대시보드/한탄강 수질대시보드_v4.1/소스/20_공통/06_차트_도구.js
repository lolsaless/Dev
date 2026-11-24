/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   [20_공통/06_차트_도구.js] 그래프 만들기 도우미
   하는 일 : ECharts 그래프 만들기·크기 자동 맞춤, 표 복사용 임시 저장
   주요 이름: charts, chartOn, cache, limitMarkLines(기준선 라벨 겹침 방지), keyIndexes(최대·최소·마지막), textWidth
   이럴 때 고침: 고치지 않음
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* ═════════ 차트 인스턴스 ═════════ */
const charts = {};
function chartOn(id){
  const el = $(id);
  if(!charts[id]){ charts[id] = echarts.init(el, null, {renderer:"canvas"}); new ResizeObserver(()=>charts[id].resize()).observe(el); }
  return charts[id];
}
const cache = {};
/* 기준선(생활환경기준·목표) 라벨: 값이 가까운 선끼리는 라벨을 한 줄로 합쳐 맨 위 선에만 단다(글자 겹침 방지).
   lines: [{yAxis, text, lineStyle?, label?}], vmax: y축 최댓값(가깝다 = vmax×gap 이내) */
function limitMarkLines(lines, vmax, gap=0.07){
  const sorted = lines.filter(l=>Number.isFinite(l.yAxis)).sort((a,b)=>a.yAxis-b.yAxis), out = [];
  let group = [];
  const flush = ()=>{
    const text = group.map(l=>l.text).join(" · ");
    group.forEach((l,i)=>out.push({yAxis:l.yAxis, lineStyle:l.lineStyle, label:Object.assign({}, l.label||{}, {show:i===group.length-1, formatter:text})}));
    group = [];
  };
  for(const l of sorted){ if(group.length && l.yAxis-group[0].yAxis > (vmax||1)*gap) flush(); group.push(l); }
  if(group.length) flush();
  /* 라벨은 그래프 오른쪽 바깥(선 끝)에 단다 → 오른쪽 여백에 쓸 가장 긴 라벨 폭(px) */
  out.width = Math.max(0, ...out.filter(l=>l.label.show).map(l=>textWidth(l.label.formatter, 11)));
  return out;
}
/* 글자 폭(px) 재기 — 그래프 여백을 글자에 맞출 때 사용 */
function textWidth(str, size=12){
  const c = textWidth.c || (textWidth.c = document.createElement("canvas").getContext("2d"));
  c.font = `${size}px ${css("--f-ui")}`;
  return Math.ceil(c.measureText(String(str)).width);
}
/* 라벨이 많은 긴 그래프: 그 계열의 최대·최소·마지막 값 위치만 돌려준다 */
function keyIndexes(values){
  let mx=-1, mn=-1, last=-1;
  values.forEach((v,i)=>{ if(v==null || !Number.isFinite(v)) return; last=i; if(mx<0 || v>values[mx]) mx=i; if(mn<0 || v<values[mn]) mn=i; });
  return new Set([mx,mn,last].filter(i=>i>=0));
}
