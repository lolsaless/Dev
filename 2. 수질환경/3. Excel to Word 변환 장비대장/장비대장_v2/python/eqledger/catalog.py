"""[부품 P6] 카탈로그 묶기 — JS generator/js/30_catalog_pack.js 와 같은 EQ_DATA 를 만들어
assets/catalog_template.html(빌드된 카탈로그 틀)에 끼워 넣는다. 데이터 형식: 부품설계도 §4"""
import base64
import json
import os
from datetime import datetime

from .config import CATALOG_TEMPLATE_PATH, CONFIG, TEMPLATE_PATH
from .images import thumb_data_url

PUBLIC_FIELDS = ['uid', 'sheet', 'row', 'seq', 'id', 'serial', 'item', 'name', 'nameExt', 'spec', 'maker', 'country', 'date', 'year',
                 'qty', 'price', 'status', 'usage', 'remark', 'place', 'vendor', 'addr', 'tel', 'telNote', 'cond', 'note',
                 'outDate', 'inDate', 'comps']


def build_catalog_html(records, photos, source_path, snapshot, thumb_edge=None, log=print):
    thumb_edge = thumb_edge or CONFIG['catalog']['thumbEdge']
    images, key_of, recs = {}, {}, []
    for r, ph in zip(records, photos):
        pk = None
        if ph:
            k = ph['key']
            if k not in key_of:
                try:
                    key_of[k] = 'i%d' % len(key_of)
                    images[key_of[k]] = thumb_data_url(ph, thumb_edge, CONFIG['catalog']['thumbQuality'])
                except Exception as ex:   # 사진이 깨졌으면 사진 없이
                    log('[%s] 카탈로그 사진 실패: %s' % (r['id'], ex))
                    key_of[k] = None
            pk = key_of[k]
        out = {f: r.get(f) for f in PUBLIC_FIELDS}
        out['ph'] = pk
        recs.append(out)
    src = open(source_path, 'rb').read()
    data = dict(
        schema=2, generated=datetime.now().strftime('%Y.%m.%d %H:%M'),
        source=dict(name=os.path.basename(source_path), size=len(src), b64=base64.b64encode(src).decode()),
        sheetsView=snapshot, records=recs, images=images,
        template=base64.b64encode(open(TEMPLATE_PATH, 'rb').read()).decode())
    payload = json.dumps(data, ensure_ascii=False).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    tpl = open(CATALOG_TEMPLATE_PATH, encoding='utf-8').read()
    return tpl.replace('/*__DATA__*/null', payload, 1)
