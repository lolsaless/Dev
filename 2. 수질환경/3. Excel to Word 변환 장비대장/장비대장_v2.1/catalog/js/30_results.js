/* [부품 C3] 결과 화면 — 금액 구간 칩, 결과 머리(개수·합계·적용 조건), 카드 격자 / 표 */
(function (EQ) {
  'use strict';
  const cat = EQ.cat, { S } = cat, { esc } = EQ.util, F = EQ.fmt;
  const $ = id => document.getElementById(id);
  const ICON_NOIMG = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="m21 17-5-5-8 8"/></svg>';
  const HEART = '<svg width="24" height="24" viewBox="0 0 32 32"><path d="M16 28c7-4.7 14-10 14-17a6.8 6.8 0 0 0-14-3 6.8 6.8 0 0 0-14 3c0 7 7 12.3 14 17z"/></svg>';

  /** 검색어와 맞는 글자 강조 (공백 무시) */
  function hl(text, toks) {
    let s = esc(text); if (!toks.length) return s;
    for (const t of toks) {
      const re = new RegExp('(' + [...t].map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*') + ')', 'gi');
      s = s.replace(re, m => (/[<&>]/.test(m) ? m : `<mark>${m}</mark>`));
    }
    return s;
  }
  cat.hl = hl;

  function renderChips() {
    const counts = cat.bucketCounts(), detail = S.pmin != null || S.pmax != null;
    $('priceChips').innerHTML =
      `<button class="chip" data-b="" aria-pressed="${S.bucket == null && !detail}">전체 금액</button>` +
      cat.BUCKETS.map((b, i) => `<button class="chip" data-b="${i}" aria-pressed="${S.bucket === i && !detail}">${esc(b.label)}<span class="c">${counts[i]}</span></button>`).join('') +
      (detail ? `<button class="chip" aria-pressed="true" data-b="detail">${esc(rangeLabel())} ✕</button>` : '');
  }
  function rangeLabel() {
    const a = S.pmin != null ? F.wonShort(S.pmin) : '', b = S.pmax != null ? F.wonShort(S.pmax) : '';
    return (S.basis === 'total' ? '총액 ' : '') + (a && b ? `${a}~${b}` : a ? `${a} 이상` : `${b} 이하`);
  }

  function renderHead() {
    const L = S.list, sum = L.reduce((t, r) => t + (cat.priceOf(r) || 0), 0);
    $('resTitle').textContent = `장비 ${L.length.toLocaleString()}대`;
    $('resSum').textContent = L.length ? `· ${S.basis === 'total' ? '총액' : '금액'} 합계 ${F.wonShort(sum)}` : '';
    const pills = [];
    const add = (label, key) => pills.push(`<button class="af" data-clear="${key}">${esc(label)} ✕</button>`);
    if (S.ids.length) add('관리번호: ' + $('qId').value, 'ids');
    if (S.names.length) add('물품명: ' + $('qName').value, 'names');
    if (S.any.length) add('검색: ' + $('qAny').value, 'any');
    if (S.yMin != null || S.yMax != null) add(`도입 ${S.yMin ?? ''}~${S.yMax ?? ''}년`, 'year');
    if (S.countries.size) add('제조국: ' + [...S.countries].join(', '), 'countries');
    if (S.sheets.size) add('구분: ' + [...S.sheets].join(', '), 'sheets');
    if (S.photo) add('사진 있음', 'photo');
    if (S.comps) add('구성내역 있음', 'comps');
    if (S.fav) add('관심 장비', 'fav');
    $('activeF').innerHTML = pills.join('');
    const n = cat.activeCount(); $('fN').hidden = !n; $('fN').textContent = n;
  }

  function cardHtml(r, k) {
    const img = cat.image(r.ph);
    const badge = r.sheet !== '장비대장' ? r.sheet : (r.comps && r.comps.length ? `구성 ${r.comps.length}` : '');
    const ids = S.ids, nms = S.names;
    return `<article class="card" data-k="${k}" tabindex="0" aria-label="${esc(r.id + ' ' + r.name)}">
      <div class="ph">${img ? `<img loading="lazy" decoding="async" src="${img}" alt="">` : `<div class="noimg"><div>${ICON_NOIMG}사진 없음</div></div>`}
        ${badge ? `<span class="fbadge">${esc(badge)}</span>` : ''}
        <button class="heart" data-fav="${k}" aria-pressed="${r._fav}" aria-label="관심 장비">${HEART}</button></div>
      <div class="meta"><div class="m1"><span class="mid">${hl(r.id, ids)}</span><span class="myear">${r.year ? r.year + '년 도입' : ''}</span></div>
        <div class="mname">${hl(r.name, nms)}</div>
        <div class="mspec">${esc([r.spec, r.maker].filter(Boolean).join(' · ').replace(/\s*\n\s*/g, ' ')) || '&nbsp;'}</div>
        <div class="mprice"><b>${esc(F.wonShort(r.price))}</b>${r.qty > 1 ? ` <span class="myear">× ${r.qty}</span>` : ''}</div></div>
    </article>`;
  }
  function tableHtml() {
    const ids = S.ids, nms = S.names;
    return `<div class="tablewrap"><table class="t"><thead><tr><th>사진</th><th data-sort="id">관리번호</th><th data-sort="name">물품명</th><th>규격</th><th>제조사(국)</th><th data-sort="dateD">도입일</th><th data-sort="priceD">금액(원)</th><th>용도</th><th>구성</th><th>구분</th></tr></thead><tbody>` +
      S.list.map((r, k) => { const img = cat.image(r.ph); return `<tr data-k="${k}"><td>${img ? `<img class="thumb" loading="lazy" src="${img}" alt="">` : '<div class="thumb"></div>'}</td>
        <td><b>${hl(r.id, ids)}</b></td><td>${hl(r.name, nms)}</td><td>${esc(r.spec.replace(/\s*\n\s*/g, ' '))}</td>
        <td>${esc(r.maker)}${r.country ? ` (${esc(r.country)})` : ''}</td><td>${esc(F.date(r.date))}</td><td class="n">${esc(F.won(r.price))}</td>
        <td>${esc(r.usage)}</td><td class="n">${(r.comps || []).length || ''}</td><td>${esc(r.sheet)}</td></tr>`; }).join('') + '</tbody></table></div>';
  }
  function renderList() {
    const box = $('results');
    if (!S.list.length) { box.innerHTML = `<div class="empty"><b>조건에 맞는 장비가 없습니다</b>검색어를 줄이거나 금액·상세 조건을 해제해 보세요.<br><br><button class="btn" id="emptyReset">조건 모두 지우기</button></div>`; return; }
    box.innerHTML = S.view === 'table' ? tableHtml() : `<div class="grid">${S.list.map(cardHtml).join('')}</div>`;
  }
  function render() { renderChips(); renderHead(); renderList(); $('favN').textContent = cat.favCount(); }

  cat.on('change', render);
  cat.on('fav', () => { $('favN').textContent = cat.favCount(); if (S.fav) cat.apply(); else document.querySelectorAll('[data-fav]').forEach(b => { b.setAttribute('aria-pressed', S.list[+b.dataset.fav]._fav); }); });
  cat.results = { render };
})(window.EQ = window.EQ || {});
