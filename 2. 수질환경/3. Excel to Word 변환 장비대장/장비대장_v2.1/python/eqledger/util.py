"""[부품 P1] 공통 유틸·형식 — JS shared/js/00_core.js · 10_format.js 와 같은 규칙"""
import re
import unicodedata
from datetime import date, datetime, timedelta


def nfc(s):
    return unicodedata.normalize('NFC', '' if s is None else str(s))


def norm_key(s):
    return re.sub(r'\s+', '', re.sub('[‐-―−ー－]', '-', nfc(s))).lower()


def norm_hdr(s):
    return re.sub(r'\s+', '', nfc(s)).lower()


def clean_xml(s):
    s = '' if s is None else str(s)
    s = re.sub('[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]', '', s)
    return s.replace('\r\n', '\n').replace('\r', '\n')


def sval(v):
    """엑셀 값 → 문자열 (1.0 → '1', 날짜 → YYYY-MM-DD)"""
    if v is None:
        return ''
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    if isinstance(v, (datetime, date)):
        return iso(v)
    return str(v)


def fmt_bytes(n):
    return '%.2fMB' % (n / 1048576) if n >= 1048576 else '%dKB' % round(n / 1024)


def safe_name(s):
    return re.sub(r'[\\/:*?"<>|\r\n]+', '_', nfc(s)).strip()


def date_parts(v):
    if v in (None, ''):
        return None
    if isinstance(v, (datetime, date)):
        return v.year, v.month, v.day
    if isinstance(v, (int, float)) and 59 < v < 80000:
        t = datetime(1899, 12, 30) + timedelta(days=round(v))
        return t.year, t.month, t.day
    m = re.search(r'(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})', str(v))
    return (int(m[1]), int(m[2]), int(m[3])) if m else None


def iso(v):
    p = date_parts(v)
    return '%04d-%02d-%02d' % p if p else ''


def fmt_date(v, style='dot'):
    p = date_parts(v)
    if not p:
        return '' if v is None else str(v)
    y, m, d = p
    return {'dash': '%d-%02d-%02d' % p, 'kr': '%d. %d. %d.' % p, 'han': '%d년 %d월 %d일' % p}.get(style, '%d.%02d.%02d' % p)


def num(v):
    if v in (None, ''):
        return None
    if isinstance(v, (int, float)):
        return int(v) if float(v).is_integer() else v
    try:
        n = float(re.sub(r'[,\s원]', '', str(v)))
        return int(n) if n.is_integer() else n
    except ValueError:
        return None


def won(v):
    n = num(v)
    return '' if n is None else '{:,}'.format(int(round(n)))
