/* [부품 C1] 카탈로그 저장소 — 내장 데이터(EQ_DATA) + 편집층(장비구성·수리이력·직인) + 필터 상태 + 관심 장비
 *  편집 내용은 이 브라우저(localStorage)에 자동 임시 저장되고, '통합 엑셀 내보내기'·'관리대장 파일 저장'으로 확정한다.
 *  다른 카탈로그 부품은 EQ.cat 의 S(상태)·R(레코드)·compsOf/histOf/people·set*·on/emit 만 사용한다. */
(function (EQ) {
  'use strict';
  const { normKey, store } = EQ.util;
  const CFG = EQ.CONFIG;
  const D = window.EQ_DATA;
  if (!D) throw new Error('카탈로그 데이터가 없습니다.');
  D.compsAll = D.compsAll || {}; D.histAll = D.histAll || {}; D.people = D.people || [];
  const norm = s => String(s ?? '').normalize('NFC').toLowerCase().replace(/[‐-―−]/g, '-').replace(/\s+/g, '');
  const srcTag = D.docId || ((D.source && D.source.name || 'default') + '|' + D.generated);

  // ---- 편집층 ----
  const EDIT_KEY = 'eq-edit:' + srcTag;
  const E = Object.assign({ comps: {}, hist: {}, people: null }, store.get(EDIT_KEY, {}));
  const saveEdits = () => { E.ts = Date.now(); store.set(EDIT_KEY, E); };

  const R = D.records.map((r, i) => Object.assign(r, { _i: i, _id: normKey(r.id), key: r.key || normKey(r.id), _fav: false }));
  const compsOf = key => (E.comps[key] || D.compsAll[key] || []);
  const histOf = key => (E.hist[key] || D.histAll[key] || []);
  function refreshRecord(r) {
    r.comps = compsOf(r.key); r.hist = histOf(r.key);
    r._name = norm(r.name) + '|' + norm(r.nameExt);
    r._any = norm([r.spec, r.maker, r.country, r.vendor, r.addr, r.tel, r.usage, r.note, r.item, r.serial, r.remark, r.place,
      r.comps.map(c => c.n).join(' '), r.hist.map(h => h.c).join(' ')].join(' '));
    r._total = r.price == null ? null : r.price * (r.qty || 1);
  }
  R.forEach(refreshRecord);

  const FAV_KEY = 'eq-catalog-fav:' + (D.source && D.source.name || 'default');
  const favSet = new Set(store.get(FAV_KEY, []));
  R.forEach(r => { r._fav = favSet.has(r.uid); });

  // ---- 구분(시트) 탭 ----
  const order = n => { const i = CFG.sheets.order.indexOf(n); return i < 0 ? 50 : i; };
  const cats = [...new Set(R.map(r => r.sheet))].sort((a, b) => order(a) - order(b));

  const years = R.map(r => r.year).filter(Boolean);
  const S = {
    cat: cats[0] || '',                      // 지금 보는 구분(시트)
    ids: [], names: [], any: [], bucket: null, pmin: null, pmax: null, basis: 'unit',
    yMin: null, yMax: null, countries: new Set(), sheets: new Set(),
    photo: false, comps: false, fav: false,
    sort: store.get('eq-catalog-sort', 'id'), view: store.get('eq-catalog-view', 'grid'),
    list: [], yearRange: years.length ? [Math.min(...years), Math.max(...years)] : [null, null],
  };

  const subs = {};
  const cat = {
    D, R, S, E, norm, cats,
    on(ev, fn) { (subs[ev] = subs[ev] || []).push(fn); },
    emit(ev, arg) { (subs[ev] || []).forEach(fn => fn(arg)); },
    tokens: v => norm(v).split(',').map(s => s.trim()).filter(Boolean),
    image: key => (key && D.images[key]) || null,
    compsOf, histOf,
    /** 직인 등록 목록 [{role,name,start,note,img}] */
    people: () => (E.people || D.people),
    /** 역할별 '현재' 사람 = 사용 시작일이 오늘 이전 중 가장 최근 */
    currentOf(role) {
      const today = new Date().toISOString().slice(0, 10);
      const list = cat.people().filter(p => p.role === role).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
      const past = list.filter(p => !p.start || p.start <= today);
      return (past.length ? past[past.length - 1] : list[list.length - 1]) || null;
    },
    stampOf(role, name) { const p = cat.people().find(x => x.role === role && x.name === name); return p && p.img ? p.img : null; },
    setComps(key, list) { E.comps[key] = list; R.filter(r => r.key === key).forEach(refreshRecord); saveEdits(); cat.emit('edit'); },
    setHist(key, list) { E.hist[key] = list; R.filter(r => r.key === key).forEach(refreshRecord); saveEdits(); cat.emit('edit'); },
    setPeople(list) { E.people = list; saveEdits(); cat.emit('edit'); },
    changeCount: () => Object.keys(E.comps).length + Object.keys(E.hist).length + (E.people ? 1 : 0),
    discardEdits() { E.comps = {}; E.hist = {}; E.people = null; saveEdits(); R.forEach(refreshRecord); cat.emit('edit'); },
    /** 편집을 반영한 전체 맵 (내보내기용) */
    mergedComps() { const m = { ...D.compsAll }; Object.entries(E.comps).forEach(([k, v]) => { m[k] = v; }); return m; },
    mergedHist() { const m = { ...D.histAll }; Object.entries(E.hist).forEach(([k, v]) => { m[k] = v; }); return m; },
    toggleFav(r) { r._fav = !r._fav; r._fav ? favSet.add(r.uid) : favSet.delete(r.uid); store.set(FAV_KEY, [...favSet]); cat.emit('fav'); },
    favCount: () => favSet.size,
    toast(msg) {
      const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
      clearTimeout(cat._tt); cat._tt = setTimeout(() => t.classList.remove('show'), 2800);
    },
  };
  EQ.cat = cat;
})(window.EQ = window.EQ || {});
