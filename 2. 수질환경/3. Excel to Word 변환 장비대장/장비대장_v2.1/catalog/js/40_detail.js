/* [부품 C4] 장비 상세 — 사진·기본정보·도입처·주요 성능·장비구성내역(없어도 빈 표 표시)·오른쪽 요약 카드
 *  열기: EQ.cat.detail.open(목록 위치) / ←·→ 이동, Esc 닫기 */
(function (EQ) {
  'use strict';
  const cat = EQ.cat, { S } = cat, { esc } = EQ.util, F = EQ.fmt;
  const $ = id => document.getElementById(id);
  const I = {
    spec: '<path d="M4 7h16M4 12h10M4 17h7"/>', maker: '<path d="M3 21V9l6 4V9l6 4V5l6 4v12z"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', tag: '<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    use: '<path d="M9 3h6v5l4 8a3 3 0 0 1-3 4H8a3 3 0 0 1-3-4l4-8z"/>', pin: '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    memo: '<path d="M5 3h10l4 4v14H5z"/><path d="M9 12h6M9 16h6"/>', box: '<path d="M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7"/>',
    co: '<path d="M4 21V5l8-2v18M12 9h8v12"/>', tel: '<path d="M5 3h4l2 5-3 2a11 11 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 3 5a2 2 0 0 1 2-2"/>',
  };
  const ico = k => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">${I[k]}</svg>`;
  const fact = (k, label, v) => v ? `<div class="fact">${ico(k)}<div><div class="k">${label}</div><div class="v">${esc(v)}</div></div></div>` : '';
  let cur = -1, ed = null;

  function html(r) {
    const img = cat.image(r.ph), active = !/불용|폐기|이관/.test(r.status + r.sheet);
    return `<div class="dhead"><button class="iconbtn" data-close aria-label="닫기">✕</button>
        <h3>${esc(r.id)}</h3>
        <div class="pager"><button class="iconbtn" id="dPrev" aria-label="이전 장비">‹</button><button class="iconbtn" id="dNext" aria-label="다음 장비">›</button>
        <button class="iconbtn heart" style="position:static;border:1px solid var(--hairline);width:40px;height:40px" id="dFav" aria-pressed="${r._fav}" aria-label="관심 장비"><svg width="18" height="18" viewBox="0 0 32 32"><path d="M16 28c7-4.7 14-10 14-17a6.8 6.8 0 0 0-14-3 6.8 6.8 0 0 0-14 3c0 7 7 12.3 14 17z"/></svg></button></div></div>
      <div class="dbody">
        <h1 class="dt-title" id="dtTitle">${esc(r.name)}</h1>
        <div class="dt-sub"><b>${esc(r.id)}</b>${r.item ? `<span class="dot">물품번호 ${esc(r.item)}</span>` : ''}<span class="dot">${esc(r.sheet)}</span>${r.status ? `<span class="dot statusdot ${active ? '' : 'off'}">${esc(r.status)}</span>` : ''}</div>
        <div class="gallery" id="dGal">${img ? `<img src="${img}" alt="${esc(r.name)} 사진">` : '<div class="noimg"><div>사진이 없습니다<br><small>사진 폴더에 관리번호 이름으로 넣고 다시 만들면 표시됩니다</small></div></div>'}</div>
        <div class="dt-cols"><div>
          <section class="sec"><h4>기본 정보</h4><div class="facts">
            ${fact('spec', '규격', r.spec)}${fact('maker', '제조사', r.maker)}${fact('globe', '제조국', r.country)}
            ${fact('cal', '도입일(취득일)', F.date(r.date))}${fact('tag', '구입일련번호', r.serial)}${fact('memo', '물품명(외부 보고용)', r.nameExt && r.nameExt !== r.name ? r.nameExt : '')}
            ${fact('use', '용도', r.usage)}${fact('pin', '장소', r.place)}${fact('memo', '비고', r.remark)}
            ${fact('cal', '이관일', F.date(r.outDate))}${fact('cal', '수관일', F.date(r.inDate))}
          </div></section>
          <section class="sec"><h4>도입처</h4><div class="facts">
            ${fact('co', '회사명', r.vendor) || '<div class="fact"><div class="v" style="color:var(--muted)">도입처 정보가 없습니다</div></div>'}${fact('pin', '주소', r.addr)}${fact('tel', '연락처', r.tel)}${fact('memo', '연락처 비고', r.telNote)}
          </div></section>
          <section class="sec"><h4>주요 성능 및 특징</h4>${r.note ? `<p class="note">${esc(r.note)}</p>` : '<p class="note empty-note">등록된 내용이 없습니다.</p>'}</section>
          <section class="sec" id="secComp"></section>
          <section class="sec" id="secHist"></section>
        </div>
        <aside><div class="rcard">
          <div class="price">${esc(F.wonShort(r.price))}<small>${r.price != null ? esc(F.won(r.price)) + '원' : ''}</small></div>
          ${r.qty > 1 ? `<div style="color:var(--muted)">총액 ${esc(F.wonShort(r._total))} (×${r.qty})</div>` : ''}
          <div class="rgrid"><div><b>도입일</b><span>${esc(F.date(r.date)) || '-'}</span></div><div><b>수량</b><span>${r.qty || 1}</span></div>
            <div><b>사용 상태</b><span>${esc(r.status) || '-'}</span></div><div><b>입고시</b><span>${esc(r.cond) || '-'}</span></div></div>
          <div class="ractions">
            <button class="btn primary block" id="dWord">Word 장비관리대장 내려받기</button>
            <button class="btn block" id="dSheet">엑셀 원본에서 이 행 보기</button>
            <button class="btn ghost block" id="dPrint">이 장비 정보 인쇄</button>
          </div>
          <div class="rhint">엑셀 ${esc(r.sheet)} 시트 ${r.row}행 · ←/→ 키로 이동</div>
        </div></aside></div>
      </div>`;
  }

  function open(k) {
    const r = S.list[k]; if (!r) return;
    if (ed && ed.busy() && cur >= 0 && k !== cur && !confirm('편집 중인 내용이 저장되지 않았습니다. 이동할까요?')) return;
    cur = k; $('detailBox').innerHTML = html(r);
    const sc = $('detail'); sc.classList.add('show'); sc.setAttribute('aria-hidden', 'false'); sc.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    $('dPrev').onclick = () => open((cur - 1 + S.list.length) % S.list.length);
    $('dNext').onclick = () => open((cur + 1) % S.list.length);
    $('dFav').onclick = () => { cat.toggleFav(r); $('dFav').setAttribute('aria-pressed', r._fav); };
    $('dWord').onclick = () => cat.actions.wordFor([r], `${EQ.util.safeName(r.id)}_${EQ.util.safeName(r.name).slice(0, 30)}.docx`);
    $('dSheet').onclick = () => { close(); cat.sheets.show(r.sheet, r.row); };
    $('dPrint').onclick = () => { document.body.classList.add('printing'); window.print(); setTimeout(() => document.body.classList.remove('printing'), 500); };
    const g = $('dGal').querySelector('img'); if (g) $('dGal').onclick = () => { const lb = $('lightbox'); lb.querySelector('img').src = g.src; lb.classList.add('show'); };
    ed = cat.editors.mount(r);
    $('detailBox').querySelector('[data-close]').focus();
  }
  function close() {
    if (ed && ed.busy() && !confirm('편집 중인 내용이 저장되지 않았습니다. 닫을까요?')) return;
    ed = null; $('detail').classList.remove('show'); $('detail').setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; cur = -1; }
  document.addEventListener('keydown', e => {
    if ($('lightbox').classList.contains('show')) { if (e.key === 'Escape') $('lightbox').classList.remove('show'); return; }
    if (cur < 0 || document.getElementById('people').classList.contains('show')) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') open((cur - 1 + S.list.length) % S.list.length);
    else if (e.key === 'ArrowRight') open((cur + 1) % S.list.length);
  });
  $('detail').addEventListener('click', e => { if (e.target === $('detail') || e.target.closest('[data-close]')) close(); });
  $('lightbox').addEventListener('click', () => $('lightbox').classList.remove('show'));
  cat.detail = { open, close, openByUid(uid) {
    const rec = cat.R.find(r => r.uid === uid);
    if (!rec) { cat.toast('이 행은 카탈로그에 없는 장비입니다(중복 제거 또는 제외된 시트).'); return; }
    cat.setTab('browse', rec.sheet);
    let k = S.list.findIndex(r => r.uid === uid);
    if (k < 0) { cat.reset(true); syncInputs(); cat.apply(); k = S.list.findIndex(r => r.uid === uid); }
    open(k);
  } };
  function syncInputs() { ['qId', 'qName', 'qAny'].forEach(i => { $(i).value = ''; }); }
})(window.EQ = window.EQ || {});
