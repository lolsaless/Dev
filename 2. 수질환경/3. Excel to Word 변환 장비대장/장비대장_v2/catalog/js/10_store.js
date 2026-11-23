/* [부품 C1] 카탈로그 저장소 — 내장 데이터(EQ_DATA) 읽기, 검색용 파생 필드, 필터 상태, 관심 장비
 *  다른 카탈로그 부품은 EQ.cat.S(상태) / EQ.cat.R(레코드) / EQ.cat.emit·on(알림)만 사용한다. */
(function (EQ) {
  'use strict';
  const { normKey, store } = EQ.util;
  const D = window.EQ_DATA;
  if (!D) throw new Error('카탈로그 데이터가 없습니다.');
  const norm = s => String(s ?? '').normalize('NFC').toLowerCase().replace(/[‐-―−]/g, '-').replace(/\s+/g, '');

  const R = D.records.map((r, i) => Object.assign(r, {
    _i: i,
    _id: normKey(r.id),
    _name: norm(r.name) + '|' + norm(r.nameExt),
    _any: norm([r.spec, r.maker, r.country, r.vendor, r.addr, r.tel, r.usage, r.note, r.item, r.serial, r.remark, r.place,
                (r.comps || []).map(c => c.n).join(' ')].join(' ')),
    _total: r.price == null ? null : r.price * (r.qty || 1),
    _fav: false,
  }));
  const FAV_KEY = 'eq-catalog-fav:' + (D.source && D.source.name || 'default');
  const favSet = new Set(store.get(FAV_KEY, []));
  R.forEach(r => { r._fav = favSet.has(r.uid); });

  const years = R.map(r => r.year).filter(Boolean);
  const S = {
    ids: [], names: [], any: [],            // 검색어 (쉼표로 나눈 토큰)
    bucket: null,                           // 금액 구간 칩 번호
    pmin: null, pmax: null, basis: 'unit',  // 상세 금액(원)
    yMin: null, yMax: null,
    countries: new Set(), sheets: new Set(),
    photo: false, comps: false, fav: false,
    sort: store.get('eq-catalog-sort', 'id'), view: store.get('eq-catalog-view', 'grid'),
    list: [],                               // 필터 결과
    yearRange: years.length ? [Math.min(...years), Math.max(...years)] : [null, null],
  };

  const subs = {};
  const cat = {
    D, R, S, norm,
    on(ev, fn) { (subs[ev] = subs[ev] || []).push(fn); },
    emit(ev, arg) { (subs[ev] || []).forEach(fn => fn(arg)); },
    tokens: v => norm(v).split(',').map(s => s.trim()).filter(Boolean),
    toggleFav(r) {
      r._fav = !r._fav; r._fav ? favSet.add(r.uid) : favSet.delete(r.uid);
      store.set(FAV_KEY, [...favSet]); cat.emit('fav');
    },
    favCount: () => favSet.size,
    image: key => (key && D.images[key]) || null,
    sheetLabel: r => r.sheet,
    toast(msg) {
      const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
      clearTimeout(cat._tt); cat._tt = setTimeout(() => t.classList.remove('show'), 2600);
    },
  };
  EQ.cat = cat;
})(window.EQ = window.EQ || {});
