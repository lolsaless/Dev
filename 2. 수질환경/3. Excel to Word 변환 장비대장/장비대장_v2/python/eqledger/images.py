"""[부품 P5] 사진 찾기·변환 — JS generator/js/10_image_convert.js · 20_image_match.js 와 같은 규칙
    scan(folder) → 색인,  find(rec, index) → (entry, 개수),  process(path) → dict(bytes, ext, w, h, note, key)
    thumb_data_url(photo, edge, quality) → 카탈로그용 data URL"""
import base64
import io
import os
import re

from PIL import Image, ImageOps

from .config import CONFIG
from .util import fmt_bytes, nfc, norm_key

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
    HAVE_HEIF = True
except Exception:   # pillow-heif 미설치
    HAVE_HEIF = False

IMG_EXT = {'jpg', 'jpeg', 'jpe', 'jfif', 'png', 'gif', 'bmp', 'webp', 'heic', 'heif', 'tif', 'tiff', 'avif'}


def scan(folder):
    out = []
    for root, _, files in os.walk(folder):
        for f in files:
            ext = f.rsplit('.', 1)[-1].lower() if '.' in f else ''
            if ext in IMG_EXT and not f.startswith('._'):
                name = nfc(f)
                out.append(dict(path=os.path.join(root, f), name=name, key=norm_key(name.rsplit('.', 1)[0])))
    out.sort(key=lambda e: [int(t) if t.isdigit() else t for t in re.split(r'(\d+)', e['name'])])
    return out


def find(rec, index):
    exact = [e for e in index if e['key'] == rec['key']]
    if exact:
        return exact[0], len(exact)
    rx = re.compile('^' + re.escape(rec['key']) + r'(?![0-9a-z가-힣])')
    part = [e for e in index if rx.match(e['key'])]
    return (part[0], len(part)) if part else (None, 0)


def sniff(b):
    if b[:2] == b'\xff\xd8': return 'jpg'
    if b[:4] == b'\x89PNG': return 'png'
    if b[:3] == b'GIF': return 'gif'
    if b[:2] == b'BM': return 'bmp'
    if b[:4] == b'RIFF' and b[8:12] == b'WEBP': return 'webp'
    if b[:4] in (b'II*\x00', b'MM\x00*'): return 'tiff'
    if b[4:8] == b'ftyp':
        return 'avif' if b[8:12] in (b'avif', b'avis') else 'heic'
    return 'unknown'


def _jpeg(im, quality):
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=quality, optimize=True)
    return buf.getvalue()


def _rgb(im):
    if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
        im = im.convert('RGBA')
        bg = Image.new('RGB', im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        return bg
    return im.convert('RGB')


def _resized(im, cap):
    sc = min(1.0, cap / max(im.size))
    return im if sc >= 1 else im.resize((max(1, round(im.width * sc)), max(1, round(im.height * sc))), Image.LANCZOS)


def _compress(im, target):
    best = None
    for cap in (2000, 1600, 1280, 1024, 800, 640):
        r = _resized(im, cap)
        lo_b = _jpeg(r, 40)
        if len(lo_b) > target:
            best = (lo_b, r.size, 40)
            continue
        hi_b = _jpeg(r, 92)
        if len(hi_b) <= target:
            return hi_b, r.size, 92
        lo, hi, ok = 40, 92, (lo_b, 40)
        while hi - lo > 1:
            mid = (lo + hi) // 2
            b = _jpeg(r, mid)
            if len(b) <= target:
                lo, ok = mid, (b, mid)
            else:
                hi = mid
        return ok[0], r.size, ok[1]
    return best


def process(path, limit_kb=None, target_kb=None):
    limit = (limit_kb or CONFIG['image']['limitKB']) * 1024
    target = (target_kb or CONFIG['image']['targetKB']) * 1000
    raw = open(path, 'rb').read()
    orig, kind = len(raw), sniff(raw)
    if kind == 'unknown':
        raise ValueError('지원하지 않는 이미지 형식')
    if kind == 'heic' and not HAVE_HEIF:
        raise ValueError('HEIC 변환에는 pillow-heif 가 필요합니다 (pip install pillow-heif)')
    im = Image.open(io.BytesIO(raw))
    orient = im.getexif().get(0x0112, 1) if kind == 'jpg' else 1
    label = kind.upper()
    if kind in ('jpg', 'png') and orig < limit and orient == 1:
        return dict(bytes=raw, ext=kind, w=im.width, h=im.height, key=path, note='%s %s 그대로' % (label, fmt_bytes(orig)))
    im = _resized(_rgb(ImageOps.exif_transpose(im)), CONFIG['image']['maxEdge'])
    data, size, tag = _jpeg(im, 92), im.size, ''
    if orig >= limit or len(data) >= limit:
        data, size, qq = _compress(im, target)
        tag = ' (%dx%d, 화질 %d)' % (size[0], size[1], qq) + (' ※목표 초과' if len(data) > target else '')
    act = ('회전 보정' if orient > 1 else '축소') if kind in ('jpg', 'png') else '변환'
    return dict(bytes=data, ext='jpg', w=size[0], h=size[1], key=path,
                note='%s %s → JPG %s%s [%s]' % (label, fmt_bytes(orig), fmt_bytes(len(data)), tag, act))


def thumb_data_url(photo, edge=900, quality=0.78):
    im = _resized(_rgb(ImageOps.exif_transpose(Image.open(io.BytesIO(photo['bytes'])))), edge)
    return 'data:image/jpeg;base64,' + base64.b64encode(_jpeg(im, int(quality * 100))).decode()
