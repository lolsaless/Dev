"""[부품 P7] 실행 흐름 — 사진 처리 → Word → 카탈로그 (창·명령행이 함께 사용)"""
import os
import zipfile
from datetime import datetime

from .catalog import build_catalog_html
from .config import CONFIG, TEMPLATE_PATH
from .docx_builder import DocBuilder, stamps_from_people
from .images import find, process
from .util import fmt_bytes, safe_name


def gather_photos(records, index, limit_kb=None, target_kb=None, log=print, progress=lambda a, b: None):
    cache, photos, stat = {}, [], dict(photo=0, none=0, conv=0, err=0)
    for k, rec in enumerate(records):
        ph = None
        if index:
            e, multi = find(rec, index)
            if e:
                if e['path'] not in cache:
                    try:
                        cache[e['path']] = process(e['path'], limit_kb, target_kb)
                        log('[%s] %s: %s' % (rec['id'], e['name'], cache[e['path']]['note']))
                        if multi > 1:
                            log('[%s] 같은 관리번호 사진 %d장 — 이름순 첫 장 사용' % (rec['id'], multi))
                    except Exception as ex:
                        cache[e['path']] = None
                        stat['err'] += 1
                        log('[%s] 사진 오류 %s — %s' % (rec['id'], e['name'], ex))
                ph = cache[e['path']]
        if ph:
            stat['photo'] += 1
            stat['conv'] += '→' in ph['note']
        else:
            stat['none'] += 1
        photos.append(ph)
        progress(k + 1, len(records))
    return photos, stat


def generate(book, res, records, index, out_path, zip_mode=False, date_style='dot', limit_kb=None, target_kb=None,
             catalog=True, word=True, log=print, progress=lambda a, b: None):
    """반환: 만든 파일 경로 목록"""
    n, made = len(records), []
    log('선택 %d대 — %s%s' % (n, ('장비별 Word→ZIP' if zip_mode else '하나의 Word 파일') if word else '카탈로그만', ' + 카탈로그' if catalog and word else ''))
    photos, stat = gather_photos(records, index, limit_kb, target_kb, log, lambda a, b: progress(a, b * 2))
    template = open(TEMPLATE_PATH, 'rb').read()
    cat_html = build_catalog_html(records, photos, book.path, book.snapshot(), log=log, extra=res) if catalog else None
    stamps = stamps_from_people(res.get('people'))
    title = CONFIG['title'].replace(' ', '_')
    out_dir = os.path.dirname(os.path.abspath(out_path))
    stamp = datetime.now().strftime('%Y%m%d')
    warns = []
    if word:
        if zip_mode:
            out_path = os.path.splitext(out_path)[0] + '.zip'
            dup, used = {}, set()
            for r in records:
                dup[r['key']] = dup.get(r['key'], 0) + 1
            with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_STORED) as z:
                for k, rec in enumerate(records):
                    b = DocBuilder(template, date_style, stamps)
                    w = b.append(rec, photos[k])
                    if w:
                        warns.append((rec, w))
                    nm = safe_name(rec['id']) + ('_' + (rec['seq'] or str(rec['row'])) if dup[rec['key']] > 1 else '') \
                        + '_' + safe_name(rec['name'])[:30].strip().rstrip('. ')
                    while nm in used:
                        nm += '_x'
                    used.add(nm)
                    z.writestr(nm + '.docx', b.finish())
                    progress(n + k + 1, n * 2)
                if cat_html:
                    z.writestr('%s.html' % title, cat_html)
        else:
            b = DocBuilder(template, date_style, stamps)
            for k, rec in enumerate(records):
                w = b.append(rec, photos[k])
                if w:
                    warns.append((rec, w))
                progress(n + k + 1, n * 2)
            open(out_path, 'wb').write(b.finish())
        made.append(out_path)
        log('완료: %s (%s, %d대 × 2쪽)' % (out_path, fmt_bytes(os.path.getsize(out_path)), n))
    if cat_html and not (word and zip_mode):
        cp = os.path.join(out_dir, '%s_%s.html' % (title, stamp))
        open(cp, 'w', encoding='utf-8').write(cat_html)
        made.append(cp)
        log('완료: %s (%s)' % (cp, fmt_bytes(os.path.getsize(cp))))
    for rec, w in warns:
        log('[%s] %s' % (rec['id'], ' / '.join(w)))
    log('사진 반영 %d대 · 사진 없음 %d대 · 변환/축소 %d대 · 오류 %d건' % (stat['photo'], stat['none'], stat['conv'], stat['err']))
    return made
