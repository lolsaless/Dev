/* ============================================================
   30-terminal.js — 하단 터미널: 로그 줄 + 진행률 막대
   ============================================================ */
(function(M){
  let term,barEl=null;

  function init(el){term=el;}

  function log(html){
    const d=document.createElement('div');d.innerHTML=html;
    if(barEl) term.insertBefore(d,barEl);else term.appendChild(d);   // 진행률 막대는 항상 맨 아래
    while(term.children.length>9) term.removeChild(term.firstChild);
  }
  function mkBar(){if(barEl)return;barEl=document.createElement('div');term.appendChild(barEl);}
  function setBar(pct){
    if(!barEl)return;
    const n=Math.round(pct/5);
    barEl.innerHTML='<span class="dim">'+'█'.repeat(n)+'░'.repeat(20-n)+'</span> '+Math.round(pct)+'%';
  }

  M.terminal={init,log,mkBar,setBar};
})(window.MF);
