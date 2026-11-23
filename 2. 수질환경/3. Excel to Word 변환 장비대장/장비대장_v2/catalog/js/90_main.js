/* [부품 C9] 카탈로그 연결 — 검색창·칩·탭·보기 전환 등 화면 이벤트를 각 부품에 연결 */
(function (EQ) {
  'use strict';
  const cat = EQ.cat, { S, D } = cat, U = EQ.util;
  const $ = id => document.getElementById(id);

  // 머리 정보
  $('meta').textContent = `${D.generated} 기준 · ${D.source ? D.source.name : ''}`;
  $('nAll').textContent = cat.R.length;
  $('footer').textContent = `장비 ${cat.R.length}대 · 사진 ${Object.keys(D.images).length}장 · ${D.generated} 생성 · 원본: ${D.source ? D.source.name : '-'} · 관심 장비 표시는 이 브라우저에만 저장됩니다.`;

  // 탭
  cat.setTab = t => {
    const b = t === 'browse';
    $('tabBrowse').setAttribute('aria-selected', b); $('tabSheet').setAttribute('aria-selected', !b);
    $('viewBrowse').hidden = !b; $('viewSheet').hidden = b;
    if (!b && !$('sheetTable').innerHTML) cat.sheets.render();
    window.scrollTo(0, 0);
  };
  $('tabBrowse').onclick = () => cat.setTab('browse');
  $('tabSheet').onclick = () => cat.setTab('sheet');

  // 검색 (입력 즉시, 살짝 지연)
  let tm;
  const onSearch = () => { clearTimeout(tm); tm = setTimeout(() => {
    S.ids = cat.tokens($('qId').value); S.names = cat.tokens($('qName').value); S.any = cat.tokens($('qAny').value); cat.apply();
  }, 120); };
  ['qId', 'qName', 'qAny'].forEach(id => $(id).addEventListener('input', onSearch));
  $('orb').onclick = () => {
    if ($('qId').value || $('qName').value || $('qAny').value) { ['qId', 'qName', 'qAny'].forEach(i => { $(i).value = ''; }); onSearch(); }
    else $('qName').focus();
  };
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); cat.setTab('browse'); $('qName').focus(); }
  });

  // 금액 칩
  $('priceChips').onclick = e => {
    const b = e.target.closest('[data-b]'); if (!b) return;
    const v = b.dataset.b;
    if (v === 'detail') { S.pmin = S.pmax = null; }
    else { S.pmin = S.pmax = null; S.bucket = v === '' ? null : (S.bucket === +v ? null : +v); }
    cat.apply();
  };
  $('btnFilter').onclick = () => cat.filterPanel.open();

  // 적용 조건 지우기
  $('activeF').onclick = e => {
    const k = e.target.closest('[data-clear]'); if (!k) return;
    const c = k.dataset.clear;
    if (c === 'ids') $('qId').value = ''; if (c === 'names') $('qName').value = ''; if (c === 'any') $('qAny').value = '';
    if (c === 'year') S.yMin = S.yMax = null; if (c === 'countries') S.countries.clear(); if (c === 'sheets') S.sheets.clear();
    if (c === 'photo') S.photo = false; if (c === 'comps') S.comps = false; if (c === 'fav') { S.fav = false; $('btnFav').setAttribute('aria-pressed', false); }
    S.ids = cat.tokens($('qId').value); S.names = cat.tokens($('qName').value); S.any = cat.tokens($('qAny').value);
    cat.apply();
  };

  // 정렬·보기
  $('sort').value = S.sort;
  $('sort').onchange = () => { S.sort = $('sort').value; U.store.set('eq-catalog-sort', S.sort); cat.apply(); };
  cat.syncView = () => { $('vGrid').setAttribute('aria-pressed', S.view === 'grid'); $('vTable').setAttribute('aria-pressed', S.view === 'table'); U.store.set('eq-catalog-view', S.view); };
  $('vGrid').onclick = () => { S.view = 'grid'; cat.syncView(); cat.apply(); };
  $('vTable').onclick = () => { S.view = 'table'; cat.syncView(); cat.apply(); };
  cat.syncView();

  // 관심 장비
  $('btnFav').onclick = () => { S.fav = !S.fav; $('btnFav').setAttribute('aria-pressed', S.fav); $('btnFav').classList.toggle('pill', S.fav); cat.apply(); };

  // 결과 클릭 (카드·행·하트·표 머리 정렬)
  $('results').addEventListener('click', e => {
    const h = e.target.closest('[data-fav]');
    if (h) { e.stopPropagation(); cat.toggleFav(S.list[+h.dataset.fav]); return; }
    const th = e.target.closest('th[data-sort]');
    if (th) { S.sort = S.sort === th.dataset.sort && th.dataset.sort.endsWith('D') ? th.dataset.sort.replace(/D$/, 'A') : th.dataset.sort; $('sort').value = S.sort; cat.apply(); return; }
    if (e.target.id === 'emptyReset') { cat.reset(true); ['qId', 'qName', 'qAny'].forEach(i => { $(i).value = ''; }); $('btnFav').setAttribute('aria-pressed', false); cat.apply(); return; }
    const c = e.target.closest('[data-k]'); if (c) cat.detail.open(+c.dataset.k);
  });
  $('results').addEventListener('keydown', e => { if (e.key === 'Enter') { const c = e.target.closest('[data-k]'); if (c) cat.detail.open(+c.dataset.k); } });

  cat.apply();
})(window.EQ = window.EQ || {});
