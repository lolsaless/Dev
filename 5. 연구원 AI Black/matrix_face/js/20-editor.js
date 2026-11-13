/* ============================================================
   20-editor.js — 코드 타이핑 효과 (줄 추가·스크롤·커서)
   init(요소) → start() → 매 프레임 tick(dt, 초당글자수)
   ============================================================ */
(function(M){
  const LH=20;                         // css/editor.css 의 line-height 와 같아야 함
  let ed,L=[],li=0,ci=0,lnNo=1,wait=0,acc=0,cur=null,restart=false;

  function init(el){ed=el;}

  function addRow(){
    if(cur) cur.el.classList.remove('act');
    const el=document.createElement('div');el.className='row act';
    el.innerHTML='<span class="ln">'+(lnNo++)+'</span><span class="tx"></span>';
    ed.appendChild(el);cur={el:el,tx:el.lastChild};
    const max=Math.max(6,Math.floor(ed.clientHeight/LH));
    while(ed.children.length>max&&ed.firstChild!==el) ed.removeChild(ed.firstChild);   // 위쪽 줄은 밀려 사라짐
  }

  function start(){ed.textContent='';cur=null;L=M.scriptLines();li=0;ci=0;lnNo=1;addRow();}

  function tick(dt,rate){
    if(wait>0){wait-=dt;if(wait<=0&&restart){restart=false;start();}return;}
    acc+=dt*rate;let n=acc|0;acc-=n;let changed=false;
    while(n-->0){
      const line=L[li];
      if(ci<line.length){ci++;changed=true;}
      else{
        li++;ci=0;
        if(li>=L.length){                                   // 끝: 잠시 멈춘 뒤 처음부터 다시
          cur.tx.innerHTML=M.highlight(L[li-1])+'<b class="cur"></b>';
          wait=2.4;restart=true;changed=false;li=L.length-1;ci=L[li].length;break;
        }
        cur.tx.innerHTML=M.highlight(line);addRow();
        wait=0.04+Math.random()*0.12;changed=false;break;   // 줄바꿈 때 살짝 쉼
      }
    }
    if(changed) cur.tx.innerHTML=M.highlight(L[li].slice(0,ci))+'<b class="cur"></b>';
  }

  M.editor={init,start,tick,pos:()=>[li+1,ci+1]};
})(window.MF);
