/* [부품 G3] 카탈로그 묶기 — 레코드·사진·원본 엑셀·양식을 카탈로그 데이터(EQ_DATA)로 만들어
 *  내장된 카탈로그 틀(CATALOG_TPL)에 끼워 넣은 HTML 문자열을 돌려준다.
 *  데이터 형식은 부품설계도 §4 'EQ_DATA' 와 같아야 한다 (Python 판 catalog.py 와 공유). */
(function (EQ) {
  'use strict';
  const U = EQ.util;
  const PUBLIC_FIELDS = ['uid', 'sheet', 'row', 'seq', 'id', 'serial', 'item', 'name', 'nameExt', 'spec', 'maker', 'country', 'date', 'year', 'qty', 'price',
    'status', 'usage', 'remark', 'place', 'vendor', 'addr', 'tel', 'telNote', 'cond', 'note', 'outDate', 'inDate', 'comps', 'hist', 'key'];

  /**
   * @param o.records   레코드 배열 (선택된 장비)
   * @param o.photos    레코드와 같은 순서의 사진 [{bytes,ext,w,h,key}|null]
   * @param o.source    {name, bytes(Uint8Array)} 원본 엑셀
   * @param o.snapshot  EQ.excel.open(...).snapshot() 결과
   * @param o.templateB64 ledger.docx base64
   * @param o.extra     {compsAll(Map), histAll(Map), people[], compSheet, idOf(Map key→관리번호)} 편집용 전체 자료
   * @param o.thumbEdge / o.thumbQuality / o.onProgress(k, n)
   */
  async function build(o) {
    const images = {}, keyOf = new Map(), recs = [];
    for (let k = 0; k < o.records.length; k++) {
      const r = o.records[k], ph = o.photos[k];
      let pk = null;
      if (ph && ph.bytes) {
        if (!keyOf.has(ph.key)) {
          const id = 'i' + keyOf.size;
          try { images[id] = await EQ.img.thumb(ph, o.thumbEdge || 900, o.thumbQuality || 0.78); keyOf.set(ph.key, id); }
          catch (_) { keyOf.set(ph.key, null); }
        }
        pk = keyOf.get(ph.key);
      }
      const out = {}; PUBLIC_FIELDS.forEach(f => { out[f] = r[f]; });
      out.ph = pk; recs.push(out);
      if (o.onProgress && k % 4 === 0) { o.onProgress(k + 1, o.records.length); await U.sleep(0); }
    }
    const d = new Date(), z = n => String(n).padStart(2, '0');
    const data = {
      schema: 2, docId: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      generated: `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`,
      source: o.source ? { name: o.source.name, size: o.source.bytes.length, b64: U.bytesToB64(o.source.bytes) } : null,
      sheetsView: o.snapshot || [],
      records: recs, images,
      template: o.templateB64 || null,
      title: EQ.CONFIG.title,
    };
    const X = o.extra || {};
    const obj = m => { const r = {}; (m || new Map()).forEach((v, k) => { r[k] = v; }); return r; };
    data.compsAll = obj(X.compsAll); data.histAll = obj(X.histAll); data.people = X.people || []; data.compSheet = X.compSheet || '';
    data.compIds = [...(X.idOf || new Map())].filter(([k]) => data.compsAll[k]);
    data.histIds = [...(X.idOf || new Map())].filter(([k]) => data.histAll[k]);
    const payload = JSON.stringify(data).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, c => '\\u' + c.charCodeAt(0).toString(16));
    return CATALOG_TPL.replace('/*__DATA__*/null', () => payload);
  }
  EQ.pack = { build };
})(window.EQ = window.EQ || {});
