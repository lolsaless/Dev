/* [부품 S5] 간이 엑셀(.xlsx) 쓰기 — 카탈로그 '필터 결과 엑셀로 내보내기'용 (JSZip 필요)
 *  EQ.xlsxWrite([{name:'장비목록', rows:[[머리글...],[값...]], widths:[12,30,...]}]) → Promise<Blob>
 *  숫자는 숫자 셀, 나머지는 문자열(inlineStr). 첫 행은 굵게+자동필터+틀고정. */
(function (EQ) {
  'use strict';
  const xe = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const colName = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

  function sheetXml(rows, widths) {
    const w = Math.max(1, ...rows.map(r => r.length));
    const cols = (widths || []).map((cw, i) => `<col min="${i + 1}" max="${i + 1}" width="${cw}" customWidth="1"/>`).join('');
    const body = rows.map((r, ri) => `<row r="${ri + 1}">` + r.map((v, ci) => {
      const ref = colName(ci) + (ri + 1), st = ri === 0 ? ' s="1"' : ' s="2"';
      if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${ri === 0 ? st : ' s="3"'}><v>${v}</v></c>`;
      if (v == null || v === '') return '';
      return `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
    }).join('') + '</row>').join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
      + `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
      + (cols ? `<cols>${cols}</cols>` : '') + `<sheetData>${body}</sheetData>`
      + (rows.length > 1 ? `<autoFilter ref="A1:${colName(w - 1)}${rows.length}"/>` : '') + `</worksheet>`;
  }

  async function xlsxWrite(sheets) {
    const z = new JSZip();
    z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`
      + sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + `</Types>`);
    z.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
    z.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>`
      + sheets.map((s, i) => `<sheet name="${xe(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + `</sheets></workbook>`);
    z.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
      + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    z.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts><fonts count="2"><font><sz val="10"/><name val="맑은 고딕"/></font><font><b/><sz val="10"/><name val="맑은 고딕"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"><alignment vertical="center" wrapText="1"/></xf><xf applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="164" applyNumberFormat="1"><alignment vertical="top"/></xf></cellXfs></styleSheet>`);
    sheets.forEach((s, i) => z.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.rows, s.widths)));
    return z.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  EQ.xlsxWrite = xlsxWrite;
})(window.EQ = window.EQ || {});
