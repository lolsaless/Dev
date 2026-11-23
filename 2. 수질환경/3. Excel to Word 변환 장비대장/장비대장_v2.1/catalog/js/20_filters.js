/* [부품 C2] 필터·정렬 — 상태(S)로 레코드를 걸러 S.list 를 만든다
 *  금액 : 구간 칩(config.priceBuckets) 또는 상세 최소~최대(원) 중 하나만 적용 (상세가 우선) */
(function (EQ) {
  'use strict';
  const cat = EQ.cat, { S, R } = cat;
  const BUCKETS = EQ.CONFIG.priceBuckets;
  const priceOf = r => (S.basis === 'total' ? r._total : r.price);

  function priceRange() {
    if (S.pmin != null || S.pmax != null) return [S.pmin, S.pmax];
    if (S.bucket != null) { const b = BUCKETS[S.bucket]; return [b.min, b.max]; }
    return [null, null];
  }
  const inPrice = (p, lo, hi) => p != null && (lo == null || p >= lo) && (hi == null || p < hi + (S.pmax != null ? 1 : 0));

  /** opt.skipPrice: 칩별 개수를 셀 때 금액 조건만 빼고 거르기 */
  function match(r, opt) {
    if (S.cat && r.sheet !== S.cat) return false;
    if (S.ids.length && !S.ids.some(t => r._id.includes(t))) return false;
    if (S.names.length && !S.names.some(t => r._name.includes(t))) return false;
    if (S.any.length && !S.any.some(t => r._any.includes(t) || r._name.includes(t) || r._id.includes(t))) return false;
    if (S.sheets.size && !S.sheets.has(r.sheet)) return false;
    if (S.countries.size && !S.countries.has(r.country || '(미상)')) return false;
    if (S.yMin != null && !(r.year >= S.yMin)) return false;
    if (S.yMax != null && !(r.year <= S.yMax)) return false;
    if (S.photo && !r.ph) return false;
    if (S.comps && !(r.comps && r.comps.length)) return false;
    if (S.fav && !r._fav) return false;
    if (!(opt && opt.skipPrice)) {
      const [lo, hi] = priceRange();
      if ((lo != null || hi != null) && !inPrice(priceOf(r), lo, hi)) return false;
    }
    return true;
  }

  const SORTS = {
    id: (a, b) => EQ.util.natKey(a.id).localeCompare(EQ.util.natKey(b.id)) || a._i - b._i,
    name: (a, b) => a.name.localeCompare(b.name, 'ko') || a._i - b._i,
    dateD: (a, b) => (b.date || '').localeCompare(a.date || ''),
    dateA: (a, b) => (a.date || '9999').localeCompare(b.date || '9999'),
    priceD: (a, b) => (priceOf(b) ?? -1) - (priceOf(a) ?? -1),
    priceA: (a, b) => (priceOf(a) ?? Infinity) - (priceOf(b) ?? Infinity),
  };

  function apply() {
    S.list = R.filter(r => match(r)).sort(SORTS[S.sort] || SORTS.id);
    cat.emit('change');
  }
  /** 금액 칩별 개수 (금액 외 조건은 반영) */
  function bucketCounts() {
    const base = R.filter(r => match(r, { skipPrice: true }));
    return BUCKETS.map(b => base.filter(r => inPrice(priceOf(r), b.min, b.max)).length);
  }
  /** 상세 검색 조건 수 (배지 표시용) */
  function activeCount() {
    return (S.pmin != null || S.pmax != null ? 1 : 0) + (S.yMin != null || S.yMax != null ? 1 : 0)
      + (S.countries.size ? 1 : 0) + (S.sheets.size ? 1 : 0) + (S.photo ? 1 : 0) + (S.comps ? 1 : 0) + (S.basis === 'total' ? 1 : 0);
  }
  function reset(all) {
    Object.assign(S, { bucket: null, pmin: null, pmax: null, basis: 'unit', yMin: null, yMax: null, photo: false, comps: false });
    S.countries.clear(); S.sheets.clear();
    if (all) { S.ids = []; S.names = []; S.any = []; S.fav = false; }
  }
  Object.assign(cat, { apply, match, bucketCounts, activeCount, reset, priceOf, priceRange, BUCKETS });
})(window.EQ = window.EQ || {});
