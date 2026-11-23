"""[부품 P9] 명령행 — 인자가 없으면 창(GUI)을 연다.

python 장비관리대장_생성기.py --xlsx 통합.xlsx --images 사진폴더 [--out 결과.docx]
      [--sheets 장비대장,기타장비] [--comp 장비구성] [--zip] [--no-catalog] [--catalog-only]
      [--only 04-장비-05,04-장비-98] [--date dot|dash|kr|han] [--limit 1024] [--target 300]
"""
import argparse
import os
from datetime import datetime

from . import VERSION
from .excel_reader import open_book
from .generate import generate
from .images import scan
from .util import norm_key


def run_cli(a):
    book = open_book(a.xlsx)
    sheets = [s.strip() for s in a.sheets.split(',')] if a.sheets else book.default_sheets
    comp = book.comp_sheet if a.comp is None else a.comp
    records, warnings = book.read(sheets, comp)
    print('장비 %d대 (시트: %s) · 장비구성 시트: %s' % (len(records), ', '.join(sheets), comp or '없음'))
    for w in warnings:
        print('※', w)
    if a.only:
        want = {norm_key(x) for x in a.only.split(',')}
        records = [r for r in records if r['key'] in want]
    index = scan(a.images) if a.images else []
    out = a.out or os.path.join(os.path.dirname(os.path.abspath(a.xlsx)), '시험장비관리대장_%s.docx' % datetime.now().strftime('%Y%m%d'))
    generate(book, records, index, out, a.zip, a.date, a.limit, a.target, catalog=not a.no_catalog, word=not a.catalog_only)


def main(argv=None):
    ap = argparse.ArgumentParser(description='장비관리대장 생성기 v' + VERSION)
    ap.add_argument('--xlsx'); ap.add_argument('--images'); ap.add_argument('--out')
    ap.add_argument('--sheets', help='장비 시트(쉼표). 생략하면 장비대장·기타장비')
    ap.add_argument('--comp', help="장비구성 시트 이름 ('' 이면 사용 안 함)")
    ap.add_argument('--zip', action='store_true', help='장비별 Word 파일을 ZIP 으로')
    ap.add_argument('--no-catalog', action='store_true'); ap.add_argument('--catalog-only', action='store_true')
    ap.add_argument('--only', help='관리번호(쉼표)만 만들기')
    ap.add_argument('--date', default='dot', choices=['dot', 'dash', 'kr', 'han'])
    ap.add_argument('--limit', type=int); ap.add_argument('--target', type=int)
    a = ap.parse_args(argv)
    if a.xlsx:
        run_cli(a)
    else:
        from .gui import run_gui
        run_gui()
