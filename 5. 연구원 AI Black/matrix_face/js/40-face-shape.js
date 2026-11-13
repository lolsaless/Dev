/* ============================================================
   40-face-shape.js — 얼굴 모양 수학 모델
   faceVal(u,v,P,blink) : 좌표 (u,v) 의 밝기 0~1 (머리·머리카락·눈·코·입)
   makeParams(seed)     : 시드로 얼굴 특징(폭·눈 간격·미소·머리 모양) 결정
   좌표계: 얼굴 중심 (0,0), 위쪽이 음수 v, 대략 -1 ~ +1
   ============================================================ */
(function(M){
  function makeParams(sd){
    const r=M.util.rnd32(sd),u=(a,b)=>a+(b-a)*r(),hs=['short','bob','long'];
    return {seed:sd,fw:u(.54,.68),eg:u(.21,.31),ey:u(-.16,-.08),sm:u(-.015,.06),jaw:u(.25,.5),ny:u(.2,.3),bang:u(3,8),hair:hs[Math.floor(r()*3)],hs:u(.9,1.1)};
  }

  function faceVal(u,v,P,blink){
    let val=0;
    /* 목 + 어깨 */
    if(v>0.6&&Math.abs(u)<0.2&&v<1.05) val=0.26;
    const sh=(u/0.95)*(u/0.95)+((v-1.3)/0.5)*((v-1.3)/0.5);
    if(sh<1&&v>0.9) val=Math.max(val,0.2+0.14*(1-sh));

    /* 머리(달걀형) + 윤곽선 */
    const hv=v/0.82;let inHead=false,w=0;
    if(hv>-1&&hv<1){
      w=P.fw*Math.sqrt(1-hv*hv);
      if(hv>0.15) w*=1-P.jaw*(hv-0.15)/0.85;                 // 턱 좁히기
      if(Math.abs(u)<w){
        inHead=true;const e=1-Math.abs(u)/w;
        val=0.2+0.1*e+0.05*Math.max(0,1-Math.hypot(u,v-0.1)*2);
        if(e<0.08) val=0.8;
      }
    }

    /* 머리카락: 윗머리 + 앞머리, 길이에 따라 옆머리 */
    const au=Math.abs(u);
    const hx=u/(P.fw+0.1),hy=(v+0.06)/(0.9*P.hs);
    const strand=Math.max(0.36,0.5+0.22*Math.sin(u*34+v*5));
    if(hx*hx+hy*hy<1){
      const line=-0.4+0.1*Math.abs(Math.sin(u*P.bang));
      if(!inHead||v<line) val=strand;
    }
    if(P.hair!=='short'){
      const lim=P.hair==='bob'?0.5:0.95;
      const vc=(lim-0.4)/2,b=(lim+0.4)/2+0.05,a=P.fw+0.17;
      const hw=(hv>-1&&hv<1)?w:0.21;
      if(v>-0.4&&v<lim&&au>hw*0.95&&(au/a)*(au/a)+((v-vc)/b)*((v-vc)/b)<1) val=strand;
    }

    /* 눈(깜빡임 지원) + 눈썹 */
    for(let s=-1;s<=1;s+=2){
      const ex=s*P.eg,ey=P.ey,dx=(u-ex)/0.115,dy=(v-ey)/(blink?0.018:0.05),d=dx*dx+dy*dy;
      if(d<1){ if(blink) val=0.95; else{ val=d>0.5?0.95:0.12; if((u-ex)*(u-ex)+(v-ey)*(v-ey)<0.0012) val=1; } }
      const t=(u-ex)/0.15;
      if(Math.abs(t)<1&&Math.abs(v-(ey-0.11-0.035*(1-t*t)))<0.014) val=0.85;
    }

    /* 코 */
    if(au<0.02&&v>P.ey+0.03&&v<P.ny) val=0.55;
    const nx=(au-0.07)/0.035,nyy=(v-P.ny-0.01)/0.022;
    if(nx*nx+nyy*nyy<1) val=0.9;

    /* 입 (smile 값이 클수록 입꼬리 올라감) */
    if(au<0.2){
      const t=au/0.2,yc=0.45-P.sm*t*t;
      if(Math.abs(v-yc)<0.014) val=0.9;
      else if(au<0.13&&Math.abs(v-(yc+0.035+P.sm*0.2))<0.011) val=0.6;
    }
    return val>1?1:val;
  }

  M.shape={makeParams,faceVal};
})(window.MF);
