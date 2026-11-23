/* [부품 G2] 사진 찾기 — 파일명(확장자 뺀 것)이 관리번호와 같은 사진을 연결
 *  '04-장비-05.jpg' 정확히 일치 우선, 없으면 '04-장비-05_1.jpg'·'04-장비-05 (2).png' 처럼 뒤에 구분기호가 붙은 것.
 *  맥(macOS)에서 온 한글 파일명(NFD)도 NFC 로 바꿔 비교한다. */
(function (EQ) {
  'use strict';
  const { normKey } = EQ.util;
  const IMG_EXT = ['jpg', 'jpeg', 'jpe', 'jfif', 'png', 'gif', 'bmp', 'webp', 'heic', 'heif', 'tif', 'tiff', 'avif'];
  const extOf = n => { const m = /\.([A-Za-z0-9]+)$/.exec(n); return m ? m[1].toLowerCase() : ''; };
  const isImage = f => IMG_EXT.includes(extOf(f.name));

  /** File[] → 정렬된 색인 [{file, name, key}] */
  function index(files) {
    return [...files].filter(isImage)
      .map(f => ({ file: f, name: f.name.normalize('NFC'), key: normKey(f.name.replace(/\.[A-Za-z0-9]+$/, '')) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
  }
  /** 레코드 → {entry, multi} | null */
  function find(rec, idx) {
    const exact = idx.filter(i => i.key === rec.key);
    if (exact.length) return { entry: exact[0], multi: exact.length };
    const re = new RegExp('^' + rec.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![0-9a-z가-힣])');
    const part = idx.filter(i => re.test(i.key));
    return part.length ? { entry: part[0], multi: part.length } : null;
  }
  EQ.match = { index, find, isImage, extOf, IMG_EXT };
})(window.EQ = window.EQ || {});
