/* [부품 S6] 통합 엑셀 고쳐 쓰기 — 원본 xlsx 는 그대로 두고 지정한 시트의 '내용(sheetData)'만 바꾸거나 새 시트를 붙인다.
 *  다른 시트(장비대장·이관장비 등)의 서식·수식·필터는 손대지 않는다. (JSZip 필요)
 *  EQ.xlsxPatch(원본 Uint8Array, [{name, header:[..], rows:[[..]], widths:[..]}]) → Promise<Blob>
 *  - 이미 있는 시트: 머리글/본문 칸 서식(s)을 원래 시트의 1·2행에서 가져와 그대로 사용
 *  - 없는 시트: 맨 뒤에 새로 추가(머리글 고정·자동필터) */
(function (EQ) {
  'use strict';
  const xe = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const col = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

  function cellsXml(header, rows, hs, ds) {
    const all = [header, ...rows];
    return all.map((r, ri) => `<row r="${ri + 1}">` + r.map((v, ci) => {
      const ref = col(ci) + (ri + 1), st = ri === 0 ? hs[ci] : ds[ci], sa = st != null ? ` s="${st}"` : '';
      if (v == null || v === '') return st != null ? `<c r="${ref}"${sa}/>` : '';
      if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${sa}><v>${v}</v></c>`;
      return `<c r="${ref}"${sa} t="inlineStr"><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
    }).join('') + '</row>').join('');
  }
  /** 원래 시트에서 r행의 열별 서식 번호 */
  function rowStyles(xml, r, w) {
    const out = new Array(w).fill(null);
    const m = new RegExp(`<row [^>]*r="${r}"[^>]*>([\\s\\S]*?)</row>`).exec(xml); if (!m) return out;
    for (const c of m[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)\/?>/g)) {
      const s = /\ss="(\d+)"/.exec(c[2]); if (!s) continue;
      let i = 0; for (const ch of c[1]) i = i * 26 + ch.charCodeAt(0) - 64; i--;
      if (i < w) out[i] = s[1];
    }
    return out;
  }

  async function xlsxPatch(bytes, specs) {
    const z = await JSZip.loadAsync(bytes);
    let wbx = await z.file('xl/workbook.xml').async('string');
    let rels = await z.file('xl/_rels/workbook.xml.rels').async('string');
    let ct = await z.file('[Content_Types].xml').async('string');
    const sheetTags = [...wbx.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g)].map(m => ({ name: m[1].replace(/&amp;/g, '&'), rid: m[2] }));
    const target = rid => { const m = new RegExp(`<Relationship [^>]*Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels) || new RegExp(`<Relationship [^>]*Target="([^"]+)"[^>]*Id="${rid}"`).exec(rels); return m ? 'xl/' + m[1].replace(/^\/?xl\//, '') : null; };

    for (const sp of specs) {
      const w = Math.max(sp.header.length, ...sp.rows.map(r => r.length), 1);
      const last = col(w - 1) + (sp.rows.length + 1);
      const idx = sheetTags.findIndex(t => t.name === sp.name);
      if (idx >= 0) {
        const path = target(sheetTags[idx].rid); let xml = await z.file(path).async('string');
        const hs = rowStyles(xml, 1, w), ds = rowStyles(xml, 2, w);
        xml = xml.replace(/<sheetData\/>|<sheetData>[\s\S]*?<\/sheetData>/, `<sheetData>${cellsXml(sp.header, sp.rows, hs, ds)}</sheetData>`)
                 .replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:${last}"/>`)
                 .replace(/(<autoFilter [^>]*ref=")[^"]*"/, (m, g1) => `${g1}A1:${last}"`);
        z.file(path, xml);
        // 필터 범위 이름(_FilterDatabase) 갱신
        const ref = `${sp.name}!$A$1:$${col(w - 1)}$${sp.rows.length + 1}`;
        wbx = wbx.replace(new RegExp(`(<definedName name="_xlnm._FilterDatabase" localSheetId="${idx}"[^>]*>)[^<]*`), (m, g1) => g1 + ref);
      } else {
        let n = 1; while (z.file(`xl/worksheets/sheet${n}.xml`)) n++;
        const path = `xl/worksheets/sheet${n}.xml`;
        let rn = 1; while (new RegExp(`Id="rId${rn}"`).test(rels)) rn++;
        const sid = Math.max(0, ...[...wbx.matchAll(/sheetId="(\d+)"/g)].map(m => +m[1])) + 1;
        const cols = (sp.widths || []).map((cw, i) => `<col min="${i + 1}" max="${i + 1}" width="${cw}" customWidth="1"/>`).join('');
        z.file(path, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${MAIN}"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>`
          + (cols ? `<cols>${cols}</cols>` : '') + `<sheetData>${cellsXml(sp.header, sp.rows, [], [])}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`);
        wbx = wbx.replace('</sheets>', `<sheet name="${xe(sp.name)}" sheetId="${sid}" r:id="rId${rn}"/></sheets>`);
        rels = rels.replace('</Relationships>', `<Relationship Id="rId${rn}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/></Relationships>`);
        ct = ct.replace('</Types>', `<Override PartName="/${path}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
        sheetTags.push({ name: sp.name, rid: 'rId' + rn });
      }
    }
    z.file('xl/workbook.xml', wbx); z.file('xl/_rels/workbook.xml.rels', rels); z.file('[Content_Types].xml', ct);
    return z.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  EQ.xlsxPatch = xlsxPatch;
})(window.EQ = window.EQ || {});
