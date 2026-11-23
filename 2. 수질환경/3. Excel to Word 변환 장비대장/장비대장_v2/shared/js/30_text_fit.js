/* [부품 S3] 글자 크기 자동 맞춤 — 칸(가로·세로 twip)에 글이 넘치지 않는 가장 큰 크기 계산
 *  원리 : 글자별 폭(한글=1em, 영문·숫자는 좁게)으로 줄바꿈을 흉내 내 줄 수를 세고,
 *         줄 간격을 '정확히 크기×lineFactor' 로 고정(Word 의 줄간격 '고정')하므로
 *         글꼴이 없는 PC 에서도 높이 계산이 어긋나지 않는다.
 *  반환 : { size(pt), lines, lineTw(줄 간격 twip), fits(bool) } */
(function (EQ) {
  'use strict';
  const { cleanXml } = EQ.util;
  const FORM = EQ.CONFIG.form;

  // 보수적으로(조금 넓게) 잡은 글자 폭 (em)
  function charW(c) {
    const cc = c.charCodeAt(0);
    if (c === ' ') return 0.33;
    if (cc < 128) {
      if (/[0-9]/.test(c)) return 0.56;
      if (/[A-Z]/.test(c)) return 0.72;
      if (/[mw]/.test(c)) return 0.85;
      if (/[a-z]/.test(c)) return 0.56;
      if (/[.,:;'`|!]/.test(c)) return 0.34;
      if (/[()\[\]\-\/]/.test(c)) return 0.42;
      return 0.62;
    }
    if (cc >= 0x2460 && cc <= 0x24FF) return 1.0;   // ①
    if (cc >= 0x2000 && cc < 0x2E80) return 0.8;    // ℃, ±, → 등
    return 1.0;                                      // 한글·한자
  }

  /** 단어 단위 줄바꿈을 흉내 내 줄 수를 센다 (영문 단어는 통째로 넘김) */
  function countLines(text, widthPt, size) {
    let total = 0;
    for (const para of cleanXml(text).split('\n')) {
      let x = 0, lines = 1;
      const tokens = para.match(/[A-Za-z0-9.,%()\-\/+:]+|\s+|./gu) || [];
      for (const t of tokens) {
        let w = 0; for (const ch of t) w += charW(ch) * size;
        if (/^\s+$/.test(t)) { x += w; continue; }
        if (x + w <= widthPt) { x += w; continue; }
        if (w <= widthPt) { lines++; x = w; continue; }
        for (const ch of t) {                       // 너무 긴 단어는 글자 단위로
          const cw = charW(ch) * size;
          if (x + cw > widthPt) { lines++; x = cw; } else x += cw;
        }
      }
      total += lines;
    }
    return total;
  }

  /**
   * @param text   넣을 글
   * @param wTw    칸 너비(twip)  @param hTw  칸 높이(twip)
   * @param maxPt  기본 크기     @param minPt 최소 크기
   */
  function fit(text, wTw, hTw, maxPt, minPt) {
    const widthPt = (wTw - FORM.cellPadW) / 20 * 0.97;   // 3% 여유
    const availPt = (hTw - FORM.cellPadH) / 20;
    const lf = FORM.lineFactor;
    let s = maxPt, lines = 1;
    for (; s >= minPt - 1e-9; s -= 0.5) {
      lines = countLines(text, widthPt, s);
      if (lines * s * lf <= availPt) return { size: s, lines, lineTw: Math.round(s * lf * 20), fits: true };
    }
    s = minPt; lines = countLines(text, widthPt, s);
    return { size: s, lines, lineTw: Math.round(s * lf * 20), fits: false };
  }
  EQ.fit = { fit, countLines, charW };
})(window.EQ = window.EQ || {});
