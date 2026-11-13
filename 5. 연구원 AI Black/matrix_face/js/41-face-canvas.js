/* ============================================================
   41-face-canvas.js — canvas 렌더링 (문자 비 + 얼굴 글자 + 색상 팔레트)
   init(pane, canvas)  : 크기 맞춤 + 창 크기 변경 감지
   setColors(rain,face): 기준색으로 팔레트 재생성 (설정 패널에서 호출)
   buildFace()         : 현재 시드로 얼굴 밝기 지도 계산
   draw()              : 한 프레임 그리기 (시퀀스 단계는 MF.state 참조)
   저사양 비결: 글자를 한 번만 그려 둔 atlas 에서 drawImage 로 복사만 한다
   ============================================================ */
(function(M){
  const U=M.util,S=M.state,DUR=M.DUR;
  const CW=8,CH=14;                                          // 글자 칸 크기(css px)
  const RAIN_CH='01{}()[];=+-*/<>#$%&|~^?!:.'.split('');       // 비에 쓰는 문자
  const FACE_RAMP=[' ','.',':','-','=','+','/','{','}','1','0','#','%','@'];   // 어두움 → 밝음
  const GL=[...new Set([...RAIN_CH,...FACE_RAMP.slice(1)])];
  const gIdx={};GL.forEach((g,i)=>gIdx[g]=i);
  const RI=RAIN_CH.map(g=>gIdx[g]);
  const FI=FACE_RAMP.map(g=>g===' '?-1:gIdx[g]);
  const BG='#0a1530';                                        // 팔레트 가장 어두운 쪽이 섞일 배경

  let RAINC=[],FACEC=[];
  let pane,cv,ctx,dpr=1,cwd=8,chd=14,atlas=null,jit,sp,off,tl,head,A,B,fr=0;

  /* ---------- 색상 ---------- */
  function setColors(rain,face){
    RAINC=U.ramp(rain,6,3,BG);          // 비: 6단계, 3번째가 기준색
    FACEC=U.ramp(face,8,4,BG);          // 얼굴: 8단계, 4번째가 기준색
    if(atlas) buildAtlas();
  }
  setColors('#2a9d99','#a58cf6');

  function buildAtlas(){
    atlas=document.createElement('canvas');atlas.width=GL.length*cwd;atlas.height=(RAINC.length+FACEC.length)*chd;
    const a=atlas.getContext('2d');a.textAlign='center';a.textBaseline='middle';
    a.font=Math.round(11.5*dpr)+'px Consolas,"Cascadia Mono","SF Mono",Menlo,"DejaVu Sans Mono",monospace';
    RAINC.concat(FACEC).forEach((c,row)=>{a.fillStyle=c;GL.forEach((g,i)=>a.fillText(g,i*cwd+cwd/2,row*chd+chd/2+1));});
  }

  /* ---------- 얼굴 밝기 지도 ---------- */
  function buildFace(){
    const sd=S.seed,cols=S.cols,rows=S.rows;
    S.P=M.shape.makeParams(sd);
    const Wc=cols*cwd/dpr,Hc=rows*chd/dpr,sc=Math.min(Wc/2/0.9,Hc/2/1.0),nz=U.rnd32(sd*7+1);
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const u=((x+.5)*cwd/dpr-Wc/2)/sc,v=((y+.5)*chd/dpr-Hc/2)/sc,i=y*cols+x,n=(nz()-.5)*0.05;
      const a=M.shape.faceVal(u,v,S.P,false),b=M.shape.faceVal(u,v,S.P,true);   // b = 눈 감은 버전
      A[i]=a>0.05?Math.max(0.07,a+n):0;B[i]=b>0.05?Math.max(0.07,b+n):0;
    }
  }

  /* ---------- 크기 맞춤 ---------- */
  function setup(){
    const r=pane.getBoundingClientRect();
    dpr=Math.min(window.devicePixelRatio||1,1.5);              // 해상도 상한 1.5배(리소스 절약)
    cwd=Math.round(CW*dpr);chd=Math.round(CH*dpr);
    const cols=Math.max(24,Math.floor(r.width*dpr/cwd)),rows=Math.max(14,Math.floor(r.height*dpr/chd));
    S.cols=cols;S.rows=rows;
    cv.width=cols*cwd;cv.height=rows*chd;cv.style.width=cv.width/dpr+'px';cv.style.height=cv.height/dpr+'px';
    buildAtlas();
    const n=cols*rows;jit=new Float32Array(n);A=new Float32Array(n);B=new Float32Array(n);
    for(let i=0;i<n;i++)jit[i]=Math.random();
    sp=new Float32Array(cols);off=new Float32Array(cols);tl=new Float32Array(cols);head=new Float32Array(cols);
    for(let x=0;x<cols;x++){sp[x]=7+Math.random()*13;off[x]=Math.random()*rows*3;tl[x]=8+Math.random()*14;}   // 열마다 속도·꼬리 길이
    buildFace();
  }

  /* ---------- 한 프레임 ---------- */
  function draw(){
    const cols=S.cols,rows=S.rows,phase=S.phase,pt=S.pt;
    ctx.clearRect(0,0,cv.width,cv.height);
    fr++;
    for(let x=0;x<cols;x++) head[x]=(S.absT*sp[x]+off[x])%(rows+tl[x]);   // 각 열의 비 머리 위치
    const front=phase==='build'?U.ease(pt/DUR.build)*(rows+8):0;          // 생성 전선
    const melt=phase==='melt'?U.ease(pt/DUR.melt)*(rows+8):0;             // 녹는 전선
    const scan=phase==='hold'?((pt/DUR.hold)*(rows+10))-3:-99;            // 유지 중 스캔라인
    const map=S.blink?B:A;
    const fa=fr>>3,ra=fr>>2;
    for(let y=0;y<rows;y++){
      for(let x=0;x<cols;x++){
        const i=y*cols+x,j=jit[i]*6,val=map[i];
        let res=false,flash=false;
        if(phase==='build'){const d=front-j-y;res=d>=0;flash=d<2.5;}
        else if(phase==='hold') res=true;
        else if(phase==='melt') res=y>melt+j-6;
        if(res&&val>0){                                       // 얼굴 글자
          let r=(val*14)|0;if(r>13)r=13;if(r<1)r=1;
          if((fa+x*3+y*7)%23===0&&r<13) r++;                  // 반짝임
          let lv=(val*8)|0;if(lv>7)lv=7;
          if(flash) lv=7;
          else if(phase==='hold'){const dd=y-scan;if(dd>-2&&dd<2&&lv<7)lv=Math.min(7,lv+2);}
          ctx.drawImage(atlas,FI[r]*cwd,(RAINC.length+lv)*chd,cwd,chd,x*cwd,y*chd,cwd,chd);
        }else{                                                 // 문자 비
          const d=head[x]-y;
          if(d>=0&&d<tl[x]){
            const k=1-d/tl[x];
            if(k>0.04){
              let lv=d<1?5:Math.min(4,(k*5)|0);
              if(res&&lv>2) lv=2;                              // 얼굴 위쪽 영역에서는 비를 어둡게
              const g=RI[(x*7+y*13+ra*29+(d<1?fr*5:0))%RI.length];
              ctx.drawImage(atlas,g*cwd,lv*chd,cwd,chd,x*cwd,y*chd,cwd,chd);
            }
          }
        }
      }
    }
  }

  function init(p,c){
    pane=p;cv=c;ctx=cv.getContext('2d');setup();
    let t=0;new ResizeObserver(()=>{clearTimeout(t);t=setTimeout(setup,150);}).observe(pane);
  }

  M.canvas={init,setup,setColors,buildFace,draw};
})(window.MF);
