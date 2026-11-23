/* [부품 S0] 공통 유틸 — 문자열 정규화, 이스케이프, 크기 표시 등
 * 다른 모든 부품이 EQ.util 을 사용한다. (브라우저 전용, 외부 의존 없음) */
(function (EQ) {
  'use strict';
  const nfc = s => String(s ?? '').normalize('NFC');
  const util = {
    nfc,
    /** 관리번호 비교용 키: NFC·하이픈 통일·공백 제거·소문자 */
    normKey: s => nfc(s).replace(/[‐-―−ー－]/g, '-').replace(/\s+/g, '').toLowerCase(),
    /** 엑셀 머리글 비교용: 공백 제거·소문자 */
    normHdr: s => nfc(s).replace(/\s+/g, '').toLowerCase(),
    /** Word XML 에 넣을 수 없는 제어문자 제거, 줄바꿈 통일 */
    cleanXml: s => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/\r\n?/g, '\n'),
    esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    fmtBytes: n => n >= 1048576 ? (n / 1048576).toFixed(2) + 'MB' : Math.round(n / 1024) + 'KB',
    sleep: ms => new Promise(r => setTimeout(r, ms || 0)),
    safeName: s => nfc(s).replace(/[\\/:*?"<>|\r\n]+/g, '_').trim(),
    stamp() { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}`; },
    /** 자연 정렬 키 (04-장비-5 < 04-장비-40) */
    natKey: s => String(s).replace(/\d+/g, m => m.padStart(8, '0')),
    download(blob, name) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    },
    b64ToBytes(b64) { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; },
    bytesToB64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); },
    /** localStorage 는 막혀 있을 수 있으므로 항상 try/catch */
    store: {
      get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
      set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
    },
  };
  EQ.util = util;
})(window.EQ = window.EQ || {});
