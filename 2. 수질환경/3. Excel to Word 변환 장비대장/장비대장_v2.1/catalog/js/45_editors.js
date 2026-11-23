/* [부품 C4-1] 상세 화면 편집기 — 장비구성내역 / 수리·부품 교체 이력
 *  보기 ↔ 편집을 바꿔 그리며, [저장] 하면 EQ.cat.setComps / setHist 로 편집층에 넣는다(같은 관리번호 장비는 함께 바뀜).
 *  이력의 담당자·팀장은 '직인 관리'에 등록한 사람 중에서 고르고, 새 줄은 각 역할의 '현재' 사람이 기본값. */
(function (EQ) {
  'use strict';
  const cat = EQ.cat, { esc } = EQ.util, F = EQ.fmt, CFG = EQ.CONFIG;
  const today = () => new Date().toISOString().slice(0, 10);
  const PER = CFG.form.hist.rowsPerSide * 2;

  /* ---------- 장비구성내역 ---------- */
  function compView(r) {
    const C = cat.compsOf(r.key), rows = Math.max(C.length, CFG.form.comp.baseRows);
    let h = `<div class="sech"><h4>장비구성내역<span class="cnt">${C.length}건</span></h4><button class="btn sm" data-ed="comp">✎ 편집</button></div>
      <table class="comp"><thead><tr><th>연번</th><th>장비명</th><th style="text-align:center">수량</th><th style="text-align:center">단위</th></tr></thead><tbody>`;
    for (let i = 0; i < rows; i++) {
      const c = C[i];
      h += c ? `<tr><td class="c1">${i + 1}</td><td style="white-space:pre-wrap">${esc(c.n)}</td><td class="c3">${esc(c.q)}</td><td class="c4">${esc(c.u)}</td></tr>`
             : `<tr class="blank"><td class="c1">${i + 1}</td><td>—</td><td class="c3"></td><td class="c4"></td></tr>`;
    }
    h += '</tbody></table>';
    if (!C.length) h += '<p class="comp-empty">등록된 장비구성내역이 없습니다. [✎ 편집]으로 바로 추가할 수 있습니다.</p>';
    if (C.length > CFG.form.comp.maxRows) h += `<p class="comp-empty">Word 양식에는 앞 ${CFG.form.comp.maxRows}행까지 들어갑니다.</p>`;
    return h;
  }
  function compEdit(list) {
    return `<div class="sech"><h4>장비구성내역 편집</h4></div>
      <table class="comp edit"><thead><tr><th>연번</th><th>장비명</th><th>수량</th><th>단위</th><th></th></tr></thead><tbody>` +
      list.map((c, i) => `<tr data-i="${i}"><td class="c1">${i + 1}</td><td><textarea class="in" data-f="n" rows="${Math.max(1, (c.n.match(/\n/g) || []).length + 1)}" placeholder="구성품 이름 (줄바꿈 가능)">${esc(c.n)}</textarea></td>
        <td class="c3"><input class="in sm" data-f="q" value="${esc(c.q)}"></td><td class="c4"><input class="in sm" data-f="u" value="${esc(c.u)}" placeholder="EA"></td>
        <td class="ops"><button class="mini" data-op="up" title="위로">↑</button><button class="mini" data-op="down" title="아래로">↓</button><button class="mini del" data-op="del" title="삭제">✕</button></td></tr>`).join('') +
      `</tbody></table><div class="edfoot"><button class="btn sm" data-op="add">+ 행 추가</button><span class="sp"></span><button class="btn sm ghost" data-op="cancel">취소</button><button class="btn sm dark" data-op="save">저장</button></div>`;
  }

  /* ---------- 수리·부품 교체 이력 ---------- */
  function who(role, name) {
    if (!name) return '<span class="muted">—</span>';
    const img = cat.stampOf(role, name);
    return img ? `<img class="stamp" src="${img}" alt="${esc(role + ' ' + name)}" title="${esc(name)}">` : `<span class="noname" title="직인 미등록">${esc(name)}</span>`;
  }
  function histView(r) {
    const H = cat.histOf(r.key);
    let h = `<div class="sech"><h4>수리 또는 부품 교체 이력<span class="cnt">${H.length}건</span></h4><span class="sp"></span>
      <button class="btn sm" data-ed="hist-add">+ 이력 추가</button>${H.length ? '<button class="btn sm" data-ed="hist">✎ 편집</button>' : ''}</div>`;
    if (!H.length) return h + '<p class="comp-empty">등록된 이력이 없습니다. [+ 이력 추가]로 수리·부품 교체 내용을 적으면 Word 뒷면에 담당자·팀장 직인과 함께 들어갑니다.</p>';
    h += '<table class="comp htab"><thead><tr><th>일자</th><th>내용</th><th style="text-align:center">담당자</th><th style="text-align:center">팀장</th></tr></thead><tbody>' +
      H.map(x => `<tr><td class="c1 nowrap">${esc(F.date(x.d) || x.d)}</td><td>${esc(x.c)}</td><td class="st">${who('담당자', x.m)}</td><td class="st">${who('팀장', x.l)}</td></tr>`).join('') + '</tbody></table>';
    if (H.length > PER) h += `<p class="comp-empty">Word 뒷면 한 쪽에 ${PER}건까지 들어가며, 넘으면 뒷면이 한 쪽 더 생깁니다.</p>`;
    return h;
  }
  function options(role, cur) {
    const ps = cat.people().filter(p => p.role === role);
    const names = ps.map(p => p.name); if (cur && !names.includes(cur)) names.push(cur);
    return `<option value="">(없음)</option>` + names.map(n => `<option ${n === cur ? 'selected' : ''}>${esc(n)}</option>`).join('');
  }
  function histEdit(list) {
    const none = !cat.people().length;
    return `<div class="sech"><h4>수리·부품 교체 이력 편집</h4></div>
      ${none ? '<p class="comp-empty warnbox">등록된 담당자·팀장이 없습니다. 위쪽 [직인 관리]에서 먼저 등록하면 직인이 들어갑니다. (이름 없이 저장해도 됩니다)</p>' : ''}
      <table class="comp edit htab"><thead><tr><th>일자</th><th>내용</th><th>담당자</th><th>팀장</th><th></th></tr></thead><tbody>` +
      list.map((x, i) => `<tr data-i="${i}"><td><input type="date" class="in" data-f="d" value="${esc(/^\d{4}-\d{2}-\d{2}$/.test(x.d) ? x.d : '')}"></td>
        <td><textarea class="in" data-f="c" rows="2" placeholder="예) 램프 교체(D2), 정기 교정">${esc(x.c)}</textarea></td>
        <td><select class="in" data-f="m">${options('담당자', x.m)}</select></td><td><select class="in" data-f="l">${options('팀장', x.l)}</select></td>
        <td class="ops"><button class="mini del" data-op="del" title="삭제">✕</button></td></tr>`).join('') +
      `</tbody></table><div class="edfoot"><button class="btn sm" data-op="add">+ 줄 추가</button><button class="btn sm ghost" data-op="people">직인 관리</button><span class="sp"></span><button class="btn sm ghost" data-op="cancel">취소</button><button class="btn sm dark" data-op="save">저장</button></div>`;
  }
  const newHist = () => ({ d: today(), c: '', m: (cat.currentOf('담당자') || {}).name || '', l: (cat.currentOf('팀장') || {}).name || '' });

  /** 상세 화면의 두 칸(#secComp, #secHist)을 그리고 이벤트 연결 */
  function mount(r) {
    const cBox = document.getElementById('secComp'), hBox = document.getElementById('secHist');
    let cDraft = null, hDraft = null;
    const read = (box, draft) => box.querySelectorAll('tbody tr[data-i]').forEach(tr => {
      const o = draft[+tr.dataset.i]; tr.querySelectorAll('[data-f]').forEach(inp => { o[inp.dataset.f] = inp.value.split('\n').map(x => x.trim()).filter(Boolean).join('\n'); });
    });
    const drawC = () => { cBox.innerHTML = cDraft ? compEdit(cDraft) : compView(r); };
    const drawH = () => { hBox.innerHTML = hDraft ? histEdit(hDraft) : histView(r); };
    cBox.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.ed === 'comp') { cDraft = cat.compsOf(r.key).map(c => ({ ...c })); if (!cDraft.length) cDraft.push({ n: '', q: '1', u: 'EA' }); drawC(); cBox.querySelector('textarea').focus(); return; }
      if (!cDraft) return;
      read(cBox, cDraft);
      const i = +(b.closest('tr') || {}).dataset?.i;
      switch (b.dataset.op) {
        case 'add': cDraft.push({ n: '', q: '1', u: 'EA' }); drawC(); cBox.querySelectorAll('textarea[data-f="n"]')[cDraft.length - 1].focus(); break;
        case 'del': cDraft.splice(i, 1); drawC(); break;
        case 'up': if (i > 0) [cDraft[i - 1], cDraft[i]] = [cDraft[i], cDraft[i - 1]]; drawC(); break;
        case 'down': if (i < cDraft.length - 1) [cDraft[i + 1], cDraft[i]] = [cDraft[i], cDraft[i + 1]]; drawC(); break;
        case 'cancel': cDraft = null; drawC(); break;
        case 'save': cat.setComps(r.key, cDraft.filter(c => c.n)); cDraft = null; drawC(); cat.toast('장비구성내역을 저장했습니다 (내보내기 전까지 이 브라우저에 임시 저장).'); break;
      }
    };
    hBox.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.ed === 'hist' || b.dataset.ed === 'hist-add') {
        hDraft = cat.histOf(r.key).map(x => ({ ...x }));
        if (b.dataset.ed === 'hist-add' || !hDraft.length) hDraft.push(newHist());
        drawH(); const ta = hBox.querySelectorAll('textarea'); if (ta.length) ta[ta.length - 1].focus(); return;
      }
      if (!hDraft) return;
      read(hBox, hDraft);
      const i = +(b.closest('tr') || {}).dataset?.i;
      switch (b.dataset.op) {
        case 'add': hDraft.push(newHist()); drawH(); break;
        case 'del': hDraft.splice(i, 1); drawH(); break;
        case 'people': cat.peopleUI.open(() => drawH()); break;
        case 'cancel': hDraft = null; drawH(); break;
        case 'save': {
          const list = hDraft.filter(x => x.d || x.c).sort((a, b) => (a.d || '9999').localeCompare(b.d || '9999'));
          cat.setHist(r.key, list); hDraft = null; drawH(); cat.toast('수리 이력을 저장했습니다 (내보내기 전까지 이 브라우저에 임시 저장).'); break;
        }
      }
    };
    drawC(); drawH();
    return { busy: () => !!(cDraft || hDraft) };
  }
  cat.editors = { mount };
})(window.EQ = window.EQ || {});
