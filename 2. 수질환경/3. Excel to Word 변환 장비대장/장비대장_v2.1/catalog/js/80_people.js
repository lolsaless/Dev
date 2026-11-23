/* [부품 C8] 담당자·팀장 직인 관리 — 사람 등록(이름·사용 시작일), 직인/사인 그림 올리기 또는 직접 서명, 교체·삭제
 *  사람이 바뀌면 '새 사람'을 등록한다 → 지난 이력은 원래 사람의 직인을 그대로 쓰고, 새 이력의 기본값은 '현재' 사람.
 *  그림은 흰 배경을 투명하게 바꾸고(선택) 여백을 잘라 긴 변 300px PNG 로 저장 → 통합 엑셀 '직인관리' 시트에 들어간다. */
(function (EQ) {
  'use strict';
  const cat = EQ.cat, { esc } = EQ.util, F = EQ.fmt, CFG = EQ.CONFIG;
  const $ = id => document.getElementById(id);
  const today = () => new Date().toISOString().slice(0, 10);
  let afterClose = null, sigTarget = null;

  /** 그림(이미지/캔버스) → 정리된 PNG dataURL */
  function cleanStamp(src, w, h, removeWhite) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); g.drawImage(src, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h), px = d.data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, lum = (px[i] + px[i + 1] + px[i + 2]) / 3;
      if (removeWhite && lum > 225 && Math.max(px[i], px[i + 1], px[i + 2]) - Math.min(px[i], px[i + 1], px[i + 2]) < 30) px[i + 3] = 0;
      else if (removeWhite && lum > 190) px[i + 3] = Math.round(px[i + 3] * (225 - lum) / 35);
      if (px[i + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    g.putImageData(d, 0, 0);
    if (x1 < 0) return null;
    const pad = 4; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, sc = Math.min(1, 300 / Math.max(cw, ch));
    const out = document.createElement('canvas'); out.width = Math.round(cw * sc); out.height = Math.round(ch * sc);
    const og = out.getContext('2d'); og.imageSmoothingQuality = 'high'; og.drawImage(cv, x0, y0, cw, ch, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  }
  async function fromFile(file, removeWhite) {
    const bm = await createImageBitmap(file);
    const sc = Math.min(1, 1200 / Math.max(bm.width, bm.height));
    return cleanStamp(bm, Math.round(bm.width * sc), Math.round(bm.height * sc), removeWhite);
  }

  const usedCount = (role, name) => Object.values(cat.mergedHist()).reduce((n, list) => n + list.filter(h => (role === '담당자' ? h.m : h.l) === name).length, 0);

  function body() {
    const P = cat.people();
    const card = (p, i) => {
      const cur = cat.currentOf(p.role) === p, used = usedCount(p.role, p.name);
      return `<div class="pcard" data-i="${i}">
        <div class="pst">${p.img ? `<img src="${p.img}" alt="">` : '<span>직인 없음</span>'}</div>
        <div class="pinfo"><b>${esc(p.name)}</b>${cur ? '<span class="pill-cur">현재</span>' : ''}<small>사용 시작 ${esc(F.date(p.start) || '-')} · 이력 ${used}건</small>${p.note ? `<small>${esc(p.note)}</small>` : ''}</div>
        <div class="pops"><button class="btn sm" data-op="up">직인 올리기</button><button class="btn sm" data-op="sign">서명 그리기</button><button class="btn sm ghost" data-op="edit">수정</button><button class="btn sm ghost" data-op="del">삭제</button></div></div>`;
    };
    return `<p class="d">담당자나 팀장이 바뀌면 <b>새 사람을 등록</b>하세요. 지난 이력에는 원래 사람의 직인이 그대로 남고, 새로 적는 이력에는 사용 시작일이 가장 최근인 <b>현재</b> 사람이 기본으로 들어갑니다.</p>
      ${CFG.roles.map(role => `<div class="fsec"><h5>${role}</h5><div class="plist">${P.map((p, i) => [p, i]).filter(([p]) => p.role === role).map(([p, i]) => card(p, i)).join('') || '<p class="d">등록된 사람이 없습니다.</p>'}</div></div>`).join('')}
      <div class="fsec"><h5>새 사람 등록</h5>
        <div class="pform">
          <label class="mfield"><label>구분</label><div><select id="pRole">${CFG.roles.map(r => `<option>${r}</option>`).join('')}</select></div></label>
          <label class="mfield"><label>성명</label><div><input id="pName" placeholder="홍길동"></div></label>
          <label class="mfield"><label>사용 시작일</label><div><input id="pStart" type="date" value="${today()}"></div></label>
          <label class="mfield"><label>비고(선택)</label><div><input id="pNote" placeholder="예: 2026년 인사이동"></div></label>
        </div>
        <div class="row2"><label class="btn sm">직인·사인 그림 고르기<input type="file" id="pFile" accept="image/*" hidden></label><button class="btn sm" id="pSignNew">서명 그리기</button>
          <label class="ck"><input type="checkbox" id="pWhite" checked> 흰 배경 지우기</label><span class="pprev" id="pPrev"></span><span class="sp"></span><button class="btn sm dark" id="pAdd">등록</button></div>
      </div>
      <div class="sigpad" id="sigPad" hidden><p class="d">아래 칸에 마우스나 펜으로 서명하세요.</p><canvas id="sigCv" width="520" height="200"></canvas>
        <div class="row2"><button class="btn sm ghost" id="sigClear">지우기</button><span class="sp"></span><button class="btn sm ghost" id="sigCancel">취소</button><button class="btn sm dark" id="sigOk">이 서명 사용</button></div></div>`;
  }

  let newImg = '';
  function render() {
    $('peopleBody').innerHTML = body(); newImg = '';
    $('pFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; newImg = await fromFile(f, $('pWhite').checked) || ''; $('pPrev').innerHTML = newImg ? `<img src="${newImg}" alt="">` : '그림에서 직인을 찾지 못했습니다'; };
    $('pSignNew').onclick = () => openSig(null);
    $('pAdd').onclick = () => {
      const name = $('pName').value.trim(), role = $('pRole').value;
      if (!name) { cat.toast('성명을 입력하세요.'); return; }
      if (cat.people().some(p => p.role === role && p.name === name)) { cat.toast(`${role} ${name} 은(는) 이미 있습니다. 직인만 바꾸려면 [직인 올리기]를 쓰세요.`); return; }
      cat.setPeople([...cat.people(), { role, name, start: $('pStart').value, note: $('pNote').value.trim(), img: newImg }]);
      cat.toast(`${role} ${name} 등록`); render();
    };
    sigWire();
  }
  /* 서명 그리기 판 */
  function openSig(i) { sigTarget = i; $('sigPad').hidden = false; const c = $('sigCv'), g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); $('sigPad').scrollIntoView({ block: 'center' }); }
  function sigWire() {
    const c = $('sigCv'), g = c.getContext('2d'); let down = false, last = null;
    const pt = e => { const b = c.getBoundingClientRect(); return [(e.clientX - b.left) * c.width / b.width, (e.clientY - b.top) * c.height / b.height]; };
    c.onpointerdown = e => { down = true; last = pt(e); c.setPointerCapture(e.pointerId); };
    c.onpointermove = e => { if (!down) return; const p = pt(e); g.strokeStyle = '#1a1a1a'; g.lineWidth = 4; g.lineCap = g.lineJoin = 'round'; g.beginPath(); g.moveTo(...last); g.lineTo(...p); g.stroke(); last = p; };
    c.onpointerup = () => { down = false; };
    $('sigClear').onclick = () => g.clearRect(0, 0, c.width, c.height);
    $('sigCancel').onclick = () => { $('sigPad').hidden = true; };
    $('sigOk').onclick = () => {
      const img = cleanStamp(c, c.width, c.height, false); if (!img) { cat.toast('서명이 비어 있습니다.'); return; }
      $('sigPad').hidden = true;
      if (sigTarget == null) { newImg = img; $('pPrev').innerHTML = `<img src="${img}" alt="">`; }
      else { const P = cat.people().map(p => ({ ...p })); P[sigTarget].img = img; cat.setPeople(P); render(); cat.toast('서명을 바꿨습니다.'); }
    };
  }
  $('peopleBody').addEventListener('click', async e => {
    const b = e.target.closest('[data-op]'); if (!b) return;
    const i = +b.closest('.pcard').dataset.i, P = cat.people().map(p => ({ ...p })), p = P[i];
    if (b.dataset.op === 'up') {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = async () => { const f = inp.files[0]; if (!f) return; const img = await fromFile(f, $('pWhite').checked); if (!img) { cat.toast('그림에서 직인을 찾지 못했습니다.'); return; } P[i].img = img; cat.setPeople(P); render(); cat.toast(`${p.name} 직인을 바꿨습니다.`); };
      inp.click();
    } else if (b.dataset.op === 'sign') openSig(i);
    else if (b.dataset.op === 'edit') {
      const name = prompt('성명', p.name); if (name == null) return;
      const start = prompt('사용 시작일 (YYYY-MM-DD)', p.start || today()); if (start == null) return;
      const nn = name.trim() || p.name;
      if (nn !== p.name) {                                  // 이름을 바꾸면 그 사람이 쓰인 이력도 함께 바꿈
        const H = cat.mergedHist();
        Object.entries(H).forEach(([k, list]) => { if (list.some(h => (p.role === '담당자' ? h.m : h.l) === p.name)) cat.setHist(k, list.map(h => p.role === '담당자' ? { ...h, m: h.m === p.name ? nn : h.m } : { ...h, l: h.l === p.name ? nn : h.l })); });
      }
      P[i] = { ...p, name: nn, start: F.iso(start) || start }; cat.setPeople(P); render();
    } else if (b.dataset.op === 'del') {
      const n = usedCount(p.role, p.name);
      if (n) { cat.toast(`이력 ${n}건에 쓰인 사람이라 지울 수 없습니다. 직인만 바꾸거나 새 사람을 등록하세요.`); return; }
      if (!confirm(`${p.role} ${p.name} 을(를) 지울까요?`)) return;
      P.splice(i, 1); cat.setPeople(P); render();
    }
  });

  function open(cb) { afterClose = cb || null; render(); $('people').classList.add('show'); $('people').setAttribute('aria-hidden', 'false'); }
  function close() { $('people').classList.remove('show'); $('people').setAttribute('aria-hidden', 'true'); if (afterClose) { const f = afterClose; afterClose = null; f(); } }
  $('people').addEventListener('click', e => { if (e.target === $('people') || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('people').classList.contains('show') && !/INPUT|SELECT/.test(document.activeElement.tagName)) close(); });
  cat.peopleUI = { open, close };
})(window.EQ = window.EQ || {});
