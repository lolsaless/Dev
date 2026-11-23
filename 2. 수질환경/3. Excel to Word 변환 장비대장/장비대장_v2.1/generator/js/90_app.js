/* [부품 G9] 생성기 화면 연결 — 엑셀·사진 받기, 시트 선택, 대상 표, 실행(Word·카탈로그·사진 ZIP)
 *  계산은 모두 부품(EQ.excel / EQ.match / EQ.img / EQ.DocBuilder / EQ.pack)에 맡기고 여기서는 순서만 정한다. */
(function (EQ) {
  'use strict';
  const U = EQ.util, CFG = EQ.CONFIG, { esc } = U;
  const $ = id => document.getElementById(id);
  const S = { book: null, srcFile: null, srcBytes: null, sheets: [], records: [], imgIndex: [], photoCache: new Map(), results: new Map(), lastPhotos: [] };

  const log = (m, c) => { const d = document.createElement('div'); if (c) d.className = c; d.textContent = m; $('log').appendChild(d); $('log').scrollTop = 1e9; };
  const msg = (id, html, c) => { $(id).innerHTML = html ? `<div class="msg ${c || ''}">${html}</div>` : ''; };
  const bar = p => { $('barFill').style.width = Math.max(0, Math.min(100, p)) + '%'; };
  $('ver').textContent = CFG.version;
  $('optLimit').value = CFG.image.limitKB; $('optTarget').value = CFG.image.targetKB;

  /* ---------- 1. 엑셀 ---------- */
  async function loadExcel(file) {
    try {
      msg('xlsxMsg', '');
      const buf = await file.arrayBuffer();
      S.book = EQ.excel.open(buf); S.srcFile = file; S.srcBytes = new Uint8Array(buf);
      $('xlsxName').textContent = file.name; $('dropXlsx').classList.add('done');
      S.sheets = S.book.defaultSheets.slice();
      $('selComp').innerHTML = `<option value="">(사용 안 함 — 구성내역 빈 칸)</option>` + S.book.sheetNames.map(n => `<option ${n === S.book.compSheet ? 'selected' : ''}>${esc(n)}</option>`).join('');
      $('sheetPick').hidden = false;
      rebuild();
    } catch (e) { msg('xlsxMsg', '엑셀을 읽지 못했습니다: ' + esc(e.message), 'err'); }
  }
  function renderSheetChips() {
    $('sheetChips').innerHTML = S.book.ledgerSheets.map(n => {
      let c = 0; try { c = S.book.count(n); } catch (_) {}
      return `<button class="chip" data-sheet="${esc(n)}" aria-pressed="${S.sheets.includes(n)}">${esc(n)} <small>${c}대</small></button>`;
    }).join('') || '<span class="hint">관리번호·물품명 열이 있는 시트를 찾지 못했습니다.</span>';
  }
  function rebuild() {
    if (!S.book) return;
    renderSheetChips();
    try {
      const res = S.book.read(S.sheets, $('selComp').value), { records, warnings } = res;
      S.records = records; S.extra = res;
      const withComp = records.filter(r => r.comps.length).length;
      const notes = [...warnings];
      if (!$('selComp').value) notes.unshift('장비구성 시트를 고르지 않아 구성내역은 빈 칸으로 만들어집니다.');
      msg('xlsxMsg', `장비 <b>${records.length}대</b> (${S.sheets.join(' · ') || '시트 없음'}) · 구성내역 있는 장비 <b>${withComp}대</b> · 수리 이력 <b>${records.reduce((n, r) => n + r.hist.length, 0)}건</b> · 직인 등록 <b>${res.people.length}명</b>` + (notes.length ? '<br>' + notes.map(esc).join('<br>') : ''), notes.length ? 'warn' : 'ok');
    } catch (e) { S.records = []; msg('xlsxMsg', esc(e.message), 'err'); }
    S.results.clear(); matchImages(); renderTable();
  }
  $('sheetChips').onclick = e => {
    const b = e.target.closest('[data-sheet]'); if (!b) return;
    const n = b.dataset.sheet; S.sheets = S.sheets.includes(n) ? S.sheets.filter(x => x !== n) : [...S.sheets, n];
    S.sheets.sort((a, b) => S.book.ledgerSheets.indexOf(a) - S.book.ledgerSheets.indexOf(b)); rebuild();
  };
  $('selComp').onchange = rebuild;

  /* ---------- 2. 사진 ---------- */
  function setImages(files) {
    S.imgIndex = EQ.match.index(files);
    const skip = [...files].length - S.imgIndex.length;
    $('imgName').textContent = `사진 ${S.imgIndex.length}장 선택됨` + (skip ? ` (이미지 아닌 파일 ${skip}개 제외)` : '');
    $('dropImg').classList.toggle('done', S.imgIndex.length > 0);
    S.photoCache.clear(); S.results.clear(); matchImages(); renderTable();
  }
  function matchImages() {
    S.records.forEach(r => { r.img = S.imgIndex.length ? EQ.match.find(r, S.imgIndex) : null; });
    if (!S.imgIndex.length) { msg('imgMsg', ''); return; }
    const used = new Set(S.records.filter(r => r.img).map(r => r.img.entry.name));
    const miss = S.records.filter(r => !r.img), unused = S.imgIndex.filter(i => !used.has(i.name));
    let h = `장비 ${S.records.length}대 중 사진 연결 <b>${S.records.length - miss.length}대</b>`;
    if (miss.length) h += ` · 사진 없는 장비 ${miss.length}대: ${miss.slice(0, 12).map(r => esc(r.id)).join(', ')}${miss.length > 12 ? ' …' : ''}`;
    if (unused.length) h += `<br>연결되지 않은 사진 ${unused.length}장: ${unused.slice(0, 8).map(i => esc(i.name)).join(', ')}${unused.length > 8 ? ' …' : ''}`;
    msg('imgMsg', h, miss.length || unused.length ? 'warn' : 'ok');
  }
  async function getPhoto(rec) {
    if (!rec.img) return null;
    const e = rec.img.entry, k = e.name + '|' + e.file.size;
    if (!S.photoCache.has(k)) S.photoCache.set(k, EQ.img.process(e.file, { limitKB: +$('optLimit').value, targetKB: +$('optTarget').value, maxEdge: CFG.image.maxEdge })
      .then(p => Object.assign(p, { key: k })).catch(err => ({ error: err.message || String(err) })));
    return S.photoCache.get(k);
  }

  /* ---------- 4. 대상 표 ---------- */
  function notePreview(r) {
    const N = CFG.form.note, f = EQ.fit.fit(r.note, N.w, N.h - N.labelH, N.max, N.min);
    if (!r.note) return '<span class="b">-</span>';
    return f.fits ? (f.size < N.max ? `<span class="b warn" title="${f.lines}줄">${f.size}pt 축소</span>` : `<span class="b ok">${f.size}pt</span>`) : `<span class="b err" title="${f.lines}줄">넘침 위험</span>`;
  }
  function renderTable() {
    const tb = $('tbl').querySelector('tbody'), q = U.normKey($('q').value), onlyNo = $('chkNoPhoto').checked;
    const dup = {}; S.records.forEach(r => { dup[r.key] = (dup[r.key] || 0) + 1; });
    tb.innerHTML = S.records.map((r, i) => {
      if (q && !U.normKey(r.id + r.name).includes(q)) return '';
      if (onlyNo && r.img) return '';
      const ph = r.img ? `<span class="b ok" title="${esc(r.img.entry.name)}">${esc(r.img.entry.name.length > 22 ? r.img.entry.name.slice(0, 20) + '…' : r.img.entry.name)}</span>` : (S.imgIndex.length ? '<span class="b warn">없음</span>' : '<span class="b">-</span>');
      return `<tr><td><input type="checkbox" data-i="${i}" ${r.sel === false ? '' : 'checked'}></td><td>${esc(r.sheet)}</td><td>${esc(r.seq)}</td>
        <td>${esc(r.id)}${dup[r.key] > 1 ? ' <span class="b">중복번호</span>' : ''}</td><td class="w">${esc(r.name)}</td><td>${ph}</td>
        <td>${r.comps.length || '-'}</td><td>${r.hist.length || '-'}</td><td>${notePreview(r)}</td><td class="w hint">${esc(S.results.get(r.uid) || '')}</td></tr>`;
    }).join('');
    const n = S.records.filter(r => r.sel !== false).length;
    $('cnt').textContent = `${n} / ${S.records.length}대 선택`;
    $('btnRun').disabled = $('btnCat').disabled = !n;
  }
  $('tbl').onchange = e => { const i = e.target.dataset && e.target.dataset.i; if (i != null) { S.records[+i].sel = e.target.checked; renderTable(); } };
  $('chkAll').onchange = e => { S.records.forEach(r => { r.sel = e.target.checked; }); renderTable(); };
  $('q').oninput = renderTable; $('chkNoPhoto').onchange = renderTable;

  /* ---------- 5. 실행 ---------- */
  async function gather(sel, share) {
    const photos = [], stat = { photo: 0, none: 0, conv: 0, err: 0 }, seen = new Set();
    S.lastPhotos = [];
    for (let k = 0; k < sel.length; k++) {
      const r = sel[k]; $('runState').textContent = `사진 처리 ${k + 1}/${sel.length}`;
      let ph = await getPhoto(r);
      if (ph && ph.error) { log(`[${r.id}] 사진 오류: ${r.img.entry.name} — ${ph.error}`, 'e'); stat.err++; S.results.set(r.uid, '사진 오류'); ph = null; }
      else if (ph) {
        stat.photo++; if (/→/.test(ph.note)) stat.conv++;
        if (!seen.has(ph.key)) { seen.add(ph.key); log(`[${r.id}] ${r.img.entry.name}: ${ph.note}`, /목표 초과/.test(ph.note) ? 'w' : ''); S.lastPhotos.push({ name: U.safeName(r.id) + '.' + ph.ext, bytes: ph.bytes }); }
        S.results.set(r.uid, ph.note);
      } else stat.none++;
      photos.push(ph);
      bar((k + 1) / sel.length * share); if (k % 3 === 0) await U.sleep(0);
    }
    return { photos, stat };
  }
  async function catalogHtml(sel, photos, from, span) {
    log('관리대장(HTML) 만드는 중…');
    return EQ.pack.build({
      records: sel, photos, templateB64: TEMPLATE_B64,
      source: { name: S.srcFile.name, bytes: S.srcBytes }, snapshot: S.book.snapshot(),
      extra: S.extra, thumbEdge: +$('optThumb').value, thumbQuality: CFG.catalog.thumbQuality,
      onProgress: (k, n) => bar(from + k / n * span),
    });
  }
  function lock(on) { $('btnRun').disabled = $('btnCat').disabled = on; if (on) $('btnPhotos').disabled = true; }

  async function run(catalogOnly) {
    const sel = S.records.filter(r => r.sel !== false); if (!sel.length) return;
    lock(true); $('log').textContent = ''; bar(0);
    const t0 = performance.now(), withCat = catalogOnly || $('optCatalog').checked, mode = $('optMode').value;
    try {
      log(`선택 ${sel.length}대 — ${catalogOnly ? '관리대장(HTML)만' : (mode === 'zip' ? '장비별 Word→ZIP' : '하나의 Word 파일') + (withCat ? ' + 관리대장(HTML)' : '')}`);
      const { photos, stat } = await gather(sel, 40);
      const cat = withCat ? await catalogHtml(sel, photos, 40, 20) : null;
      if (!catalogOnly) {
        const shrunk = [], stamps = await EQ.DocBuilder.prepareStamps(S.extra.people);
        const dup = {}; sel.forEach(r => { dup[r.key] = (dup[r.key] || 0) + 1; });
        if (mode === 'single') {
          const b = await EQ.DocBuilder.create(TEMPLATE_B64, { dateStyle: $('optDate').value, stamps });
          for (let k = 0; k < sel.length; k++) {
            const w = b.append(sel[k], photos[k]); if (w.length) shrunk.push([sel[k], w]);
            $('runState').textContent = `문서 작성 ${k + 1}/${sel.length}`; bar(60 + (k + 1) / sel.length * 35); if (k % 5 === 0) await U.sleep(0);
          }
          const blob = await b.finish(), name = `시험장비관리대장_${U.stamp()}.docx`;
          U.download(blob, name); log(`완료: ${name} (${U.fmtBytes(blob.size)}, ${sel.length}대 × 2쪽 = ${sel.length * 2}쪽)`, 'o');
          if (cat) { await U.sleep(800); const cn = `${CFG.title.replace(/\s+/g, '_')}_${U.stamp()}.html`; U.download(new Blob([cat], { type: 'text/html;charset=utf-8' }), cn); log(`완료: ${cn} (${U.fmtBytes(cat.length)})`, 'o'); }
        } else {
          const z = new JSZip(), used = new Set();
          for (let k = 0; k < sel.length; k++) {
            const r = sel[k], b = await EQ.DocBuilder.create(TEMPLATE_B64, { dateStyle: $('optDate').value, stamps });
            const w = b.append(r, photos[k]); if (w.length) shrunk.push([r, w]);
            let nm = U.safeName(r.id) + (dup[r.key] > 1 ? '_' + (r.seq || r.row) : '') + '_' + U.safeName(r.name).slice(0, 30).trim().replace(/[. ]+$/, '');
            while (used.has(nm)) nm += '_x'; used.add(nm);
            z.file(nm + '.docx', await b.finish());
            bar(60 + (k + 1) / sel.length * 35); if (k % 2 === 0) await U.sleep(0);
          }
          if (cat) z.file(`${CFG.title.replace(/\s+/g, '_')}.html`, cat);
          const zb = await z.generateAsync({ type: 'blob', compression: 'STORE' }), name = `시험장비관리대장_개별_${U.stamp()}.zip`;
          U.download(zb, name); log(`완료: ${name} (${U.fmtBytes(zb.size)}, Word ${sel.length}개${cat ? ' + 관리대장(HTML)' : ''})`, 'o');
        }
        shrunk.forEach(([r, w]) => { log(`[${r.id}] ${w.join(' / ')}`, /넘칠|넘을/.test(w.join()) ? 'e' : 'w'); });
      } else {
        const cn = `${CFG.title.replace(/\s+/g, '_')}_${U.stamp()}.html`; U.download(new Blob([cat], { type: 'text/html;charset=utf-8' }), cn); log(`완료: ${cn} (${U.fmtBytes(cat.length)})`, 'o');
      }
      bar(100);
      log(`사진 반영 ${stat.photo}대 · 사진 없음 ${stat.none}대 · 변환/축소 ${stat.conv}대 · 오류 ${stat.err}건 · ${((performance.now() - t0) / 1000).toFixed(1)}초`);
      $('runState').textContent = '완료'; $('btnPhotos').disabled = !S.lastPhotos.length;
    } catch (e) { console.error(e); log('오류: ' + (e.message || e), 'e'); $('runState').textContent = '오류'; }
    finally { lock(false); renderTable(); }
  }
  $('btnRun').onclick = () => run(false);
  $('btnCat').onclick = () => run(true);
  $('btnPhotos').onclick = async () => {
    const z = new JSZip(); S.lastPhotos.forEach(p => z.file(p.name, p.bytes));
    U.download(await z.generateAsync({ type: 'blob', compression: 'STORE' }), `변환된사진_${U.stamp()}.zip`);
  };
  ['optLimit', 'optTarget'].forEach(id => $(id).addEventListener('change', () => S.photoCache.clear()));

  /* ---------- 끌어다 놓기 (폴더 포함) ---------- */
  async function walkHandle(h, out) { if (h.kind === 'file') { out.push(await h.getFile()); return; } for await (const [, c] of h.entries()) await walkHandle(c, out); }
  async function walkEntry(en, out) {
    if (en.isFile) { await new Promise(res => en.file(f => { out.push(f); res(); }, res)); return; }
    if (!en.isDirectory) return;
    const rd = en.createReader();
    for (;;) { const b = await new Promise(res => rd.readEntries(res, () => res([]))); if (!b.length) break; for (const c of b) await walkEntry(c, out); }
  }
  /** DataTransfer 는 await 뒤에 비워지므로 핸들·엔트리를 먼저 모두 확보 */
  async function filesFromDrop(dt) {
    const jobs = [...(dt.items || [])].filter(i => i.kind === 'file').map(i => ({
      h: i.getAsFileSystemHandle ? i.getAsFileSystemHandle().catch(() => null) : null,
      en: i.webkitGetAsEntry ? i.webkitGetAsEntry() : null, f: i.getAsFile ? i.getAsFile() : null }));
    const plain = [...(dt.files || [])], out = [];
    for (const j of jobs) {
      const got = [];
      try { const h = j.h ? await j.h : null; if (h) await walkHandle(h, got); } catch (_) {}
      if (!got.length && j.en) { try { await walkEntry(j.en, got); } catch (_) {} }
      if (!got.length && j.f && (j.f.size > 0 || j.f.type)) got.push(j.f);
      out.push(...got);
    }
    return out.length ? out : plain.filter(f => f.size > 0 || f.type);
  }
  const isXlsx = f => /\.(xlsx|xlsm|xls)$/i.test(f.name);
  ['dragenter', 'dragover'].forEach(ev => window.addEventListener(ev, e => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; }));
  window.addEventListener('drop', async e => {
    e.preventDefault(); ['dropXlsx', 'dropImg'].forEach(id => $(id).classList.remove('on'));
    const zone = e.target.closest ? e.target.closest('#dropXlsx,#dropImg') : null;
    const files = await filesFromDrop(e.dataTransfer);
    if (!files.length) { log('끌어다 놓은 항목에서 파일을 읽지 못했습니다. 영역을 클릭해 직접 선택해 주세요.', 'w'); return; }
    const xl = files.filter(isXlsx), im = files.filter(EQ.match.isImage);
    if (xl.length && (!zone || zone.id === 'dropXlsx')) await loadExcel(xl[0]);
    if (im.length && (!zone || zone.id === 'dropImg')) setImages(im);
  });
  ['dropXlsx', 'dropImg'].forEach(id => { const z = $(id); z.addEventListener('dragenter', () => z.classList.add('on')); z.addEventListener('dragleave', ev => { if (!z.contains(ev.relatedTarget)) z.classList.remove('on'); }); });
  const pick = (zone, input, fn) => { $(zone).onclick = () => $(input).click(); $(zone).onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $(input).click(); } }; $(input).onchange = () => { if ($(input).files.length) fn($(input).files); $(input).value = ''; }; };
  pick('dropXlsx', 'fileXlsx', fl => loadExcel(fl[0]));
  pick('dropImg', 'fileImgDir', setImages);
  $('btnImgFiles').onclick = () => $('fileImgFiles').click();
  $('fileImgFiles').onchange = e => { if (e.target.files.length) setImages(e.target.files); e.target.value = ''; };

  if (typeof createImageBitmap !== 'function') log('※ 이 브라우저는 사진 변환을 지원하지 않습니다. 최신 Chrome/Edge를 사용하세요.', 'e');
  EQ.app = { S, loadExcel, setImages, run };    // 시험용
})(window.EQ = window.EQ || {});
