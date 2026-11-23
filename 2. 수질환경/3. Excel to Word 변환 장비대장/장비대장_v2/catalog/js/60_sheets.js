/* [부품 C6] 엑셀 원본 보기 — 카탈로그에 함께 저장된 원본 엑셀의 모든 시트를 표로 보여줌
 *  시트 탭, 찾기(일치 행 강조), 줄바꿈 켜기/끄기, 관리번호 칸 클릭 → 장비 상세 */
(function (EQ) {
  'use strict';
  const cat = EQ.cat, { D } = cat, { esc } = EQ.util;
  const $ = id => document.getElementById(id);
  const SV = D.sheetsView || [];
  let cur = 0, focusRow = null;
  const ledgerSet = new Set(cat.R.map(r => r.sheet));

  function renderTabs() {
    $('sheetTabs').innerHTML = SV.map((s, i) => `<button class="chip" data-si="${i}" aria-pressed="${i === cur}">${esc(s.name)}<span class="c">${s.rows.length}</span></button>`).join('');
  }
  function render() {
    renderTabs();
    const s = SV[cur];
    if (!s) { $('sheetTable').innerHTML = '<div class="empty"><b>원본 엑셀 내용이 없습니다</b></div>'; return; }
    const q = cat.norm($('sheetQ').value), linkable = ledgerSet.has(s.name) && s.idCol >= 0;
    let hits = 0;
    const body = s.rows.map(row => {
      const [no, ...cells] = row;
      const hit = q && cells.some(c => cat.norm(c).includes(q)); if (hit) hits++;
      const cls = (no === focusRow ? 'focus ' : '') + (hit ? 'hit' : '');
      return `<tr class="${cls}" data-row="${no}"><td class="rn">${no}</td>` + cells.map((c, i) => {
        const t = q ? cat.hl(c, [q]) : esc(c);
        return linkable && i === s.idCol && c ? `<td class="link" data-uid="${esc(s.name + '#' + no)}" title="장비 상세 보기">${t}</td>` : `<td title="${c.length > 40 ? esc(c) : ''}">${t}</td>`;
      }).join('') + '</tr>';
    }).join('');
    $('sheetTable').innerHTML = `<table class="x ${$('sheetWrap').checked ? 'wrap' : 'nowrap'}"><thead><tr><th class="rn">행</th>${s.header.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
    $('sheetMeta').textContent = `‘${s.name}’ 시트 · ${s.rows.length}행 × ${s.header.length}열` + (q ? ` · 찾은 행 ${hits}개` : '') + (linkable ? ' · 관리번호를 누르면 장비 상세가 열립니다' : '');
    if (focusRow) { const tr = $('sheetTable').querySelector(`tr[data-row="${focusRow}"]`); if (tr) tr.scrollIntoView({ block: 'center' }); }
  }
  /** 시트 이름과 엑셀 행 번호로 바로 이동 */
  function show(name, row) {
    const i = SV.findIndex(s => s.name === name); cur = i < 0 ? 0 : i; focusRow = row || null;
    cat.setTab('sheet'); render();
  }
  $('sheetTabs').onclick = e => { const b = e.target.closest('[data-si]'); if (b) { cur = +b.dataset.si; focusRow = null; render(); } };
  $('sheetQ').oninput = () => { focusRow = null; render(); };
  $('sheetWrap').onchange = render;
  $('sheetDl').onclick = () => cat.actions.original();
  $('sheetTable').onclick = e => { const td = e.target.closest('[data-uid]'); if (td) { cat.setTab('browse'); cat.detail.openByUid(td.dataset.uid); } };
  $('nSheets').textContent = SV.length ? SV.length + '시트' : '';
  cat.sheets = { render, show };
})(window.EQ = window.EQ || {});
