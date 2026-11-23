/* [부품 S1] 날짜·금액 형식 — 엑셀 값(일련번호/Date/문자열) → 화면·양식용 문자열 */
(function (EQ) {
  'use strict';
  const z = n => String(n).padStart(2, '0');
  const fmt = {
    /** 엑셀 날짜 값 → {y,m,d} 또는 null */
    dateParts(v) {
      if (v == null || v === '') return null;
      if (v instanceof Date && !isNaN(v)) return { y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate() };
      if (typeof v === 'number' && isFinite(v) && v > 59 && v < 80000) {          // 엑셀 일련번호
        const t = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
        return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
      }
      const m = String(v).match(/(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
      return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
    },
    /** ISO(YYYY-MM-DD) 문자열 — 레코드 저장용 */
    iso(v) { const p = fmt.dateParts(v); return p ? `${p.y}-${z(p.m)}-${z(p.d)}` : ''; },
    /** 표시용. style: dot(2004.07.01) | dash | kr(2004. 7. 1.) | han(2004년 7월 1일) */
    date(v, style) {
      const p = fmt.dateParts(v);
      if (!p) return v == null ? '' : String(v);
      if (style === 'dash') return `${p.y}-${z(p.m)}-${z(p.d)}`;
      if (style === 'kr') return `${p.y}. ${p.m}. ${p.d}.`;
      if (style === 'han') return `${p.y}년 ${p.m}월 ${p.d}일`;
      return `${p.y}.${z(p.m)}.${z(p.d)}`;
    },
    /** 금액 숫자화 (문자 "1,086,000원" 도 허용). 숫자가 아니면 null */
    num(v) {
      if (v == null || v === '') return null;
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[,\s원]/g, ''));
      return isFinite(n) ? n : null;
    },
    won(v) { const n = fmt.num(v); return n == null ? '' : Math.round(n).toLocaleString('ko-KR'); },
    /** 사람이 읽는 금액: 1.5억원, 2,340만원, 85만원 */
    wonShort(v) {
      const n = fmt.num(v); if (n == null) return '-';
      if (n >= 1e8) return (n / 1e8).toFixed(n >= 1e9 ? 1 : 2).replace(/\.?0+$/, '') + '억원';
      if (n >= 1e4) return Math.round(n / 1e4).toLocaleString('ko-KR') + '만원';
      return Math.round(n).toLocaleString('ko-KR') + '원';
    },
  };
  EQ.fmt = fmt;
})(window.EQ = window.EQ || {});
