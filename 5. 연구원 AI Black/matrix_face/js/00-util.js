/* ============================================================
   00-util.js — 공용 도구와 공유 상태 (가장 먼저 로드)
   모든 모듈은 전역 객체 MF 아래에 붙는다 (file:// 에서도 동작)
   ============================================================ */
window.MF=window.MF||{};
(function(M){
  /* 시드 고정 난수 생성기 */
  const rnd32=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
  /* 0~1 구간 부드러운 가감속 */
  const ease=t=>t<=0?0:t>=1?1:0.5-0.5*Math.cos(Math.PI*t);
  /* HTML 이스케이프 */
  const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  /* 색상 계산 */
  const h2r=h=>{h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');const n=parseInt(h,16);return[(n>>16)&255,(n>>8)&255,n&255];};
  const r2h=a=>'#'+a.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
  const mix=(a,b,t)=>{const x=h2r(a),y=h2r(b);return r2h([0,1,2].map(i=>x[i]+(y[i]-x[i])*t));};
  /* 기준색 하나로 n단계 밝기 팔레트 생성: 어두운 색 → 기준색(base번째) → 흰색에 가깝게 */
  const ramp=(color,n,base,bg)=>{
    const dark=mix(bg,color,0.14),out=[];
    for(let i=0;i<n;i++) out.push(i<base?mix(dark,color,i/base):mix(color,'#ffffff',(i-base)/(n-1-base)*0.9));
    return out;
  };

  M.util={rnd32,ease,esc,mix,ramp};

  /* 한 사이클 단계별 길이(초): 생성 → 유지 → 녹음 → 빈 화면 */
  M.DUR={build:13,hold:7,melt:3.5,gap:0.8};

  /* 모듈 간 공유 상태 */
  M.state={
    seed:4800+Math.floor(Math.random()*200),  // 현재 얼굴 시드
    cols:60,rows:36,                          // canvas 격자 크기 (face-canvas.js 가 갱신)
    P:null,                                   // 현재 얼굴 파라미터
    phase:'gap',pt:0,absT:0,blink:false,faceNo:0
  };
})(window.MF);
