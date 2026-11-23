/* [부품 S2] 엑셀 읽기 — 통합 엑셀 → 장비 레코드 배열 (SheetJS 필요)
 *  입력 : ArrayBuffer(.xlsx)
 *  출력 : { sheetNames, ledgerSheets[], compSheet, read(sheetList) → {records, warnings} }
 *  규칙 : 열 이름 → 필드 대응은 config.json 의 columns / componentColumns (부품설계도 §3 참고) */
(function (EQ) {
  'use strict';
  const { normHdr, normKey } = EQ.util;
  const F = EQ.fmt;
  const CFG = EQ.CONFIG;

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
      const r = rows[i], id = str(r[ci]).trim(), n = oneLine(r[cn]);
      if (!id || !n) continue;
      const k = normKey(id); if (!map.has(k)) map.set(k, []);
      const sn = cs >= 0 ? parseFloat(r[cs]) : NaN;
      map.get(k).push({ n, q: cq >= 0 ? str(r[cq]).trim() : '', u: cu >= 0 ? str(r[cu]).trim() : '', _s: isNaN(sn) ? 1e6 + i : sn });
    }
    map.forEach(v => { v.sort((a, b) => a._s - b._s); v.forEach(c => delete c._s); });
    return map;
  }

  /** 엑셀 열기. 반환 객체로 시트 선택 후 read() */
  function open(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const names = wb.SheetNames;
    const ledgerSheets = names.filter(n => isLedgerSheet(wb, n));
    const compSheet = names.find(n => new RegExp(CFG.sheets.componentPattern, 'i').test(n) && !ledgerSheets.includes(n)) || '';
    return {
      wb, sheetNames: names, ledgerSheets, compSheet,
      defaultSheets: ledgerSheets.filter(n => CFG.sheets.defaultOn.includes(n)).length
        ? ledgerSheets.filter(n => CFG.sheets.defaultOn.includes(n)) : ledgerSheets.slice(0, 1),
      /** sheets: 읽을 장비 시트 목록, comp: 구성 시트 이름('' 이면 사용 안 함) */
      read(sheets, comp) {
        const warnings = [];
        let records = [];
        for (const s of sheets) records = records.concat(parseLedger(sheetRows(wb, s), s));
        const cm = comp ? parseComponents(sheetRows(wb, comp)) : new Map();
        records.forEach(r => { r.comps = (cm.get(r.key) || []).map(c => ({ ...c })); });
        const known = new Set(records.map(r => r.key));
        const orphan = [...cm.keys()].filter(k => !known.has(k));
        if (orphan.length) warnings.push(`장비구성 시트의 관리번호 중 선택한 시트에 없는 것: ${orphan.join(', ')}`);
        const over = records.filter(r => r.comps.length > CFG.form.comp.maxRows);
        if (over.length) warnings.push(`구성내역이 ${CFG.form.comp.maxRows}행을 넘는 장비(Word에는 앞 ${CFG.form.comp.maxRows}행만): ${over.map(r => r.id).join(', ')}`);
        return { records, warnings };
      },
      /** 카탈로그 '엑셀 보기'용: 모든 시트를 화면 표시 문자열 표로.
       *  [{name, header:[..], rows:[[엑셀행번호, 칸1, 칸2, ...]], idCol}]  (빈 행은 빼되 행 번호는 유지) */
      snapshot() {
        return names.map(n => {
          const all = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '', blankrows: true });
          const filled = all.map((r, i) => [i + 1, r.map(c => String(c))]).filter(([, r]) => r.some(c => c !== ''));
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
  EQ.excel = { open, colIdx };
})(window.EQ = window.EQ || {});
