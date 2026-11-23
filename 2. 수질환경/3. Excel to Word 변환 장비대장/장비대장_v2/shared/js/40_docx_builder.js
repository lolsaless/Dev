/* [부품 S4] Word 문서 조립 — ledger.docx 양식을 복제해 장비마다 앞면(대장)+뒷면(이력표)을 채움
 *  의존 : JSZip, EQ.fit, EQ.fmt, EQ.CONFIG.form
 *  사용 :
 *     const b = await EQ.DocBuilder.create(TEMPLATE_B64, {dateStyle:'dot'});
 *     const warn = b.append(record, photo);   // photo = {bytes, ext:'jpg'|'png', w, h, key} | null
 *     const blob = await b.finish();
 *  한 쪽 유지 : 글이 긴 칸은 EQ.fit 으로 글자 크기를 줄이고 줄 간격을 '고정'으로 지정한다.
 *              그래도 넘치면 warn 배열에 사유를 돌려준다. */
(function (EQ) {
  'use strict';
  const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const XML_NS = 'http://www.w3.org/XML/1998/namespace';
  const { cleanXml, esc } = EQ.util;
  const FORM = EQ.CONFIG.form;
  const kids = (n, name) => [...n.children].filter(c => c.localName === name);
  const rowsOf = t => kids(t, 'tr'), cellsOf = tr => kids(tr, 'tc'), parsOf = tc => kids(tc, 'p');
  const halfPt = s => Math.round(s * 2);

  // ---- 서식 조작 (OOXML 요소 순서를 지켜 삽입) ----
  const RPR_AFTER_SZ = ['szCs', 'highlight', 'u', 'effect', 'bdr', 'shd', 'fitText', 'vertAlign', 'rtl', 'cs', 'em', 'lang', 'eastAsianLayout', 'specVanish', 'oMath'];
  const PPR_AFTER_SPACING = ['ind', 'contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc', 'textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange'];
  const el = (doc, name, attrs) => { const e = doc.createElementNS(W_NS, 'w:' + name); for (const [k, v] of Object.entries(attrs || {})) e.setAttributeNS(W_NS, 'w:' + k, String(v)); return e; };

  function setSz(doc, rPr, hp) {
    [...rPr.children].filter(c => c.localName === 'sz' || c.localName === 'szCs').forEach(c => rPr.removeChild(c));
    const sz = el(doc, 'sz', { val: hp }), szCs = el(doc, 'szCs', { val: hp });
    const ref = [...rPr.children].find(c => RPR_AFTER_SZ.includes(c.localName));
    rPr.insertBefore(sz, ref || null); rPr.insertBefore(szCs, ref || null);
  }
  /** 문단 줄 간격을 '고정(exact)'으로 */
  function setExactSpacing(doc, p, lineTw) {
    let pPr = kids(p, 'pPr')[0];
    if (!pPr) { pPr = el(doc, 'pPr'); p.insertBefore(pPr, p.firstChild); }
    kids(pPr, 'spacing').forEach(s => pPr.removeChild(s));
    const sp = el(doc, 'spacing', { before: 0, after: 0, line: lineTw, lineRule: 'exact' });
    pPr.insertBefore(sp, [...pPr.children].find(c => PPR_AFTER_SPACING.includes(c.localName)) || null);
  }
  function runRPr(doc, p) {
    const r0 = kids(p, 'r')[0];
    if (r0) { const rp = kids(r0, 'rPr')[0]; return rp ? rp.cloneNode(true) : null; }
    const pPr = kids(p, 'pPr')[0], pr = pPr && kids(pPr, 'rPr')[0];
    if (!pr) return null;
    const rp = el(doc, 'rPr');
    [...pr.children].forEach(c => { if (!['ins', 'del', 'moveFrom', 'moveTo', 'rPrChange'].includes(c.localName)) rp.appendChild(c.cloneNode(true)); });
    return rp;
  }
  /** 문단 글을 바꾼다(첫 run 서식 유지). opt.size(pt) / opt.lineTw(고정 줄간격) */
  function setPar(doc, p, text, opt) {
    opt = opt || {};
    let rPr = runRPr(doc, p);
    kids(p, 'r').forEach(r => p.removeChild(r));
    if (opt.size) { if (!rPr) rPr = el(doc, 'rPr'); setSz(doc, rPr, halfPt(opt.size)); }
    if (opt.lineTw) setExactSpacing(doc, p, opt.lineTw);
    const t = cleanXml(text); if (t === '') return;
    const r = el(doc, 'r'); if (rPr) r.appendChild(rPr);
    t.split('\n').forEach((ln, i) => {
      if (i) r.appendChild(el(doc, 'br'));
      const e = el(doc, 't'); e.setAttributeNS(XML_NS, 'xml:space', 'preserve'); e.textContent = ln; r.appendChild(e);
    });
    p.appendChild(r);
  }
  /** 칸 크기에 맞춰 글을 넣는다. 줄어든 경우만 크기·고정 줄간격 지정 */
  function fillFit(doc, p, text, wTw, hTw, max, min, force) {
    const f = EQ.fit.fit(text, wTw, hTw, max, min);
    const shrink = f.size < max;
    setPar(doc, p, text, (shrink || force) ? { size: shrink ? f.size : null, lineTw: f.lineTw } : {});
    return f;
  }

  function drawingXml(rid, id, name, cx, cy) {
    return `<w:r xmlns:w="${W_NS}"><w:drawing xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
      + `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="${esc(name)}"/>`
      + `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>`
      + `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${esc(name)}"/><pic:cNvPicPr/></pic:nvPicPr>`
      + `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
      + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }

  class DocBuilder {
    constructor(zip, doc, opts) {
      this.zip = zip; this.doc = doc; this.opts = opts || {};
      this.body = doc.documentElement.getElementsByTagNameNS(W_NS, 'body')[0];
      const ch = [...this.body.children];
      this.sect = ch.find(c => c.localName === 'sectPr');
      this.pristine = ch.filter(c => c.localName !== 'sectPr');
      const sig = this.pristine.map(c => c.localName).join(',');
      if (sig !== 'tbl,tbl,p,p,p,tbl,p,p') throw new Error('양식(ledger.docx) 구조가 예상과 다릅니다: ' + sig);
      this.pristine.forEach(c => this.body.removeChild(c));
      this.rels = []; this.mediaExt = new Set(); this.imgSeq = 0; this.docPrId = 5000; this.relOf = new Map(); this.count = 0;
    }
    static async create(templateB64, opts) {
      const zip = await JSZip.loadAsync(templateB64, { base64: true });
      const xml = await zip.file('word/document.xml').async('string');
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) throw new Error('양식 XML 해석 오류');
      return new DocBuilder(zip, doc, opts);
    }
    _addPhoto(photo) {
      const key = photo.key || ('p' + this.imgSeq);
      if (this.relOf.has(key)) return this.relOf.get(key);
      const n = ++this.imgSeq, rid = 'rIdPhoto' + n, path = `media/photo${n}.${photo.ext}`;
      this.zip.file('word/' + path, photo.bytes);
      this.rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${path}"/>`);
      this.mediaExt.add(photo.ext); this.relOf.set(key, rid); return rid;
    }
    /** 장비 1대(앞면+뒷면) 추가. 반환: 경고 문자열 배열 */
    append(rec, photo) {
      const doc = this.doc, warn = [];
      const f = this.pristine.map(n => n.cloneNode(true));
      f.forEach(n => [...n.getElementsByTagNameNS(W_NS, 'lastRenderedPageBreak')].forEach(e => e.parentNode.removeChild(e)));
      f.forEach(n => [...n.getElementsByTagName('*')].forEach(e => {
        if (e.localName === 'docPr' || (e.localName === 'cNvPr' && e.hasAttribute('id'))) e.setAttribute('id', String(++this.docPrId));
      }));
      const [t0, t1, pFront, pBreak, pHead, t2, pBack] = f;
      const nameLine = `물품명 : ${rec.name}`, idLine = `관리번호 (${rec.id})`;
      const R = rowsOf(t1), c0 = cellsOf(R[0]), c1 = cellsOf(R[1]);

      // 제목줄
      const NL = FORM.nameLine;
      fillFit(doc, parsOf(c0[0])[0], nameLine, NL.w, NL.h, NL.max, NL.min);
      setPar(doc, parsOf(c0[1])[0], idLine);
      setPar(doc, parsOf(c1[1])[0], rec.item ? `물품번호 ${rec.item}` : '');

      // 기본 정보(3행 병합 칸)
      const r4 = cellsOf(R[4]), H = FORM.infoCellH, I = FORM.info;
      const put = (tc, text, k) => {
        const r = fillFit(doc, parsOf(tc)[0], text, I[k].w, H, I[k].max, I[k].min);
        if (!r.fits) warn.push(`${k} 칸 글이 길어 최소 크기(${I[k].min}pt)로도 넘칠 수 있음`);
      };
      put(r4[0], rec.spec, 'spec');
      { // 제작회사 / (제조국) — 두 문단
        const ps = parsOf(r4[1]), mk = rec.maker, co = rec.country ? `(${rec.country})` : '';
        const a = EQ.fit.fit(mk, I.maker.w, H / 2, I.maker.max, I.maker.min), b = EQ.fit.fit(co, I.maker.w, H / 2, I.maker.max, I.maker.min);
        const s = Math.min(a.size, b.size), o = s < I.maker.max ? { size: s, lineTw: Math.round(s * FORM.lineFactor * 20) } : {};
        setPar(doc, ps[0], mk, o); setPar(doc, ps[1], co, o);
      }
      put(r4[2], EQ.fmt.date(rec.date, this.opts.dateStyle), 'date');
      setPar(doc, parsOf(r4[3])[0], EQ.fmt.won(rec.price));
      put(r4[4], rec.vendor, 'vendor');
      put(r4[5], rec.addr, 'addr');
      put(r4[6], rec.tel, 'tel');
      put(r4[7], rec.usage, 'usage');

      const r6 = cellsOf(R[6]);
      const used = /중고/.test(rec.cond), isNew = /신품|신규|새/.test(rec.cond);
      setPar(doc, parsOf(r6[3])[0], (isNew ? '■' : '□') + ' 신품');
      setPar(doc, parsOf(r6[4])[0], (used ? '■' : '□') + '중고품');

      // 주요 성능 및 특징 — 항상 고정 줄간격(줄 수가 많아도 행이 늘지 않게)
      const r7 = cellsOf(R[7]), N = FORM.note;
      { const ps = parsOf(r7[0]);
        const fr = fillFit(doc, ps[1] || ps[0], rec.note, N.w, N.h - N.labelH, N.max, N.min, true);
        if (!fr.fits) warn.push(`주요 성능 및 특징이 매우 길어(약 ${fr.lines}줄) 최소 ${N.min}pt로도 한 쪽을 넘을 수 있음`);
        else if (fr.size < N.max) warn.push(`주요 성능 및 특징 글자 ${N.max}→${fr.size}pt 축소`);
      }

      // 장비구성내역 (기본 5행, 많으면 행을 늘리고 높이를 나눔)
      const C = FORM.comp, comps = (rec.comps || []).slice(0, C.maxRows);
      if ((rec.comps || []).length > C.maxRows) warn.push(`구성내역 ${rec.comps.length}행 중 ${C.maxRows}행만 반영`);
      const compRows = R.slice(10, 10 + C.baseRows), total = Math.max(C.baseRows, comps.length);
      while (compRows.length < total) {
        const last = compRows[compRows.length - 1], nr = last.cloneNode(true);
        last.parentNode.insertBefore(nr, last.nextSibling); compRows.push(nr);
      }
      const rowH = total > C.baseRows ? Math.floor(C.rowH * C.baseRows / total) : C.rowH;
      const base = total > C.baseRows ? Math.max(C.min, C.max - (total - C.baseRows) * 0.5) : C.max;
      compRows.forEach((tr, i) => {
        const trH = tr.getElementsByTagNameNS(W_NS, 'trHeight')[0];
        if (trH) { trH.setAttributeNS(W_NS, 'w:val', String(rowH)); if (total > C.baseRows) trH.setAttributeNS(W_NS, 'w:hRule', 'exact'); }
        const cs = cellsOf(tr), cp = comps[i], o = base < C.max ? { size: base, lineTw: Math.round(base * FORM.lineFactor * 20) } : {};
        setPar(doc, parsOf(cs[0])[0], String(i + 1), o);
        const nf = EQ.fit.fit(cp ? cp.n : '', C.nameW, rowH, base, C.min);
        setPar(doc, parsOf(cs[1])[0], cp ? cp.n : '', nf.size < C.max ? { size: nf.size, lineTw: nf.lineTw } : {});
        setPar(doc, parsOf(cs[2])[0], cp ? cp.q : '', o);
        setPar(doc, parsOf(cs[3])[0], cp ? cp.u : '', o);
      });

      // 사진 (7~14행 병합 칸 안에 비율 유지)
      const pPhoto = parsOf(r7[1])[0];
      kids(pPhoto, 'r').forEach(r => pPhoto.removeChild(r));
      if (photo && photo.bytes) {
        const rid = this._addPhoto(photo), P = FORM.photo;
        const boxW = (P.w - P.pad) * 635, boxH = (N.h + rowH * total + C.rowH * 2 - P.trim) * 635;
        const sc = Math.min(boxW / photo.w, boxH / photo.h);
        const id = ++this.docPrId;
        const dx = new DOMParser().parseFromString(drawingXml(rid, id, '사진 ' + rec.id, Math.round(photo.w * sc), Math.round(photo.h * sc)), 'application/xml');
        pPhoto.appendChild(doc.importNode(dx.documentElement, true));
      }

      // 뒷면 머리글
      { const rs = kids(pHead, 'r'); kids(rs[0], 't')[0].textContent = nameLine; kids(rs[1], 't')[0].textContent = idLine; }

      if (this.count > 0) {
        const br = this.pristine[3].cloneNode(true);
        [...br.getElementsByTagNameNS(W_NS, 'lastRenderedPageBreak')].forEach(e => e.parentNode.removeChild(e));
        this.body.appendChild(br);
      }
      [t0, t1, pFront, pBreak, pHead, t2, pBack].forEach(n => this.body.appendChild(n));
      this.count++;
      return warn;
    }
    async finish() {
      this.body.appendChild(this.sect);
      const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + new XMLSerializer().serializeToString(this.doc).replace(/^<\?xml[^>]*\?>\s*/, '');
      this.zip.file('word/document.xml', xml);
      let rels = await this.zip.file('word/_rels/document.xml.rels').async('string');
      this.zip.file('word/_rels/document.xml.rels', rels.replace('</Relationships>', this.rels.join('') + '</Relationships>'));
      let ct = await this.zip.file('[Content_Types].xml').async('string');
      const mime = { jpg: 'image/jpeg', png: 'image/png' };
      this.mediaExt.forEach(e => { if (!new RegExp(`Extension="${e}"`, 'i').test(ct)) ct = ct.replace('<Default ', `<Default Extension="${e}" ContentType="${mime[e]}"/><Default `); });
      this.zip.file('[Content_Types].xml', ct);
      return this.zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 },
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    }
  }
  EQ.DocBuilder = DocBuilder;
})(window.EQ = window.EQ || {});
