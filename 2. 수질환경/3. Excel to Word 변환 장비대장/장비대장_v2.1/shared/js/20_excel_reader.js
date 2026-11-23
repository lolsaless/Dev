/* [부품 S2] 엑셀 읽기 — 통합 엑셀 → 장비 레코드 배열 (SheetJS 필요)
 *  입력 : ArrayBuffer(.xlsx)
 *  출력 : { sheetNames, ledgerSheets[], compSheet, read(sheetList) → {records, warnings} }
 *  규칙 : 열 이름 → 필드 대응은 config.json 의 columns / componentColumns (부품설계도 §3 참고) */
(function (EQ) {
  'use strict';
  const { normHdr, normKey } = EQ.util;
  const F = EQ.fmt;
  const CFG = EQ.CONFIG;

  const ID_OF = new Map();   // 정규화 키 → 엑셀에 적힌 관리번호
  const str = v => (v == null ? '' : (v instanceof Date ? F.iso(v) : String(v)));
  const oneLine = s => str(s).replace(/\s*\n\s*/g, ' ').trim();

  function sheetRows(wb, name) {
    const ws = wb.Sheets[name];
    return ws ? XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) : [];
  }
  function headerRow(rows) { return rows.findIndex(r => r.some(c => normHdr(c) === '관리번호')); }

  /** 머리글 배열에서 별칭 목록과 같은 열 번호. pick=last 면 마지막 일치 */
  function colIdx(hdr, aliases, pick) {
    const keys = aliases.map(normHdr); let found = -1;
    for (let i = 0; i < hdr.length; i++) if (keys.includes(hdr[i])) { found = i; if (pick !== 'last') return i; }
    return found;
  }

  function isLedgerSheet(wb, name) {
    if (new RegExp(CFG.sheets.exclude, 'i').test(name)) return false;
    const rows = sheetRows(wb, name), hi = headerRow(rows);
    if (hi < 0) return false;
    const hdr = rows[hi].map(normHdr);
    return colIdx(hdr, CFG.columns.name.aliases) >= 0;
  }

  function parseLedger(rows, sheetName) {
    const hi = headerRow(rows);
    if (hi < 0) throw new Error(`[${sheetName}] '관리번호' 열을 찾지 못했습니다.`);
    const hdr = rows[hi].map(normHdr);
    const C = {};
    for (const [field, def] of Object.entries(CFG.columns)) C[field] = colIdx(hdr, def.aliases, def.pick);
    // 날짜는 별칭 순서대로 첫 번째로 값이 있는 열을 쓴다
    const dateCols = CFG.columns.date.aliases.map(a => colIdx(hdr, [a])).filter(i => i >= 0);
    const miss = Object.entries(CFG.columns).filter(([f, d]) => d.required && C[f] < 0).map(([, d]) => d.aliases[0]);
    if (miss.length) throw new Error(`[${sheetName}] 필수 열이 없습니다: ${miss.join(', ')}`);
    const get = (r, f) => (C[f] >= 0 ? r[C[f]] : '');
    const out = [];
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i], id = str(get(r, 'id')).trim();
      if (!id) continue;
      const dRaw = dateCols.map(c => r[c]).find(v => v !== '' && v != null);
      const qty = F.num(get(r, 'qty'));
      out.push({
        uid: `${sheetName}#${i + 1}`, sheet: sheetName, row: i + 1,
        seq: str(get(r, 'seq')).trim(), id, key: normKey(id),
        serial: str(get(r, 'serial')).trim(), item: str(get(r, 'item')).trim(),
        name: oneLine(get(r, 'name')), nameExt: oneLine(get(r, 'nameExt')),
        spec: str(get(r, 'spec')).trim(), maker: str(get(r, 'maker')).trim(), country: str(get(r, 'country')).trim(),
        date: F.iso(dRaw), year: (F.dateParts(dRaw) || {}).y || (F.num(get(r, 'year')) || null),
        qty: qty && qty > 0 ? qty : 1, price: F.num(get(r, 'price')),
        status: str(get(r, 'status')).trim(), usage: str(get(r, 'usage')).trim(),
        remark: str(get(r, 'remark')).trim(), place: str(get(r, 'place')).trim(),
        vendor: str(get(r, 'vendor')).trim(), addr: str(get(r, 'addr')).trim(), tel: str(get(r, 'tel')).trim(),
        telNote: str(get(r, 'telNote')).trim(), cond: str(get(r, 'cond')).trim(),
        note: str(get(r, 'note')).replace(/\s+$/, ''),
        outDate: F.iso(get(r, 'outDate')), inDate: F.iso(get(r, 'inDate')),
        comps: [],
      });
    }
    return out;
  }

  function parseComponents(rows) {
    const map = new Map(); if (!rows.length) return map;
    const hi = headerRow(rows); if (hi < 0) throw new Error("장비구성 시트에서 '관리번호' 열을 찾지 못했습니다.");
    const hdr = rows[hi].map(normHdr), CC = CFG.componentColumns;
    const ci = colIdx(hdr, CC.id), cn = colIdx(hdr, CC.name), cq = colIdx(hdr, CC.qty), cu = colIdx(hdr, CC.unit), cs = colIdx(hdr, CC.seq);
    if (cn < 0) throw new Error("장비구성 시트에서 구성품 이름 열('내용' 또는 '장비명')을 찾지 못했습니다.");
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i], id = str(r[ci]).trim(), n = str(r[cn]).replace(/\r/g, '').split('\n').map(x => x.trim()).filter(Boolean).join('\n');
      if (!id || !n) continue;
      const k = normKey(id); if (!map.has(k)) map.set(k, []); ID_OF.set(k, ID_OF.get(k) || id);
      const sn = cs >= 0 ? parseFloat(r[cs]) : NaN;
      map.get(k).push({ n, q: cq >= 0 ? str(r[cq]).trim() : '', u: cu >= 0 ? str(r[cu]).trim() : '', _s: isNaN(sn) ? 1e6 + i : sn });
    }
    map.forEach(v => { v.sort((a, b) => a._s - b._s); v.forEach(c => delete c._s); });
    return map;
  }

  /** 수리이력 시트 → Map(관리번호키 → [{d 일자ISO, c 내용, m 담당자, l 팀장}]) */
  function parseHistory(rows) {
    const map = new Map(); const hi = headerRow(rows); if (hi < 0) return map;
    const hdr = rows[hi].map(normHdr), HC = CFG.historyColumns;
    const ci = colIdx(hdr, HC.id), cs = colIdx(hdr, HC.seq), cd = colIdx(hdr, HC.date), cc = colIdx(hdr, HC.content), cm = colIdx(hdr, HC.manager), cl = colIdx(hdr, HC.leader);
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i], id = str(r[ci]).trim(); if (!id) continue;
      const h = { d: F.iso(r[cd]) || str(r[cd]).trim(), c: cc >= 0 ? str(r[cc]).trim() : '', m: cm >= 0 ? str(r[cm]).trim() : '', l: cl >= 0 ? str(r[cl]).trim() : '' };
      if (!h.d && !h.c) continue;
      const k = normKey(id); if (!map.has(k)) map.set(k, []); ID_OF.set(k, ID_OF.get(k) || id);
      const sn = cs >= 0 ? parseFloat(r[cs]) : NaN; h._s = isNaN(sn) ? 1e6 + i : sn; map.get(k).push(h);
    }
    map.forEach(v => { v.sort((a, b) => a._s - b._s); v.forEach(h => delete h._s); });
    return map;
  }
  /** 직인관리 시트 → [{role, name, start, note, img(dataURL)}]  직인 그림은 '직인데이터1,2,…' 칸에 나눠 저장된 글자 */
  function parsePeople(rows) {
    const out = []; if (!rows.length) return out;
    const hi = rows.findIndex(r => r.some(c => CFG.peopleColumns.name.map(normHdr).includes(normHdr(c)))); if (hi < 0) return out;
    const hdr = rows[hi].map(normHdr), PC = CFG.peopleColumns;
    const cr = colIdx(hdr, PC.role), cn = colIdx(hdr, PC.name), cs = colIdx(hdr, PC.start), cn2 = colIdx(hdr, PC.note);
    const dataCols = hdr.map((h, i) => [h, i]).filter(([h]) => h.startsWith(normHdr(PC.dataPrefix)))
      .sort((a, b) => (parseInt(a[0].replace(/\D/g, '')) || 0) - (parseInt(b[0].replace(/\D/g, '')) || 0)).map(([, i]) => i);
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i], name = str(r[cn]).trim(); if (!name) continue;
      const img = dataCols.map(c => str(r[c])).join('').trim();
      out.push({ role: str(r[cr]).trim() || CFG.roles[0], name, start: F.iso(r[cs]) || str(r[cs]).trim(), note: cn2 >= 0 ? str(r[cn2]).trim() : '',
                 img: /^data:image\//.test(img) ? img : '' });
    }
    return out;
  }
  const sheetOrder = n => { const i = CFG.sheets.order.indexOf(n); return i < 0 ? 50 : i; };

  /** 엑셀 열기. 반환 객체로 시트 선택 후 read() */
  function open(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const names = wb.SheetNames;
    const ledgerSheets = names.filter(n => isLedgerSheet(wb, n)).sort((a, b) => sheetOrder(a) - sheetOrder(b));
    const compSheet = names.find(n => new RegExp(CFG.sheets.componentPattern, 'i').test(n) && !ledgerSheets.includes(n)) || '';
    const histSheet = names.find(n => n === CFG.sheets.historySheet) || '';
    const peopleSheet = names.find(n => n === CFG.sheets.peopleSheet) || '';
    const on = ledgerSheets.filter(n => CFG.sheets.defaultOn.includes(n));
    return {
      wb, sheetNames: names, ledgerSheets, compSheet, histSheet, peopleSheet,
      defaultSheets: on.length ? on : ledgerSheets.slice(0, 1),
      /** 장비 시트별 행 수(중복 제거 전) */
      count: n => parseLedger(sheetRows(wb, n), n).length,
      /** sheets: 읽을 장비 시트 목록, comp: 구성 시트 이름('' 이면 사용 안 함)
       *  반환 {records, warnings, compsAll(Map), histAll(Map), people[]} — records 는 시트 순서(config.sheets.order)대로 */
      read(sheets, comp) {
        const warnings = [];
        const ordered = sheets.slice().sort((a, b) => sheetOrder(a) - sheetOrder(b));
        let records = [];
        for (const s of ordered) records = records.concat(parseLedger(sheetRows(wb, s), s));
        // 이관 시트에 있는 장비는 다른 시트에서 뺀다 (같은 관리번호, 구입일련번호가 둘 다 있으면 그것까지 같을 때)
        const T = CFG.sheets.transfer;
        if (ordered.includes(T)) {
          const moved = records.filter(r => r.sheet === T);
          const dropped = records.filter(r => r.sheet !== T && moved.some(m => m.key === r.key && (!m.serial || !r.serial || m.serial === r.serial)));
          if (dropped.length) {
            records = records.filter(r => !dropped.includes(r));
            warnings.push(`${T} 시트에도 있어 다른 시트에서 뺀 장비: ${dropped.map(r => `${r.id}(${r.sheet} ${r.row}행)`).join(', ')}`);
          }
        }
        const cm = comp ? parseComponents(sheetRows(wb, comp)) : new Map();
        const hm = histSheet ? parseHistory(sheetRows(wb, histSheet)) : new Map();
        const people = peopleSheet ? parsePeople(sheetRows(wb, peopleSheet)) : [];
        records.forEach(r => { r.comps = (cm.get(r.key) || []).map(c => ({ ...c })); r.hist = (hm.get(r.key) || []).map(h => ({ ...h })); });
        const known = new Set(records.map(r => r.key));
        const orphan = [...cm.keys()].filter(k => !known.has(k));
        if (orphan.length) warnings.push(`장비구성 시트의 관리번호 중 선택한 시트에 없는 것: ${orphan.join(', ')}`);
        const over = records.filter(r => r.comps.length > CFG.form.comp.maxRows);
        if (over.length) warnings.push(`구성내역이 ${CFG.form.comp.maxRows}행을 넘는 장비(Word에는 앞 ${CFG.form.comp.maxRows}행만): ${over.map(r => r.id).join(', ')}`);
        return { records, warnings, compsAll: cm, histAll: hm, people, compSheet: comp, idOf: new Map(ID_OF) };
      },
      /** 카탈로그 '엑셀 보기'용: 모든 시트를 화면 표시 문자열 표로.
       *  [{name, header:[..], rows:[[엑셀행번호, 칸1, 칸2, ...]], idCol}]  (빈 행은 빼되 행 번호는 유지) */
      snapshot() {
        return names.map(n => {
          const all = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '', blankrows: true });
          const filled = all.map((r, i) => [i + 1, r.map(c => { c = String(c); return /^data:image\//.test(c) || (c.length > 3000 && !/\s/.test(c)) ? '(직인 그림 데이터)' : c; })]).filter(([, r]) => r.some(c => c !== ''));
          if (!filled.length) return { name: n, header: [], rows: [], idCol: -1 };
          let w = 0; filled.forEach(([, r]) => { for (let i = r.length - 1; i >= 0; i--) if (r[i] !== '') { w = Math.max(w, i + 1); break; } });
          const [, head] = filled[0];
          const header = Array.from({ length: w }, (_, i) => head[i] || '');
          return { name: n, header, idCol: header.findIndex(h => normHdr(h) === '관리번호'),
                   rows: filled.slice(1).map(([no, r]) => [no, ...Array.from({ length: w }, (_, i) => r[i] || '')]) };
        });
      },
    };
  }
  EQ.excel = { open, colIdx, sheetOrder };
})(window.EQ = window.EQ || {});
