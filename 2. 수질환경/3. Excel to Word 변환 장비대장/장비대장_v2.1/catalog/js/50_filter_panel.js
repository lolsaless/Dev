/* [부품 C5] 상세 검색 창 — 금액(분포 막대 + 양쪽 슬라이더 + 만원 단위 직접 입력 + 빠른 범위),
 *  단가/총액 기준, 도입연도, 제조국, 구분(시트), 사진·구성내역 있는 장비만
 *  창 안에서 바꾼 값은 '임시(T)'에 두고 [장비 N개 보기]를 눌러야 적용된다. */
(function (EQ) {
  'use strict';
  const cat = EQ.cat, { S, R } = cat, { esc } = EQ.util, F = EQ.fmt;
  const $ = id => document.getElementById(id);
  const MAN = 10000;
  // 슬라이더는 로그 눈금(1만원~최대)으로 — 금액 범위가 수십만~수억이라 선형이면 쓸 수 없음
  const prices = R.map(r => r.price).filter(p => p > 0);
  const LO = MAN, HI = Math.max(MAN * 10, ...prices) * 1.0001, STEPS = 200;
  const toPos = v => v == null ? null : Math.round(Math.log(Math.max(v, LO) / LO) / Math.log(HI / LO) * STEPS);
  const toVal = p => Math.round(LO * Math.pow(HI / LO, p / STEPS) / MAN) * MAN;
  let T = null;   // 임시 상태

  function snapshot() { return { pmin: S.pmin, pmax: S.pmax, basis: S.basis, yMin: S.yMin, yMax: S.yMax, countries: new Set(S.countries), sheets: new Set(S.sheets), photo: S.photo, comps: S.comps }; }
  function countWith(t) {
    const keep = { ...snapshot(), bucket: S.bucket }; Object.assign(S, t, { bucket: t.pmin != null || t.pmax != null ? null : S.bucket });
    const n = R.filter(r => cat.match(r)).length; Object.assign(S, keep); return n;
  }

  function histogram() {
    const bins = new Array(30).fill(0);
    R.forEach(r => { const p = T.basis === 'total' ? r._total : r.price; if (p > 0) bins[Math.min(29, Math.floor(toPos(p) / STEPS * 30))]++; });
    const mx = Math.max(1, ...bins), a = toPos(T.pmin) ?? 0, b = toPos(T.pmax) ?? STEPS;
    return bins.map((n, i) => { const mid = (i + 0.5) / 30 * STEPS; return `<i class="${mid >= a && mid <= b ? 'on' : ''}" style="height:${n ? 8 + n / mx * 92 : 0}%" title="${n}대"></i>`; }).join('');
  }

  function body() {
    const countries = [...new Set(R.filter(r => r.sheet === S.cat).map(r => r.country || '(미상)'))].sort((a, b) => a.localeCompare(b, 'ko'));
    const [y0, y1] = S.yearRange, yrs = []; for (let y = y1; y >= y0 && y0; y--) yrs.push(y);
    const opt = (v, cur) => `<option value="${v}" ${cur == v ? 'selected' : ''}>${v}년</option>`;
    const quick = [[0, 100], [100, 500], [500, 1000], [1000, 3000], [3000, 5000], [5000, 10000], [10000, null]];
    return `
    <div class="fsec"><h5>금액 범위</h5><p class="d">막대는 금액대별 장비 수입니다. 슬라이더를 끌거나 만원 단위로 직접 입력하세요.</p>
      <div class="chipwrap" style="margin-bottom:14px"><button class="chip sm" data-basis="unit" aria-pressed="${T.basis === 'unit'}">단가 기준</button><button class="chip sm" data-basis="total" aria-pressed="${T.basis === 'total'}">총액(단가×수량) 기준</button></div>
      <div class="hist" id="fHist">${histogram()}</div>
      <div class="range"><div class="track"></div><div class="fill" id="fFill"></div>
        <input type="range" id="rLo" min="0" max="${STEPS}" value="${toPos(T.pmin) ?? 0}" aria-label="최소 금액"><input type="range" id="rHi" min="0" max="${STEPS}" value="${toPos(T.pmax) ?? STEPS}" aria-label="최대 금액"></div>
      <div class="money"><div class="mfield"><label for="mLo">최소</label><div><input id="mLo" type="number" min="0" step="10" placeholder="제한 없음" value="${T.pmin != null ? T.pmin / MAN : ''}"><span>만원</span></div></div><span>–</span>
        <div class="mfield"><label for="mHi">최대</label><div><input id="mHi" type="number" min="0" step="10" placeholder="제한 없음" value="${T.pmax != null ? T.pmax / MAN : ''}"><span>만원</span></div></div></div>
      <div class="quick">${quick.map(([a, b]) => `<button class="chip sm" data-q="${a},${b ?? ''}">${a ? F.wonShort(a * MAN).replace('원', '') : '0'}~${b ? F.wonShort(b * MAN).replace('원', '') : ''}</button>`).join('')}</div>
      <p class="d" style="margin-top:10px" id="mHint"></p></div>
    <div class="fsec"><h5>도입연도</h5><div class="yr"><select id="yLo"><option value="">처음부터</option>${yrs.slice().reverse().map(y => opt(y, T.yMin)).join('')}</select><span>–</span><select id="yHi"><option value="">지금까지</option>${yrs.map(y => opt(y, T.yMax)).join('')}</select></div></div>
    <div class="fsec"><h5>제조국</h5><div class="chipwrap">${countries.map(c => `<button class="chip sm" data-country="${esc(c)}" aria-pressed="${T.countries.has(c)}">${esc(c)} <span class="c">${R.filter(r => r.sheet === S.cat && (r.country || '(미상)') === c).length}</span></button>`).join('')}</div></div>
    <div class="fsec"><h5>자료 있음</h5>
      <label class="togglerow"><span><b>사진 있는 장비만</b><small>사진 ${R.filter(r => r.sheet === S.cat && r.ph).length}대</small></span><span class="switch"><input type="checkbox" id="tPhoto" ${T.photo ? 'checked' : ''}><span></span></span></label>
      <label class="togglerow"><span><b>장비구성내역 있는 장비만</b><small>구성 등록 ${R.filter(r => r.sheet === S.cat && r.comps && r.comps.length).length}대</small></span><span class="switch"><input type="checkbox" id="tComps" ${T.comps ? 'checked' : ''}><span></span></span></label></div>`;
  }

  function refresh(rebuild) {
    if (rebuild) { $('filterBody').innerHTML = body(); wire(); }
    else $('fHist').innerHTML = histogram();
    const a = +$('rLo').value, b = +$('rHi').value;
    $('fFill').style.left = (a / STEPS * 100) + '%'; $('fFill').style.right = (100 - b / STEPS * 100) + '%';
    const n = countWith(T);
    $('fApply').textContent = `장비 ${n}개 보기`;
    $('mHint').textContent = T.pmin != null || T.pmax != null ? `적용 범위: ${T.pmin != null ? F.won(T.pmin) + '원' : '처음'} ~ ${T.pmax != null ? F.won(T.pmax) + '원' : '끝'}` : '';
  }
  function wire() {
    const body = $('filterBody');
    const fromSlider = () => {
      let a = +$('rLo').value, b = +$('rHi').value; if (a > b) [a, b] = [b, a];
      T.pmin = a <= 0 ? null : toVal(a); T.pmax = b >= STEPS ? null : toVal(b);
      $('mLo').value = T.pmin != null ? T.pmin / MAN : ''; $('mHi').value = T.pmax != null ? T.pmax / MAN : ''; refresh();
    };
    $('rLo').oninput = fromSlider; $('rHi').oninput = fromSlider;
    const fromInput = () => {
      const a = $('mLo').value === '' ? null : Math.max(0, +$('mLo').value) * MAN, b = $('mHi').value === '' ? null : Math.max(0, +$('mHi').value) * MAN;
      T.pmin = a; T.pmax = b;
      $('rLo').value = toPos(a) ?? 0; $('rHi').value = toPos(b) ?? STEPS; refresh();
    };
    $('mLo').oninput = fromInput; $('mHi').oninput = fromInput;
    $('yLo').onchange = () => { T.yMin = $('yLo').value ? +$('yLo').value : null; refresh(); };
    $('yHi').onchange = () => { T.yMax = $('yHi').value ? +$('yHi').value : null; refresh(); };
    $('tPhoto').onchange = e => { T.photo = e.target.checked; refresh(); };
    $('tComps').onchange = e => { T.comps = e.target.checked; refresh(); };
    body.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.basis) { T.basis = b.dataset.basis; refresh(true); }
      else if (b.dataset.q != null) { const [x, y] = b.dataset.q.split(','); $('mLo').value = x === '0' ? '' : x; $('mHi').value = y; fromInput(); }
      else if (b.dataset.country) { const c = b.dataset.country; T.countries.has(c) ? T.countries.delete(c) : T.countries.add(c); b.setAttribute('aria-pressed', T.countries.has(c)); refresh(); }
      else if (b.dataset.sheet) { const c = b.dataset.sheet; T.sheets.has(c) ? T.sheets.delete(c) : T.sheets.add(c); b.setAttribute('aria-pressed', T.sheets.has(c)); refresh(); }
    };
  }
  function open() {
    T = snapshot(); refresh(true);
    $('filters').classList.add('show'); $('filters').setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
  }
  function close() { $('filters').classList.remove('show'); $('filters').setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }
  $('fApply').onclick = () => { Object.assign(S, T); if (S.pmin != null || S.pmax != null) S.bucket = null; close(); cat.apply(); };
  $('fClear').onclick = () => { T = { pmin: null, pmax: null, basis: 'unit', yMin: null, yMax: null, countries: new Set(), sheets: new Set(), photo: false, comps: false }; refresh(true); };
  $('filters').addEventListener('click', e => { if (e.target === $('filters') || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('filters').classList.contains('show')) close(); });
  cat.filterPanel = { open, close };
})(window.EQ = window.EQ || {});
