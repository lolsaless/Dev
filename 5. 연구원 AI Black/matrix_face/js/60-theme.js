/* ============================================================
   60-theme.js — 다크모드 + 색상 설정 (설정 패널)
   - 화면 모드: 라이트 / 다크 / 시스템
   - 색상 프리셋, 빗줄기·얼굴·포인트(상태바) 색 직접 선택
   - 선택값은 브라우저 localStorage 에 저장되어 다음에도 유지
   - 단축키: D = 다크/라이트 전환, Esc = 설정 닫기
   프리셋을 추가하려면 PRESETS 배열에 한 줄 추가
   ============================================================ */
(function(M){
  const KEY='matrixface.settings.v1';
  const PRESETS=[
    {id:'violet', name:'보라',   rain:'#2a9d99',face:'#a58cf6',accent:'#5645d4'},
    {id:'matrix', name:'초록',  rain:'#1fd14a',face:'#8dffa6',accent:'#148a2c'},
    {id:'ocean',  name:'바다',   rain:'#2b8cd6',face:'#8fdcff',accent:'#2f6fd6'},
    {id:'orange', name:'주황',   rain:'#dd5b00',face:'#ffb780',accent:'#c24f00'},
    {id:'pink',   name:'핑크',   rain:'#d6459f',face:'#ff9fd9',accent:'#a02e6d'},
    {id:'mono',   name:'흑백',   rain:'#8a8f98',face:'#ffffff',accent:'#37352f'}
  ];
  const DEF={mode:'system',rain:PRESETS[0].rain,face:PRESETS[0].face,accent:PRESETS[0].accent};
  const $=id=>document.getElementById(id);
  const mq=matchMedia('(prefers-color-scheme: dark)');
  let S=load();

  function load(){try{return Object.assign({},DEF,JSON.parse(localStorage.getItem(KEY))||{});}catch(e){return Object.assign({},DEF);}}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
  const resolved=()=>S.mode==='system'?(mq.matches?'dark':'light'):S.mode;

  /* 설정값을 화면에 반영 */
  function apply(){
    const root=document.documentElement;
    root.dataset.theme=resolved();
    root.style.setProperty('--primary',S.accent);
    root.style.setProperty('--primary-pressed',M.util.mix(S.accent,'#000000',0.2));
    M.canvas.setColors(S.rain,S.face);
    sync();
  }

  /* 패널 안의 버튼·입력 상태 맞추기 */
  function sync(){
    document.querySelectorAll('#modePills button').forEach(b=>b.classList.toggle('on',b.dataset.mode===S.mode));
    document.querySelectorAll('#presets button').forEach(b=>{
      const p=PRESETS.find(x=>x.id===b.dataset.id);
      b.classList.toggle('on',p.rain===S.rain&&p.face===S.face&&p.accent===S.accent);
    });
    $('cRain').value=S.rain;$('cFace').value=S.face;$('cAccent').value=S.accent;
  }

  function buildPresets(){
    $('presets').innerHTML=PRESETS.map(p=>
      '<button data-id="'+p.id+'"><i style="background:linear-gradient(135deg,'+p.rain+' 50%,'+p.face+' 50%)"></i>'+p.name+'</button>').join('');
  }

  function toggle(open){
    const el=$('settings');
    el.hidden=open===undefined?!el.hidden:!open;
  }

  function init(){
    buildPresets();
    $('modePills').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.mode=b.dataset.mode;save();apply();});
    $('presets').addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b)return;
      const p=PRESETS.find(x=>x.id===b.dataset.id);S.rain=p.rain;S.face=p.face;S.accent=p.accent;save();apply();
    });
    $('cRain').addEventListener('input',e=>{S.rain=e.target.value;save();apply();});
    $('cFace').addEventListener('input',e=>{S.face=e.target.value;save();apply();});
    $('cAccent').addEventListener('input',e=>{S.accent=e.target.value;save();apply();});
    $('stReset').addEventListener('click',()=>{S=Object.assign({},DEF);save();apply();});

    $('gear').addEventListener('click',e=>{e.stopPropagation();toggle();});
    $('themeBtn').addEventListener('click',e=>{e.stopPropagation();toggle();});
    document.addEventListener('click',e=>{if(!e.target.closest('#settings'))toggle(false);});     // 바깥 클릭 = 닫기
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape') toggle(false);
      else if((e.key==='d'||e.key==='D')&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.target.tagName!=='INPUT'){
        S.mode=resolved()==='dark'?'light':'dark';save();apply();
      }
    });
    (mq.addEventListener?mq.addEventListener('change',()=>{if(S.mode==='system')apply();}):mq.addListener(()=>{if(S.mode==='system')apply();}));
    apply();
  }

  M.theme={init,apply,PRESETS};
})(window.MF);
