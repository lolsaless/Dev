"""[부품 P4] Word 문서 조립 — JS shared/js/40_docx_builder.js 와 같은 규칙

    b = DocBuilder(open(TEMPLATE_PATH,'rb').read(), date_style='dot')
    warn = b.append(record, photo)      # photo = dict(bytes, ext, w, h, key) | None
    data = b.finish()                   # .docx bytes
"""
import copy
import io
import re
import zipfile
from lxml import etree

from .config import FORM
from .text_fit import fit
from .util import clean_xml, fmt_date, won

W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
XML_NS = 'http://www.w3.org/XML/1998/namespace'
q = lambda n: '{%s}%s' % (W_NS, n)
RPR_AFTER_SZ = ['szCs', 'highlight', 'u', 'effect', 'bdr', 'shd', 'fitText', 'vertAlign', 'rtl', 'cs', 'em', 'lang',
                'eastAsianLayout', 'specVanish', 'oMath']
PPR_AFTER_SPACING = ['ind', 'contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc', 'textDirection', 'textAlignment',
                     'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange']
LF = FORM['lineFactor']


def _ln(e):
    return etree.QName(e).localname if isinstance(e.tag, str) else ''


def kids(n, name):
    return [c for c in n if _ln(c) == name]


rows_of = lambda t: kids(t, 'tr')
cells_of = lambda tr: kids(tr, 'tc')
pars_of = lambda tc: kids(tc, 'p')
half = lambda s: int(round(s * 2))


def _insert_before(parent, new, after_names):
    ref = next((c for c in parent if _ln(c) in after_names), None)
    if ref is not None:
        ref.addprevious(new)
    else:
        parent.append(new)


def set_sz(rpr, size):
    for c in list(rpr):
        if _ln(c) in ('sz', 'szCs'):
            rpr.remove(c)
    for name in ('sz', 'szCs'):
        e = etree.Element(q(name))
        e.set(q('val'), str(half(size)))
        _insert_before(rpr, e, RPR_AFTER_SZ if name == 'sz' else RPR_AFTER_SZ[1:])


def set_exact_spacing(p, line_tw):
    ppr = kids(p, 'pPr')
    if ppr:
        ppr = ppr[0]
    else:
        ppr = etree.Element(q('pPr'))
        p.insert(0, ppr)
    for s in kids(ppr, 'spacing'):
        ppr.remove(s)
    sp = etree.Element(q('spacing'))
    for k, v in (('before', 0), ('after', 0), ('line', line_tw), ('lineRule', 'exact')):
        sp.set(q(k), str(v))
    _insert_before(ppr, sp, PPR_AFTER_SPACING)


def run_rpr(p):
    runs = kids(p, 'r')
    if runs:
        rp = kids(runs[0], 'rPr')
        return copy.deepcopy(rp[0]) if rp else None
    ppr = kids(p, 'pPr')
    pr = kids(ppr[0], 'rPr') if ppr else []
    if not pr:
        return None
    rp = etree.Element(q('rPr'))
    for c in pr[0]:
        if _ln(c) not in ('ins', 'del', 'moveFrom', 'moveTo', 'rPrChange'):
            rp.append(copy.deepcopy(c))
    return rp


def set_par(p, text, size=None, line_tw=None):
    rpr = run_rpr(p)
    for r in kids(p, 'r'):
        p.remove(r)
    if size:
        if rpr is None:
            rpr = etree.Element(q('rPr'))
        set_sz(rpr, size)
    if line_tw:
        set_exact_spacing(p, line_tw)
    t = clean_xml(text)
    if t == '':
        return
    r = etree.SubElement(p, q('r'))
    if rpr is not None:
        r.append(rpr)
    for i, ln in enumerate(t.split('\n')):
        if i:
            etree.SubElement(r, q('br'))
        e = etree.SubElement(r, q('t'))
        e.set('{%s}space' % XML_NS, 'preserve')
        e.text = ln


def fill_fit(p, text, w, h, mx, mn, force=False):
    f = fit(text, w, h, mx, mn)
    shrink = f['size'] < mx
    if shrink or force:
        set_par(p, text, f['size'] if shrink else None, f['line_tw'])
    else:
        set_par(p, text)
    return f


def v_center(tc):
    pr = kids(tc, 'tcPr')
    if pr:
        pr = pr[0]
    else:
        pr = etree.Element(q('tcPr'))
        tc.insert(0, pr)
    v = kids(pr, 'vAlign')
    if v:
        v = v[0]
    else:
        v = etree.Element(q('vAlign'))
        _insert_before(pr, v, ['hideMark'])
    v.set(q('val'), 'center')


def center_par(p):
    ppr = kids(p, 'pPr')
    if ppr:
        ppr = ppr[0]
    else:
        ppr = etree.Element(q('pPr'))
        p.insert(0, ppr)
    if not kids(ppr, 'jc'):
        jc = etree.Element(q('jc'))
        jc.set(q('val'), 'center')
        _insert_before(ppr, jc, ['textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange'])


def stamps_from_people(people):
    """직인 목록 [{role,name,img(dataURL)}] → {'역할|성명': dict(bytes, ext, w, h, key)}"""
    import base64
    from PIL import Image
    out = {}
    for p in people or []:
        m = re.match(r'^data:image/(png|jpe?g);base64,(.*)$', p.get('img') or '', re.S)
        if not m:
            continue
        b = base64.b64decode(m.group(2))
        try:
            w, h = Image.open(io.BytesIO(b)).size
        except Exception:
            continue
        out[p['role'] + '|' + p['name']] = dict(bytes=b, ext='png' if m.group(1) == 'png' else 'jpg', w=w, h=h, key='stamp:%s|%s|%d' % (p['role'], p['name'], len(p['img'])))
    return out


def drawing_xml(rid, did, name, cx, cy):
    name = name.replace('&', '&amp;').replace('<', '&lt;').replace('"', '&quot;')
    return ('<w:r xmlns:w="%s"><w:drawing xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
            'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="%d" cy="%d"/><wp:effectExtent l="0" t="0" r="0" b="0"/>'
            '<wp:docPr id="%d" name="%s"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>'
            '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>'
            '<pic:nvPicPr><pic:cNvPr id="%d" name="%s"/><pic:cNvPicPr/></pic:nvPicPr>'
            '<pic:blipFill><a:blip r:embed="%s"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
            '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="%d" cy="%d"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
            '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>') % (W_NS, cx, cy, did, name, did, name, rid, cx, cy)


class DocBuilder:
    def __init__(self, template_bytes, date_style='dot', stamps=None):
        zin = zipfile.ZipFile(io.BytesIO(template_bytes))
        self.files = {i.filename: zin.read(i.filename) for i in zin.infolist() if not i.is_dir()}
        self.root = etree.fromstring(self.files['word/document.xml'])
        self.body = self.root.find(q('body'))
        ch = list(self.body)
        self.sect = next(c for c in ch if _ln(c) == 'sectPr')
        self.pristine = [c for c in ch if c is not self.sect]
        sig = ','.join(_ln(c) for c in self.pristine)
        if sig != 'tbl,tbl,p,p,p,tbl,p,p':
            raise ValueError('양식(ledger.docx) 구조가 예상과 다릅니다: ' + sig)
        for c in self.pristine:
            self.body.remove(c)
        self.date_style = date_style
        self.stamps = stamps or {}   # '역할|성명' → dict(bytes, ext, w, h, key)
        self.rels, self.exts, self.seq, self.docpr, self.relof, self.count = [], set(), 0, 5000, {}, 0

    def _add_photo(self, photo):
        key = photo.get('key') or id(photo)
        if key in self.relof:
            return self.relof[key]
        self.seq += 1
        rid, path = 'rIdPhoto%d' % self.seq, 'media/photo%d.%s' % (self.seq, photo['ext'])
        self.files['word/' + path] = photo['bytes']
        self.rels.append('<Relationship Id="%s" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="%s"/>' % (rid, path))
        self.exts.add(photo['ext'])
        self.relof[key] = rid
        return rid

    def _picture(self, p, photo, max_w, max_h, name):
        rid = self._add_photo(photo)
        sc = min(max_w * 635 / photo['w'], max_h * 635 / photo['h'])
        self.docpr += 1
        p.append(etree.fromstring(drawing_xml(rid, self.docpr, name, round(photo['w'] * sc), round(photo['h'] * sc)).encode('utf-8')))

    def _fill_history(self, t2, entries):
        HF, R = FORM['hist'], rows_of(t2)
        for i in range(HF['rowsPerSide'] * 2):
            if i >= len(entries):
                break
            h, side = entries[i], 0 if i < HF['rowsPerSide'] else 4
            cs = cells_of(R[HF['firstRow'] + i % HF['rowsPerSide']])
            set_par(pars_of(cs[side])[0], fmt_date(h['d'], self.date_style) or h['d'] or '')
            f = fit(h['c'], HF['contentW'], HF['rowH'], HF['max'], HF['min'])
            set_par(pars_of(cs[side + 1])[0], h['c'], f['size'], f['line_tw'])
            v_center(cs[side + 1])
            for nm, role, off in ((h.get('m'), '담당자', 2), (h.get('l'), '팀장', 3)):
                if not nm:
                    continue
                p = pars_of(cs[side + off])[0]
                center_par(p)
                st = self.stamps.get(role + '|' + nm)
                if st:
                    self._picture(p, st, HF['stampBoxW'], HF['stampBoxH'], '%s %s' % (role, nm))
                else:
                    set_par(p, nm, 8)

    def append(self, rec, photo=None):
        warn = []
        f = [copy.deepcopy(n) for n in self.pristine]
        for n in f:
            for e in list(n.iter(q('lastRenderedPageBreak'))):
                e.getparent().remove(e)
            for e in n.iter():
                if _ln(e) in ('docPr', 'cNvPr') and e.get('id'):
                    self.docpr += 1
                    e.set('id', str(self.docpr))
        t0, t1, p_front, p_break, p_head, t2, p_back = f[:7]
        name_line, id_line = '물품명 : ' + rec['name'], '관리번호 (%s)' % rec['id']
        R = rows_of(t1)
        c0, c1 = cells_of(R[0]), cells_of(R[1])
        NL = FORM['nameLine']
        fill_fit(pars_of(c0[0])[0], name_line, NL['w'], NL['h'], NL['max'], NL['min'])
        set_par(pars_of(c0[1])[0], id_line)
        set_par(pars_of(c1[1])[0], ('물품번호 ' + rec['item']) if rec['item'] else '')

        r4, H, I = cells_of(R[4]), FORM['infoCellH'], FORM['info']

        def put(tc, text, k):
            r = fill_fit(pars_of(tc)[0], text, I[k]['w'], H, I[k]['max'], I[k]['min'])
            if not r['fits']:
                warn.append('%s 칸 글이 길어 최소 크기(%spt)로도 넘칠 수 있음' % (k, I[k]['min']))
        put(r4[0], rec['spec'], 'spec')
        ps = pars_of(r4[1])
        mk, co, M = rec['maker'], ('(%s)' % rec['country'] if rec['country'] else ''), I['maker']
        s = min(fit(mk, M['w'], H / 2, M['max'], M['min'])['size'], fit(co, M['w'], H / 2, M['max'], M['min'])['size'])
        o = dict(size=s, line_tw=round(s * LF * 20)) if s < M['max'] else {}
        set_par(ps[0], mk, **o)
        set_par(ps[1], co, **o)
        put(r4[2], fmt_date(rec['date'], self.date_style), 'date')
        set_par(pars_of(r4[3])[0], won(rec['price']))
        put(r4[4], rec['vendor'], 'vendor')
        put(r4[5], rec['addr'], 'addr')
        put(r4[6], rec['tel'], 'tel')
        put(r4[7], rec['usage'], 'usage')

        r6 = cells_of(R[6])
        used, is_new = '중고' in rec['cond'], bool(re.search('신품|신규|새', rec['cond']))
        set_par(pars_of(r6[3])[0], ('■' if is_new else '□') + ' 신품')
        set_par(pars_of(r6[4])[0], ('■' if used else '□') + '중고품')

        r7, N = cells_of(R[7]), FORM['note']
        ps = pars_of(r7[0])
        fr = fill_fit(ps[1] if len(ps) > 1 else ps[0], rec['note'], N['w'], N['h'] - N['labelH'], N['max'], N['min'], force=True)
        if not fr['fits']:
            warn.append('주요 성능 및 특징이 매우 길어(약 %d줄) 최소 %spt로도 한 쪽을 넘을 수 있음' % (fr['lines'], N['min']))
        elif fr['size'] < N['max']:
            warn.append('주요 성능 및 특징 글자 %s→%spt 축소' % (N['max'], fr['size']))

        C = FORM['comp']
        all_c = rec.get('comps') or []
        comps = all_c[:C['maxRows']]
        if len(all_c) > C['maxRows']:
            warn.append('구성내역 %d행 중 %d행만 반영' % (len(all_c), C['maxRows']))
        comp_rows = R[10:10 + C['baseRows']]
        total = max(C['baseRows'], len(comps))
        while len(comp_rows) < total:
            nr = copy.deepcopy(comp_rows[-1])
            comp_rows[-1].addnext(nr)
            comp_rows.append(nr)
        row_h = C['rowH'] * C['baseRows'] // total if total > C['baseRows'] else C['rowH']
        base = max(C['min'], C['max'] - (total - C['baseRows']) * 0.5) if total > C['baseRows'] else C['max']
        for i, tr in enumerate(comp_rows):
            for h in tr.iter(q('trHeight')):
                h.set(q('val'), str(row_h))
                if total > C['baseRows']:
                    h.set(q('hRule'), 'exact')
            cs, cp = cells_of(tr), (comps[i] if i < len(comps) else None)
            o = dict(size=base, line_tw=round(base * LF * 20)) if base < C['max'] else {}
            set_par(pars_of(cs[0])[0], str(i + 1), **o)
            nf = fit(cp['n'] if cp else '', C['nameW'], row_h, base, C['min'])
            set_par(pars_of(cs[1])[0], cp['n'] if cp else '', **(dict(size=nf['size'], line_tw=nf['line_tw']) if nf['size'] < C['max'] else {}))
            set_par(pars_of(cs[2])[0], cp['q'] if cp else '', **o)
            set_par(pars_of(cs[3])[0], cp['u'] if cp else '', **o)

        p_photo = pars_of(r7[1])[0]
        for r in kids(p_photo, 'r'):
            p_photo.remove(r)
        if photo and photo.get('bytes'):
            rid, P = self._add_photo(photo), FORM['photo']
            box_w, box_h = (P['w'] - P['pad']) * 635, (N['h'] + row_h * total + C['rowH'] * 2 - P['trim']) * 635
            sc = min(box_w / photo['w'], box_h / photo['h'])
            self.docpr += 1
            p_photo.append(etree.fromstring(drawing_xml(rid, self.docpr, '사진 ' + rec['id'], round(photo['w'] * sc), round(photo['h'] * sc)).encode('utf-8')))

        rs = kids(p_head, 'r')
        kids(rs[0], 't')[0].text = name_line
        kids(rs[1], 't')[0].text = id_line
        per = FORM['hist']['rowsPerSide'] * 2
        hist = [h for h in (rec.get('hist') or []) if h.get('d') or h.get('c')]
        self._fill_history(t2, hist[:per])
        extra = []
        for k in range(per, len(hist), per):
            b2, h2, t22, pb2 = (copy.deepcopy(self.pristine[i]) for i in (3, 4, 5, 6))
            for n in (b2, h2):
                for e in list(n.iter(q('lastRenderedPageBreak'))):
                    e.getparent().remove(e)
            rs2 = kids(h2, 'r')
            kids(rs2[0], 't')[0].text = name_line
            kids(rs2[1], 't')[0].text = id_line + ' — 이력 %d쪽' % (k // per + 1)
            self._fill_history(t22, hist[k:k + per])
            extra += [b2, h2, t22, pb2]
        if extra:
            warn.append('수리 이력 %d건 → 뒷면 %d쪽' % (len(hist), -(-len(hist) // per)))

        if self.count:
            br = copy.deepcopy(self.pristine[3])
            for e in list(br.iter(q('lastRenderedPageBreak'))):
                e.getparent().remove(e)
            self.body.append(br)
        for n in (t0, t1, p_front, p_break, p_head, t2, p_back, *extra):
            self.body.append(n)
        self.count += 1
        return warn

    def finish(self):
        self.body.append(self.sect)
        self.files['word/document.xml'] = etree.tostring(self.root, xml_declaration=True, encoding='UTF-8', standalone=True)
        rels = self.files['word/_rels/document.xml.rels'].decode('utf-8')
        self.files['word/_rels/document.xml.rels'] = rels.replace('</Relationships>', ''.join(self.rels) + '</Relationships>').encode('utf-8')
        ct = self.files['[Content_Types].xml'].decode('utf-8')
        mime = {'jpg': 'image/jpeg', 'png': 'image/png'}
        for e in self.exts:
            if 'Extension="%s"' % e not in ct:
                ct = ct.replace('<Default ', '<Default Extension="%s" ContentType="%s"/><Default ' % (e, mime[e]), 1)
        self.files['[Content_Types].xml'] = ct.encode('utf-8')
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
            for n in ['[Content_Types].xml'] + [k for k in self.files if k != '[Content_Types].xml']:
                z.writestr(n, self.files[n])
        return buf.getvalue()
