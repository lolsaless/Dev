/* ============================================================
   90-main.js — 시작점: 모듈 초기화 + 메인 루프 + 편의 기능
   ============================================================ */
(function(M){
  const S=M.state,$=id=>document.getElementById(id);
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MIN_DT=reduce?100:45;                        // 프레임 간격(ms): 약 20fps, 동작 줄이기 설정 시 10fps

  let last=0;
  function frame(now){
    requestAnimationFrame(frame);                    // 탭이 숨겨지면 브라우저가 자동으로 멈춤
    if(now-last<MIN_DT) return;
    const dt=Math.min(0.2,(now-last)/1000);last=now;
    M.seq.step(dt);
    M.editor.tick(dt,S.phase==='build'?95:45);       // 생성 중에는 타이핑이 더 빠름
    M.canvas.draw();
    M.seq.ui(dt);
  }

  function init(){
    M.terminal.init($('term'));
    M.canvas.init($('pane'),$('face'));              // 격자 크기(cols·rows)가 여기서 정해짐
    M.theme.init();                                  // 저장된 모드·색상 적용
    M.editor.init($('code'));M.editor.start();
    M.terminal.log('<span class="dim">Python 3.12 · matrix_face 환경 활성화됨</span>');
    M.terminal.mkBar();M.terminal.setBar(0);
    M.seq.start('build');

    document.addEventListener('visibilitychange',()=>{last=performance.now();});
    requestAnimationFrame(frame);

    /* 더블클릭 = 전체화면 (설정 패널 위에서는 제외) */
    document.addEventListener('dblclick',e=>{
      if(e.target.closest('#settings'))return;
      if(document.fullscreenElement) document.exitFullscreen();
      else if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    });
    /* 마우스를 3초 안 움직이면 커서 숨김 */
    let idleT=0;
    addEventListener('mousemove',()=>{document.body.classList.remove('idle');clearTimeout(idleT);idleT=setTimeout(()=>document.body.classList.add('idle'),3000);});
  }

  init();
})(window.MF);
