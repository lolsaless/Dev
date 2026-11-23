/* [부품 C7] 보내기·내보내기 — 원본 엑셀(내장) 내려받기·공유·메일, 필터 결과 xlsx, Word 장비관리대장, 인쇄
 *  Word 는 카탈로그 안의 양식(ledger.docx)·사진으로 생성기와 같은 부품(EQ.DocBuilder)을 써서 만든다. */
(function (EQ) {
  'use strict';
  const cat = EQ.cat, { D, S } = cat, U = EQ.util, F = EQ.fmt;
  const CFG = EQ.CONFIG;
  const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const srcName = (D.source && D.source.name) || '장비관리대장.xlsx';

  function originalBlob() {
    if (!D.source || !D.source.b64) return null;
    return new Blob([U.b64ToBytes(D.source.b64)], { type: XLSX_MIME });
  }
  function original() {
    const b = originalBlob(); if (!b) { cat.toast('카탈로그에 원본 엑셀이 들어 있지 않습니다.'); return; }
    U.download(b, srcName); cat.toast(`${srcName} 내려받기`);
  }
  async function share() {
    const b = originalBlob(); if (!b) { cat.toast('원본 엑셀이 없습니다.'); return; }
    const file = new File([b], srcName, { type: XLSX_MIME });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: srcName, text: `시험장비 관리대장 (${D.records.length}대)` }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    cat.toast('이 브라우저는 파일 공유를 지원하지 않아 내려받기로 대신합니다.');
    original();
  }
  function mail() {
    original();
    const subj = encodeURIComponent(`[장비관리대장] ${srcName.replace(/\.xlsx?$/i, '')}`);
    const body = encodeURIComponent(`안녕하세요.\n시험장비 관리대장(장비 ${D.records.length}대)을 보내드립니다.\n\n※ 방금 내려받은 '${srcName}' 파일을 이 메일에 첨부해 주세요.\n`);
    setTimeout(() => { location.href = `mailto:?subject=${subj}&body=${body}`; }, 600);
  }

  async function filteredXlsx() {
    const L = S.list; if (!L.length) { cat.toast('보이는 장비가 없습니다.'); return; }
    const head = ['구분', '순번', '관리번호', '구입일련번호', '물품번호', '물품명', '물품명(외부 보고용)', '규격', '제조사', '제조국', '도입일', '수량', '도입가격(원)', '총액(원)', '사용 상태', '입고시 상태', '용도', '장소', '비고', '도입 회사명', '도입처 주소', '연락처', '주요 성능 및 특징', '구성 수'];
    const rows = [head, ...L.map(r => [r.sheet, r.seq, r.id, r.serial, r.item, r.name, r.nameExt, r.spec, r.maker, r.country, F.date(r.date, 'dash'), r.qty, r.price, r._total, r.status, r.cond, r.usage, r.place, r.remark, r.vendor, r.addr, r.tel, r.note, (r.comps || []).length])];
    const comp = [['관리번호', '물품명', '연번', '내용', '수량', '단위']];
    L.forEach(r => (r.comps || []).forEach((c, i) => comp.push([r.id, r.name, i + 1, c.n, c.q, c.u])));
    const blob = await EQ.xlsxWrite([
      { name: '장비목록', rows, widths: [8, 6, 13, 18, 18, 26, 22, 24, 18, 9, 11, 6, 14, 14, 9, 9, 22, 14, 18, 20, 30, 15, 50, 7] },
      { name: '장비구성', rows: comp, widths: [13, 26, 6, 40, 7, 7] },
      { name: '수리이력', rows: [['관리번호', '물품명', '연번', '일자', '내용', '담당자', '팀장'], ...L.flatMap(r => (r.hist || []).map((h, i) => [r.id, r.name, i + 1, h.d, h.c, h.m, h.l]))], widths: [13, 26, 6, 12, 50, 10, 10] },
    ]);
    U.download(blob, `장비목록_${L.length}대_${U.stamp()}.xlsx`); cat.toast(`장비 ${L.length}대를 엑셀로 저장했습니다.`);
  }

  /** dataURL 사진 → {bytes, ext, w, h, key} */
  async function photoOf(r) {
    const url = cat.image(r.ph); if (!url) return null;
    const m = /^data:image\/(\w+);base64,(.*)$/.exec(url); if (!m) return null;
    const bytes = U.b64ToBytes(m[2]);
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
    return { bytes, ext: m[1] === 'png' ? 'png' : 'jpg', w: img.naturalWidth, h: img.naturalHeight, key: r.ph };
  }
  async function wordFor(list, name) {
    if (!D.template) { cat.toast('카탈로그에 Word 양식이 없습니다.'); return; }
    if (!list.length) { cat.toast('보이는 장비가 없습니다.'); return; }
    cat.toast(`Word 문서를 만드는 중… (${list.length}대)`);
    try {
      const stamps = await EQ.DocBuilder.prepareStamps(cat.people());
      const b = await EQ.DocBuilder.create(D.template, { dateStyle: 'dot', stamps });
      for (const r of list) { b.append(r, await photoOf(r)); }
      const blob = await b.finish();
      U.download(blob, name || `시험장비관리대장_${list.length}대_${U.stamp()}.docx`);
      cat.toast(`Word 장비관리대장 ${list.length}대(${list.length * 2}쪽)를 저장했습니다.`);
    } catch (e) { console.error(e); cat.toast('Word 만들기 실패: ' + (e.message || e)); }
  }
  /* ---------- 편집 내용 확정: 통합 엑셀 / 관리대장 파일 ---------- */
  const CHUNK = 30000;   // 엑셀 한 칸 글자 한도(32,767) 아래로 나눠 담기
  function editSheets() {
    const compM = cat.mergedComps(), histM = cat.mergedHist(), people = cat.people();
    const idOf = {}; cat.R.forEach(r => { idOf[r.key] = idOf[r.key] || r.id; });
    (D.compIds || []).forEach(([k, id]) => { idOf[k] = idOf[k] || id; });
    (D.histIds || []).forEach(([k, id]) => { idOf[k] = idOf[k] || id; });
    const nameOf = {}; cat.R.forEach(r => { nameOf[r.key] = nameOf[r.key] || r.name; });
    const compRows = []; Object.entries(compM).forEach(([k, list]) => list.forEach((c, i) => compRows.push([idOf[k] || k, i + 1, c.n, /^\d+(\.\d+)?$/.test(c.q) ? +c.q : c.q, c.u])));
    const histRows = []; Object.entries(histM).forEach(([k, list]) => list.forEach((h, i) => histRows.push([idOf[k] || k, nameOf[k] || '', i + 1, h.d, h.c, h.m, h.l])));
    const nChunk = Math.max(1, ...people.map(p => Math.ceil((p.img || '').length / CHUNK)));
    const pRows = people.map(p => { const r = [p.role, p.name, p.start, p.note]; for (let i = 0; i < nChunk; i++) r.push((p.img || '').slice(i * CHUNK, (i + 1) * CHUNK)); return r; });
    const H = CFG.sheets;
    return [
      { name: D.compSheet || '장비구성', header: ['관리번호', '연번', '내용', '수량', '단위'], rows: compRows, widths: [18, 8, 60, 10, 9] },
      { name: H.historySheet, header: ['관리번호', '물품명', '연번', '일자', '내용', '담당자', '팀장'], rows: histRows, widths: [14, 28, 6, 12, 60, 10, 10] },
      { name: H.peopleSheet, header: ['구분', '성명', '사용시작일', '비고', ...Array.from({ length: nChunk }, (_, i) => CFG.peopleColumns.dataPrefix + (i + 1))], rows: pRows, widths: [8, 10, 12, 24] },
    ];
  }
  const datedName = () => { const n = srcName.replace(/\.xlsx?$/i, ''); return (/^\d{8}_/.test(n) ? U.stamp() + n.slice(8) : `${U.stamp()}_${n}`) + '.xlsx'; };
  async function integratedBlob() {
    if (!D.source || !D.source.b64) throw new Error('카탈로그에 원본 엑셀이 없습니다.');
    return EQ.xlsxPatch(U.b64ToBytes(D.source.b64), editSheets());
  }
  async function integrated() {
    try { const b = await integratedBlob(), n = datedName(); U.download(b, n); cat.toast(`${n} — 장비구성·수리이력·직인관리 반영. 다음 생성 때 이 파일을 쓰세요.`); }
    catch (e) { console.error(e); cat.toast('내보내기 실패: ' + (e.message || e)); }
  }
  /** 편집을 담은 새 관리대장(HTML) — 이 파일과 같은 틀에 새 데이터를 넣어 저장 */
  async function saveHtml() {
    try {
      const blob = await integratedBlob(), bytes = new Uint8Array(await blob.arrayBuffer()), sheets = editSheets();
      const shot = sp => ({ name: sp.name, header: sp.header, idCol: sp.header.indexOf('관리번호'),
        rows: sp.rows.map((r, i) => [i + 2, ...r.map(c => { c = String(c ?? ''); return c.length > 3000 && !/\s/.test(c) ? '(직인 그림 데이터)' : c; })]) });
      const view = (D.sheetsView || []).filter(v => !sheets.some(s => s.name === v.name)).concat(sheets.map(shot));
      const d = new Date(), z = n => String(n).padStart(2, '0');
      const nd = Object.assign({}, D, {
        docId: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        generated: `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`,
        source: { name: datedName(), size: bytes.length, b64: U.bytesToB64(bytes) },
        sheetsView: view, compsAll: cat.mergedComps(), histAll: cat.mergedHist(), people: cat.people(),
        records: D.records.map(r => { const o = {}; Object.keys(r).filter(k => k[0] !== '_').forEach(k => { o[k] = r[k]; }); o.comps = cat.compsOf(r.key); o.hist = cat.histOf(r.key); return o; }),
      });
      const payload = JSON.stringify(nd).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, c => '\\u' + c.charCodeAt(0).toString(16));
      const mods = [...document.querySelectorAll('script[data-eq]')].map(s => s.outerHTML).join('\n');
      const html = `<!DOCTYPE html>\n<html lang="ko">\n<head>${document.head.innerHTML}</head>\n<body>${window.EQ_SHELL}\n<script id="eq-data">window.EQ_DATA = ${payload};<\/script>\n${mods}\n</body>\n</html>`;
      const name = `${CFG.title.replace(/\s+/g, '_')}_${U.stamp()}.html`;
      U.download(new Blob([html], { type: 'text/html;charset=utf-8' }), name);
      cat.toast(`${name} 저장 — 고친 내용이 들어 있어 그대로 보내면 됩니다.`);
    } catch (e) { console.error(e); cat.toast('저장 실패: ' + (e.message || e)); }
  }
  function print() {
    if (S.view !== 'table') { S.view = 'table'; cat.syncView(); cat.apply(); }
    setTimeout(() => window.print(), 300);
  }

  const menu = document.getElementById('sendMenu'), btn = document.getElementById('btnSend');
  btn.onclick = e => { e.stopPropagation(); const on = !menu.classList.contains('show'); menu.classList.toggle('show', on); btn.setAttribute('aria-expanded', on); };
  document.addEventListener('click', e => { if (!menu.contains(e.target)) { menu.classList.remove('show'); btn.setAttribute('aria-expanded', false); } });
  menu.onclick = e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    menu.classList.remove('show');
    ({ share, mail, orig: original, xlsx: filteredXlsx, docx: () => wordFor(S.list), print, integrated, savehtml: saveHtml })[b.dataset.act]();
  };
  if (D.source && D.source.size) document.getElementById('origInfo').textContent = `${srcName} (${U.fmtBytes(D.source.size)}) — 이 카탈로그에 함께 저장됨`;
  cat.actions = { original, share, mail, filteredXlsx, wordFor, print, integrated, saveHtml, editSheets };
})(window.EQ = window.EQ || {});
