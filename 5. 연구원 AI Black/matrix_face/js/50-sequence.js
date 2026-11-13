/* ============================================================
   50-sequence.js — 한 사이클의 진행 관리
   build(생성) → hold(유지) → melt(녹음) → gap(빈 화면) → 새 시드로 반복
   단계 전환, 터미널 로그 시점, 배지·캡션·상태바 갱신 담당
   ============================================================ */
(function(M){
  const S=M.state,DUR=M.DUR,T=M.terminal,U=M.util;
  let EV=[],evi=0,uiT=0;
  const badge=()=>document.getElementById('badge'),cap=()=>document.getElementById('cap'),pos=()=>document.getElementById('pos');

  /* 진행률(0~1)에 도달하면 터미널에 찍을 로그 */
  function events(){
    const dim=t=>'<span class="dim">'+t+'</span>',ok='<span class="ok">ok</span>';
    return [
      [0.02,dim('[  0%]')+' seeding RNG ........................ '+ok],
      [0.12,dim('[ 12%]')+' sampling landmarks (68 pts) ........ '+ok],
      [0.28,dim('[ 30%]')+' building mesh '+S.cols+'x'+S.rows+' ............... '+ok],
      [0.44,dim('[ 48%]')+' rasterizing glyph ramp ............. '+ok],
      [0.60,dim('[ 66%]')+' hair strands: '+S.P.hair+' ................. '+ok],
      [0.78,dim('[ 84%]')+' resolving eyes / mouth ............ '+ok],
      [0.95,dim('[ 98%]')+' flushing frame buffer ............. '+ok]
    ];
  }

  function start(p){
    S.phase=p;S.pt=0;
    if(p==='build'){
      S.seed+=1+Math.floor(Math.random()*40);S.faceNo++;
      M.canvas.buildFace();evi=0;EV=events();
      T.mkBar();
      T.log('<span class="pr">$</span> python face_gen.py --seed '+S.seed);
    }else if(p==='hold'){
      T.log('<span class="ok">✔</span> face #'+S.faceNo+' rendered · '+(S.cols*S.rows)+' cells');
    }else if(p==='melt'){
      T.log('<span class="wr">↻</span> dissolving buffer…');
    }
  }

  function step(dt){
    S.absT+=dt;S.pt+=dt;
    if(S.pt>=DUR[S.phase]) start(S.phase==='build'?'hold':S.phase==='hold'?'melt':S.phase==='melt'?'gap':'build');
    if(S.phase==='build'){
      const e=U.ease(S.pt/DUR.build);
      while(evi<EV.length&&e>=EV[evi][0]){T.log(EV[evi][1]);evi++;}
    }
    S.blink=S.phase==='hold'&&((S.pt%3.2)>3.0);              // 유지 중 3.2초마다 눈 깜빡
  }

  /* 화면 글자 갱신은 0.15초마다만 (리소스 절약) */
  function ui(dt){
    uiT+=dt;if(uiT<0.15)return;uiT=0;
    let pct=0,txt='● ready';
    if(S.phase==='build'){pct=U.ease(S.pt/DUR.build)*100;txt='● generating '+Math.round(pct)+'%';}
    else if(S.phase==='hold'){pct=100;txt='● rendered';}
    else if(S.phase==='melt'){pct=100-U.ease(S.pt/DUR.melt)*100;txt='● dissolving';}
    badge().textContent=txt;
    T.setBar(pct);
    cap().textContent='seed '+S.seed+' · '+S.cols+'×'+S.rows+' cells · hair '+(S.P?S.P.hair:'-');
    const p=M.editor.pos();pos().textContent='줄 '+p[0]+', 열 '+p[1];
  }

  M.seq={start,step,ui};
})(window.MF);
