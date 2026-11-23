/* [부품 G1] 사진 변환 — 형식 판별 → (HEIC/TIFF/WEBP/BMP/GIF/AVIF → JPG) → EXIF 회전 보정 → 용량 줄이기
 *  EQ.img.process(file, {limitKB, targetKB, maxEdge}) → {bytes, ext, w, h, orig, note}
 *  EQ.img.thumb(photo, edge, quality) → dataURL (카탈로그용 축소본)
 *  의존: heic2any(HEIC), UTIF(TIFF) — 둘 다 HTML 안에 내장 */
(function (EQ) {
  'use strict';
  const { fmtBytes } = EQ.util;

  function sniff(u8) {
    if (u8[0] === 0xFF && u8[1] === 0xD8) return 'jpg';
    if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47) return 'png';
    if (u8[0] === 0x47 && u8[1] === 0x49 && u8[2] === 0x46) return 'gif';
    if (u8[0] === 0x42 && u8[1] === 0x4D) return 'bmp';
    if (u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 && u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50) return 'webp';
    if ((u8[0] === 0x49 && u8[1] === 0x49 && u8[2] === 0x2A && u8[3] === 0) || (u8[0] === 0x4D && u8[1] === 0x4D && u8[2] === 0 && u8[3] === 0x2A)) return 'tiff';
    if (u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) {
      const brand = String.fromCharCode(u8[8], u8[9], u8[10], u8[11]);
      return brand === 'avif' || brand === 'avis' ? 'avif' : 'heic';
    }
    return 'unknown';
  }
  function jpegOrientation(u8) {
    try {
      if (u8[0] !== 0xFF || u8[1] !== 0xD8) return 1;
      const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      let p = 2;
      while (p + 4 < u8.length && u8[p] === 0xFF) {
        const m = u8[p + 1], len = dv.getUint16(p + 2);
        if (m === 0xE1 && u8[p + 4] === 0x45 && u8[p + 5] === 0x78 && u8[p + 6] === 0x69 && u8[p + 7] === 0x66) {
          const t = p + 10, le = u8[t] === 0x49, ifd = t + dv.getUint32(t + 4, le), n = dv.getUint16(ifd, le);
          for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (dv.getUint16(e, le) === 0x0112) return dv.getUint16(e + 8, le); }
          return 1;
        }
        if (m === 0xDA) break;
        p += 2 + len;
      }
    } catch (_) {}
    return 1;
  }
  const toBlob = (cv, q) => new Promise(res => cv.toBlob(res, 'image/jpeg', q));
  function draw(src, sw, sh, scale) {
    const w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h);
    return cv;
  }
  async function decode(buf, kind) {
    if (kind === 'heic') {
      try {
        let out = await heic2any({ blob: new Blob([buf]), toType: 'image/jpeg', quality: 0.92 });
        if (Array.isArray(out)) out = out[0];
        const bm = await createImageBitmap(out); return { src: bm, w: bm.width, h: bm.height };
      } catch (e1) {
        try { const bm = await createImageBitmap(new Blob([buf], { type: 'image/heic' }), { imageOrientation: 'from-image' }); return { src: bm, w: bm.width, h: bm.height }; }
        catch (_) { throw new Error('HEIC 해석 실패 — 아이폰 사진 앱에서 JPG로 내보낸 뒤 다시 시도'); }
      }
    }
    if (kind === 'tiff') {
      const ifds = UTIF.decode(buf); if (!ifds.length) throw new Error('TIFF 해석 실패');
      UTIF.decodeImage(buf, ifds[0]);
      const rgba = UTIF.toRGBA8(ifds[0]), w = ifds[0].width, h = ifds[0].height;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, w * h * 4), w, h), 0, 0);
      return { src: cv, w, h };
    }
    const mime = { jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', avif: 'image/avif' }[kind] || '';
    const bm = await createImageBitmap(new Blob([buf], { type: mime }), { imageOrientation: 'from-image' });
    return { src: bm, w: bm.width, h: bm.height };
  }
  /** 해상도·화질을 단계적으로 낮춰 target 바이트 이하로 */
  async function compress(src, sw, sh, target) {
    let best = null;
    for (const cap of [2000, 1600, 1280, 1024, 800, 640]) {
      const cv = draw(src, sw, sh, Math.min(1, cap / Math.max(sw, sh)));
      const lo0 = await toBlob(cv, 0.4);
      if (lo0.size > target) { best = { blob: lo0, w: cv.width, h: cv.height, q: 0.4 }; continue; }
      const hiB = await toBlob(cv, 0.92);
      if (hiB.size <= target) return { blob: hiB, w: cv.width, h: cv.height, q: 0.92 };
      let lo = 0.4, hi = 0.92, ok = { blob: lo0, q: 0.4 };
      for (let i = 0; i < 6; i++) { const mid = (lo + hi) / 2, b = await toBlob(cv, mid); if (b.size <= target) { lo = mid; ok = { blob: b, q: mid }; } else hi = mid; }
      return { blob: ok.blob, w: cv.width, h: cv.height, q: ok.q };
    }
    return best;
  }

  async function process(file, opt) {
    const limit = (opt.limitKB || 1024) * 1024, target = (opt.targetKB || 300) * 1000, maxEdge = opt.maxEdge || 2400;
    const buf = await file.arrayBuffer(), u8 = new Uint8Array(buf), orig = file.size;
    const kind = sniff(u8); if (kind === 'unknown') throw new Error('지원하지 않는 이미지 형식');
    const d = await decode(buf, kind);
    const orient = kind === 'jpg' ? jpegOrientation(u8) : 1, label = kind.toUpperCase();
    if ((kind === 'jpg' || kind === 'png') && orig < limit && orient === 1)
      return { bytes: u8, ext: kind, w: d.w, h: d.h, orig, note: `${label} ${fmtBytes(orig)} 그대로` };
    const cv0 = draw(d.src, d.w, d.h, Math.min(1, maxEdge / Math.max(d.w, d.h)));
    let blob = await toBlob(cv0, 0.92), w = cv0.width, h = cv0.height, tag = '';
    if (orig >= limit || blob.size >= limit) {
      const r = await compress(d.src, d.w, d.h, target);
      blob = r.blob; w = r.w; h = r.h; tag = ` (${w}×${h}, 화질 ${Math.round(r.q * 100)})` + (blob.size > target ? ' ※목표 초과' : '');
    }
    const out = new Uint8Array(await blob.arrayBuffer());
    const act = kind === 'jpg' || kind === 'png' ? (orient > 1 ? '회전 보정' : '축소') : '변환';
    return { bytes: out, ext: 'jpg', w, h, orig, note: `${label} ${fmtBytes(orig)} → JPG ${fmtBytes(out.length)}${tag} [${act}]` };
  }

  async function thumb(photo, edge, q) {
    const bm = await createImageBitmap(new Blob([photo.bytes], { type: photo.ext === 'png' ? 'image/png' : 'image/jpeg' }));
    const cv = draw(bm, bm.width, bm.height, Math.min(1, edge / Math.max(bm.width, bm.height)));
    return cv.toDataURL('image/jpeg', q);
  }
  EQ.img = { process, thumb, sniff };
})(window.EQ = window.EQ || {});
