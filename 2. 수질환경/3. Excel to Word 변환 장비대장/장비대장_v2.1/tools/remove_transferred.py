"""한 번만 쓰는 정리 도구 — 통합 엑셀의 장비대장(등) 시트에서 '이관장비' 시트에 있는 장비 행을 지운다.
   서식·수식·필터를 지키려고 openpyxl 로 다시 쓰지 않고 시트 XML 에서 행만 빼고 아래 행 번호를 당긴다.
   python tools/remove_transferred.py 원본.xlsx 결과.xlsx"""
import re, sys, zipfile, io
import openpyxl

SRC, DST = sys.argv[1:3]
wb = openpyxl.load_workbook(SRC, read_only=True)
moved = {(str(r[1]).strip(), str(r[2] or '').strip()) for r in wb['이관장비'].iter_rows(min_row=2, values_only=True) if r[1]}
targets = {}   # 시트이름 -> 지울 행 번호들
for name in wb.sheetnames:
    if name in ('이관장비',) or re.search('폐기|구성|이력|직인', name):
        continue
    rows = list(wb[name].iter_rows(values_only=True))
    if not rows or '관리번호' not in rows[0]:
        continue
    ci, si = rows[0].index('관리번호'), rows[0].index('구입일련번호') if '구입일련번호' in rows[0] else None
    hit = [i + 1 for i, r in enumerate(rows) if i and r[ci] and (str(r[ci]).strip(), str(r[si] or '').strip() if si is not None else '') in moved]
    if hit:
        targets[name] = hit
print('지울 행:', targets)

z = zipfile.ZipFile(SRC)
files = {i.filename: z.read(i.filename) for i in z.infolist()}
wbx = files['xl/workbook.xml'].decode('utf8')
rels = files['xl/_rels/workbook.xml.rels'].decode('utf8')
sheets = re.findall(r'<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"', wbx)

def col_row(ref):
    m = re.match(r'([A-Z]+)(\d+)', ref); return m.group(1), int(m.group(2))

for idx, (name, rid) in enumerate(sheets):
    if name not in targets:
        continue
    tgt = 'xl/' + re.search(r'Id="%s"[^>]*Target="([^"]+)"' % rid, rels).group(1)
    x = files[tgt].decode('utf8')
    dels = sorted(targets[name])
    shift = lambda n: n - sum(1 for d in dels if d < n)
    def fix_row(m):
        body = m.group(0); r = int(m.group(1))
        if r in dels:
            return ''
        nr = shift(r)
        body = re.sub(r'(<row [^>]*\br=")\d+"', lambda mm: '%s%d"' % (mm.group(1), nr), body, count=1)
        body = re.sub(r'(<c r="[A-Z]+)(\d+)"', lambda mm: '%s%d"' % (mm.group(1), shift(int(mm.group(2)))), body)
        return body
    x = re.sub(r'<row [^>]*\br="(\d+)"[^>]*?(?:/>|>.*?</row>)', fix_row, x, flags=re.S)
    # 범위(ref="A1:U48", 공유수식 ref, dimension, autoFilter) 끝 행 당기기
    def fix_range(m):
        a, b = m.group(2).split(':') if ':' in m.group(2) else (m.group(2), None)
        ca, ra = col_row(a); out = '%s%d' % (ca, shift(ra))
        if b:
            cb, rb = col_row(b); out += ':%s%d' % (cb, shift(rb) if rb not in dels else shift(rb) - 0)
        return '%s"%s"' % (m.group(1), out)
    x = re.sub(r'(<(?:dimension|autoFilter|f)\b[^>]*\bref=)"([A-Z]+\d+(?::[A-Z]+\d+)?)"', fix_range, x)
    if '<mergeCell' in x or '<hyperlink' in x or '<conditionalFormatting' in x:
        print('※ 병합/하이퍼링크/조건부서식이 있어 확인 필요:', name)
    files[tgt] = x.encode('utf8')
    last = int(re.search(r'<dimension ref="[A-Z]+\d+:[A-Z]+(\d+)"', x).group(1))
    wbx = re.sub(r'(<definedName name="_xlnm._FilterDatabase" localSheetId="%d"[^>]*>[^<]*\$)(\d+)(<)' % idx,
                 lambda m: '%s%d%s' % (m.group(1), last, m.group(3)), wbx)
files['xl/workbook.xml'] = wbx.encode('utf8')
# 계산 순서 파일은 지우면 엑셀이 다시 만든다
if 'xl/calcChain.xml' in files:
    del files['xl/calcChain.xml']
    files['xl/_rels/workbook.xml.rels'] = re.sub(r'<Relationship [^>]*calcChain[^>]*/>', '', rels).encode('utf8')
    ct = files['[Content_Types].xml'].decode('utf8')
    files['[Content_Types].xml'] = re.sub(r'<Override [^>]*calcChain[^>]*/>', '', ct).encode('utf8')
with zipfile.ZipFile(DST, 'w', zipfile.ZIP_DEFLATED) as out:
    for n in [i.filename for i in z.infolist()]:
        if n in files:
            out.writestr(n, files[n])
print('저장:', DST)
