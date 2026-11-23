"""[부품 P2] 엑셀 읽기 — JS shared/js/20_excel_reader.js 와 같은 레코드(dict)를 만든다.

    book = open_book('장비관리대장 통합.xlsx')
    book.ledger_sheets, book.comp_sheet, book.default_sheets
    records, warnings = book.read(['장비대장', '기타장비'], '장비구성')
    book.snapshot()   # 카탈로그 '엑셀 원본 보기'용
"""
import re
import openpyxl
from .config import CONFIG
from .util import iso, date_parts, norm_hdr, norm_key, num, sval

COLS = CONFIG['columns']
CCOLS = CONFIG['componentColumns']
HCOLS = CONFIG['historyColumns']
PCOLS = CONFIG['peopleColumns']


def sheet_order(n):
    o = CONFIG['sheets']['order']
    return o.index(n) if n in o else 50


def _one_line(v):
    return re.sub(r'\s*\n\s*', ' ', sval(v)).strip()


def col_idx(hdr, aliases, pick=None):
    keys = [norm_hdr(a) for a in aliases]
    found = -1
    for i, h in enumerate(hdr):
        if h in keys:
            found = i
            if pick != 'last':
                return i
    return found


def _header_row(rows):
    return next((i for i, r in enumerate(rows) if any(norm_hdr(c) == '관리번호' for c in r)), -1)


class Book:
    def __init__(self, path):
        self.path = path
        self.wb = openpyxl.load_workbook(path, data_only=True)
        self.sheet_names = self.wb.sheetnames
        self._rows = {n: [list(r) for r in self.wb[n].iter_rows(values_only=True)] for n in self.sheet_names}
        excl = re.compile(CONFIG['sheets']['exclude'], re.I)
        self.ledger_sheets = sorted([n for n in self.sheet_names if not excl.search(n) and self._is_ledger(n)], key=sheet_order)
        self.hist_sheet = CONFIG['sheets']['historySheet'] if CONFIG['sheets']['historySheet'] in self.sheet_names else ''
        self.people_sheet = CONFIG['sheets']['peopleSheet'] if CONFIG['sheets']['peopleSheet'] in self.sheet_names else ''
        self.id_of = {}
        comp_re = re.compile(CONFIG['sheets']['componentPattern'], re.I)
        self.comp_sheet = next((n for n in self.sheet_names if comp_re.search(n) and n not in self.ledger_sheets), '')
        on = [n for n in self.ledger_sheets if n in CONFIG['sheets']['defaultOn']]
        self.default_sheets = on or self.ledger_sheets[:1]

    def _is_ledger(self, name):
        rows = self._rows[name]
        hi = _header_row(rows)
        return hi >= 0 and col_idx([norm_hdr(c) for c in rows[hi]], COLS['name']['aliases']) >= 0

    def _ledger(self, name):
        rows = self._rows[name]
        hi = _header_row(rows)
        if hi < 0:
            raise ValueError("[%s] '관리번호' 열을 찾지 못했습니다." % name)
        hdr = [norm_hdr(c) for c in rows[hi]]
        C = {f: col_idx(hdr, d['aliases'], d.get('pick')) for f, d in COLS.items()}
        date_cols = [i for i in (col_idx(hdr, [a]) for a in COLS['date']['aliases']) if i >= 0]
        miss = [d['aliases'][0] for f, d in COLS.items() if d.get('required') and C[f] < 0]
        if miss:
            raise ValueError('[%s] 필수 열이 없습니다: %s' % (name, ', '.join(miss)))

        def get(r, f):
            i = C[f]
            return r[i] if 0 <= i < len(r) else None
        out = []
        for i in range(hi + 1, len(rows)):
            r = rows[i]
            rid = sval(get(r, 'id')).strip()
            if not rid:
                continue
            d_raw = next((r[c] for c in date_cols if c < len(r) and r[c] not in (None, '')), None)
            dp = date_parts(d_raw)
            q = num(get(r, 'qty'))
            out.append(dict(
                uid='%s#%d' % (name, i + 1), sheet=name, row=i + 1,
                seq=sval(get(r, 'seq')).strip(), id=rid, key=norm_key(rid),
                serial=sval(get(r, 'serial')).strip(), item=sval(get(r, 'item')).strip(),
                name=_one_line(get(r, 'name')), nameExt=_one_line(get(r, 'nameExt')),
                spec=sval(get(r, 'spec')).strip(), maker=sval(get(r, 'maker')).strip(),
                country=sval(get(r, 'country')).strip(),
                date=iso(d_raw), year=dp[0] if dp else num(get(r, 'year')),
                qty=q if q and q > 0 else 1, price=num(get(r, 'price')),
                status=sval(get(r, 'status')).strip(), usage=sval(get(r, 'usage')).strip(),
                remark=sval(get(r, 'remark')).strip(), place=sval(get(r, 'place')).strip(),
                vendor=sval(get(r, 'vendor')).strip(), addr=sval(get(r, 'addr')).strip(),
                tel=sval(get(r, 'tel')).strip(), telNote=sval(get(r, 'telNote')).strip(),
                cond=sval(get(r, 'cond')).strip(), note=sval(get(r, 'note')).rstrip(),
                outDate=iso(get(r, 'outDate')), inDate=iso(get(r, 'inDate')), comps=[]))
        return out

    def _components(self, name):
        comp = {}
        rows = self._rows.get(name) or []
        if not rows:
            return comp
        hi = _header_row(rows)
        if hi < 0:
            raise ValueError("장비구성 시트에서 '관리번호' 열을 찾지 못했습니다.")
        hdr = [norm_hdr(c) for c in rows[hi]]
        ci, cn, cq, cu, cs = (col_idx(hdr, CCOLS[k]) for k in ('id', 'name', 'qty', 'unit', 'seq'))
        if cn < 0:
            raise ValueError("장비구성 시트에서 구성품 이름 열('내용' 또는 '장비명')을 찾지 못했습니다.")
        cell = lambda r, i: r[i] if 0 <= i < len(r) else None
        for i in range(hi + 1, len(rows)):
            r = rows[i]
            rid = sval(cell(r, ci)).strip()
            n = '\n'.join(x.strip() for x in sval(cell(r, cn)).replace('\r', '').split('\n') if x.strip())
            if not rid or not n:
                continue
            sn = num(cell(r, cs))
            self.id_of.setdefault(norm_key(rid), rid)
            comp.setdefault(norm_key(rid), []).append(dict(n=n, q=sval(cell(r, cq)).strip(), u=sval(cell(r, cu)).strip(),
                                                          _s=sn if isinstance(sn, (int, float)) else 1e6 + i))
        for v in comp.values():
            v.sort(key=lambda c: c['_s'])
            for c in v:
                c.pop('_s')
        return comp

    def _history(self, name):
        out, rows = {}, self._rows.get(name) or []
        hi = _header_row(rows)
        if hi < 0:
            return out
        hdr = [norm_hdr(c) for c in rows[hi]]
        ci, cs, cd, cc, cm, cl = (col_idx(hdr, HCOLS[k]) for k in ('id', 'seq', 'date', 'content', 'manager', 'leader'))
        cell = lambda r, i: r[i] if 0 <= i < len(r) else None
        for i in range(hi + 1, len(rows)):
            r = rows[i]
            rid = sval(cell(r, ci)).strip()
            if not rid:
                continue
            d = cell(r, cd)
            h = dict(d=iso(d) or sval(d).strip(), c=sval(cell(r, cc)).strip(), m=sval(cell(r, cm)).strip(), l=sval(cell(r, cl)).strip())
            if not h['d'] and not h['c']:
                continue
            sn = num(cell(r, cs))
            h['_s'] = sn if isinstance(sn, (int, float)) else 1e6 + i
            self.id_of.setdefault(norm_key(rid), rid)
            out.setdefault(norm_key(rid), []).append(h)
        for v in out.values():
            v.sort(key=lambda h: h['_s'])
            for h in v:
                h.pop('_s')
        return out

    def _people(self, name):
        rows, out = self._rows.get(name) or [], []
        names = [norm_hdr(a) for a in PCOLS['name']]
        hi = next((i for i, r in enumerate(rows) if any(norm_hdr(c) in names for c in r)), -1)
        if hi < 0:
            return out
        hdr = [norm_hdr(c) for c in rows[hi]]
        cr, cn, cs, cnote = (col_idx(hdr, PCOLS[k]) for k in ('role', 'name', 'start', 'note'))
        pre = norm_hdr(PCOLS['dataPrefix'])
        dcols = sorted([i for i, h in enumerate(hdr) if h.startswith(pre)], key=lambda i: int(re.sub(r'\D', '', hdr[i]) or 0))
        cell = lambda r, i: r[i] if 0 <= i < len(r) else None
        for i in range(hi + 1, len(rows)):
            r = rows[i]
            nm = sval(cell(r, cn)).strip()
            if not nm:
                continue
            img = ''.join(sval(cell(r, c)) for c in dcols).strip()
            st = cell(r, cs)
            out.append(dict(role=sval(cell(r, cr)).strip() or CONFIG['roles'][0], name=nm, start=iso(st) or sval(st).strip(),
                            note=sval(cell(r, cnote)).strip(), img=img if img.startswith('data:image/') else ''))
        return out

    def count(self, name):
        return len(self._ledger(name))

    def read(self, sheets, comp_sheet):
        """반환 dict(records, warnings, compsAll, histAll, people, compSheet, idOf) — records 는 시트 순서대로, 이관 중복 제거"""
        records, warnings = [], []
        ordered = sorted(sheets, key=sheet_order)
        for s in ordered:
            records += self._ledger(s)
        T = CONFIG['sheets']['transfer']
        if T in ordered:
            moved = [r for r in records if r['sheet'] == T]
            dropped = [r for r in records if r['sheet'] != T and any(m['key'] == r['key'] and (not m['serial'] or not r['serial'] or m['serial'] == r['serial']) for m in moved)]
            if dropped:
                records = [r for r in records if r not in dropped]
                warnings.append('%s 시트에도 있어 다른 시트에서 뺀 장비: %s' % (T, ', '.join('%s(%s %d행)' % (r['id'], r['sheet'], r['row']) for r in dropped)))
        cm = self._components(comp_sheet) if comp_sheet else {}
        hm = self._history(self.hist_sheet) if self.hist_sheet else {}
        people = self._people(self.people_sheet) if self.people_sheet else []
        for r in records:
            r['comps'] = [dict(c) for c in cm.get(r['key'], [])]
            r['hist'] = [dict(h) for h in hm.get(r['key'], [])]
        known = {r['key'] for r in records}
        orphan = [k for k in cm if k not in known]
        if orphan:
            warnings.append('장비구성 시트의 관리번호 중 선택한 시트에 없는 것: ' + ', '.join(orphan))
        mx = CONFIG['form']['comp']['maxRows']
        over = [r['id'] for r in records if len(r['comps']) > mx]
        if over:
            warnings.append('구성내역이 %d행을 넘는 장비(Word에는 앞 %d행만): %s' % (mx, mx, ', '.join(over)))
        return dict(records=records, warnings=warnings, compsAll=cm, histAll=hm, people=people, compSheet=comp_sheet, idOf=dict(self.id_of))

    def snapshot(self):
        """[{name, header, rows:[[행번호, 칸...]], idCol}] — JS snapshot() 과 같은 형식"""
        out = []
        for n in self.sheet_names:
            trunc = lambda v: '(직인 그림 데이터)' if (v.startswith('data:image/') or (len(v) > 3000 and not re.search(r'\s', v))) else v
            filled = [(i + 1, [trunc(sval(c)) for c in r]) for i, r in enumerate(self._rows[n]) if any(c not in (None, '') for c in r)]
            if not filled:
                out.append(dict(name=n, header=[], rows=[], idCol=-1))
                continue
            w = max((max((j + 1 for j, c in enumerate(r) if c != ''), default=0) for _, r in filled), default=0)
            pad = lambda r: [r[j] if j < len(r) else '' for j in range(w)]
            header = pad(filled[0][1])
            out.append(dict(name=n, header=header, idCol=next((j for j, h in enumerate(header) if norm_hdr(h) == '관리번호'), -1),
                            rows=[[no] + pad(r) for no, r in filled[1:]]))
        return out


def open_book(path):
    return Book(path)
