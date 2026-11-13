/* ============================================================
   10-highlight.js — 파이썬 구문 강조 (한 줄 → HTML)
   색은 css/editor.css 의 .k .s .n .c .f .b 클래스가 결정
   ============================================================ */
(function(M){
  const esc=M.util.esc;
  const KW=new Set(['import','from','def','return','for','in','if','else','elif','while','class','with','as','not','and','or','yield','pass']);
  const CONST=new Set(['True','False','None','self']);
  const RE=/(#.*$)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)(\s*\()?|([\s\S])/g;

  M.highlight=function(line){
    let out='',m;RE.lastIndex=0;
    while((m=RE.exec(line))){
      if(m[1]) out+='<i class="c">'+esc(m[1])+'</i>';           // 주석
      else if(m[2]) out+='<i class="s">'+esc(m[2])+'</i>';      // 문자열
      else if(m[3]) out+='<i class="n">'+m[3]+'</i>';           // 숫자
      else if(m[4]){
        const w=m[4],p=m[5]?esc(m[5]):'';
        if(KW.has(w)) out+='<i class="k">'+w+'</i>'+p;          // 키워드
        else if(CONST.has(w)) out+='<i class="b">'+w+'</i>'+p;  // True/None/self
        else if(m[5]) out+='<i class="f">'+w+'</i>'+p;          // 함수 호출·정의
        else out+=esc(w);
      } else out+=esc(m[6]);
    }
    return out;
  };
})(window.MF);
