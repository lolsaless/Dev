"""[부품 P3] 글자 크기 자동 맞춤 — JS shared/js/30_text_fit.js 와 같은 계산"""
import re
from .config import FORM
from .util import clean_xml

_TOK = re.compile(r'[A-Za-z0-9.,%()\-/+:]+|\s+|.', re.S)


def char_w(c):
    o = ord(c)
    if c == ' ':
        return 0.33
    if o < 128:
        if c.isdigit(): return 0.56
        if 'A' <= c <= 'Z': return 0.72
        if c in 'mw': return 0.85
        if 'a' <= c <= 'z': return 0.56
        if c in ".,:;'`|!": return 0.34
        if c in '()[]-/': return 0.42
        return 0.62
    if 0x2460 <= o <= 0x24FF: return 1.0
    if 0x2000 <= o < 0x2E80: return 0.8
    return 1.0


def count_lines(text, width_pt, size):
    total = 0
    for para in clean_xml(text).split('\n'):
        x, lines = 0.0, 1
        for t in _TOK.findall(para):
            w = sum(char_w(ch) for ch in t) * size
            if t.isspace():
                x += w
                continue
            if x + w <= width_pt:
                x += w
                continue
            if w <= width_pt:
                lines += 1
                x = w
                continue
            for ch in t:
                cw = char_w(ch) * size
                if x + cw > width_pt:
                    lines += 1
                    x = cw
                else:
                    x += cw
        total += lines
    return total


def fit(text, w_tw, h_tw, max_pt, min_pt):
    """반환 dict(size, lines, line_tw, fits)"""
    width = (w_tw - FORM['cellPadW']) / 20 * 0.97
    avail = (h_tw - FORM['cellPadH']) / 20
    lf = FORM['lineFactor']
    s = max_pt
    while s >= min_pt - 1e-9:
        n = count_lines(text, width, s)
        if n * s * lf <= avail:
            return dict(size=s, lines=n, line_tw=round(s * lf * 20), fits=True)
        s -= 0.5
    n = count_lines(text, width, min_pt)
    return dict(size=min_pt, lines=n, line_tw=round(min_pt * lf * 20), fits=False)
