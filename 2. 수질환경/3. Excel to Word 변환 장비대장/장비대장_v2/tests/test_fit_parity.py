"""JS(30_text_fit.js)와 Python(text_fit.py)의 글자 크기 계산이 같은지 확인
   python tests/test_fit_parity.py <엑셀>"""
import json, os, subprocess, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sys.path.insert(0, os.path.join(ROOT, 'python'))
from eqledger.excel_reader import open_book
from eqledger.text_fit import fit
from eqledger.config import FORM

book = open_book(sys.argv[1])
recs, _ = book.read(book.ledger_sheets, book.comp_sheet)
N = FORM['note']
cases = [r['note'] for r in recs] + [r['spec'] for r in recs] + ['가나다 ' * 200, 'ABC-123 mg/L ' * 60]
js = '''
global.window = {}; const fs = require('fs'); const R = p => fs.readFileSync(p, 'utf8');
eval(R('%(r)s/shared/js/00_core.js')); window.EQ.CONFIG = JSON.parse(R('%(r)s/shared/config.json')); eval(R('%(r)s/shared/js/30_text_fit.js'));
const C = JSON.parse(fs.readFileSync(0, 'utf8')); const N = window.EQ.CONFIG.form.note;
console.log(JSON.stringify(C.map(t => { const f = window.EQ.fit.fit(t, N.w, N.h - N.labelH, N.max, N.min); return [f.size, f.lines]; })));
''' % {'r': ROOT}
out = json.loads(subprocess.run(['node', '-e', js], input=json.dumps(cases), capture_output=True, text=True, check=True).stdout)
bad = 0
for t, (s, l) in zip(cases, out):
    p = fit(t, N['w'], N['h'] - N['labelH'], N['max'], N['min'])
    if (p['size'], p['lines']) != (s, l):
        bad += 1; print('다름:', repr(t[:40]), (s, l), (p['size'], p['lines']))
print('사례 %d개, 불일치 %d개' % (len(cases), bad))
sys.exit(1 if bad else 0)
