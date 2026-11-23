#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
빌드 — 나뉜 부품(소스)을 합쳐 배포용 단일 HTML 2개를 만든다.

  python build.py            → dist/장비관리대장_생성기.html
                               dist/catalog_template.html (카탈로그 틀, Python 판도 사용)
                               python/eqledger/assets/ 에 틀·양식·설정 복사

부품 순서는 아래 목록(GENERATOR_JS / CATALOG_JS)이 정한다. 새 부품을 만들면 여기에 한 줄 추가.
"""
import base64, json, os, shutil, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(ROOT, *a)
read = lambda p: open(P(p), encoding='utf-8').read()

SHARED = ['shared/js/00_core.js', '@config', 'shared/js/10_format.js']
GENERATOR_JS = (['vendor/jszip.min.js', 'vendor/xlsx.full.min.js', 'vendor/pako_inflate.min.js', 'vendor/utif.js', 'vendor/heic2any.min.js']
                + SHARED + ['shared/js/20_excel_reader.js', 'shared/js/30_text_fit.js', 'shared/js/40_docx_builder.js',
                            'generator/js/10_image_convert.js', 'generator/js/20_image_match.js',
                            'generator/js/30_catalog_pack.js', 'generator/js/90_app.js'])
CATALOG_JS = (['vendor/jszip.min.js'] + SHARED
              + ['shared/js/30_text_fit.js', 'shared/js/40_docx_builder.js', 'shared/js/50_xlsx_writer.js',
                 'catalog/js/10_store.js', 'catalog/js/20_filters.js', 'catalog/js/30_results.js', 'catalog/js/40_detail.js',
                 'catalog/js/50_filter_panel.js', 'catalog/js/60_sheets.js', 'catalog/js/70_actions.js', 'catalog/js/90_main.js'])


def js_block(path):
    if path == '@config':
        cfg = json.loads(read('shared/config.json'))
        src = 'window.EQ = window.EQ || {}; window.EQ.CONFIG = ' + json.dumps(cfg, ensure_ascii=False) + ';'
        name = 'shared/config.json'
    else:
        src, name = read(path), path
    src = src.replace('</script', '<\\/script')
    return '<script>/* ==== %s ==== */\n%s\n</script>' % (name, src)


def assemble(html_path, css_path, js_list):
    html = read(html_path)
    html = html.replace('/*@CSS*/', read(css_path))
    return html.replace('<!--@SCRIPTS-->', '\n'.join(js_block(p) for p in js_list))


def main():
    os.makedirs(P('dist'), exist_ok=True)
    version = json.loads(read('shared/config.json'))['version']

    catalog = assemble('catalog/index.html', 'catalog/catalog.css', CATALOG_JS)
    assert '/*__DATA__*/null' in catalog
    open(P('dist', 'catalog_template.html'), 'w', encoding='utf-8').write(catalog)

    gen = assemble('generator/index.html', 'generator/generator.css', GENERATOR_JS)
    tpl_b64 = base64.b64encode(open(P('assets', 'ledger.docx'), 'rb').read()).decode()
    gen = gen.replace('__TEMPLATE_B64__', tpl_b64)
    gen = gen.replace('__CATALOG_TPL__', json.dumps(catalog, ensure_ascii=False).replace('</', '<\\/'))
    out = P('dist', '장비관리대장_생성기.html')
    open(out, 'w', encoding='utf-8').write(gen)

    asset_dir = P('python', 'eqledger', 'assets')
    os.makedirs(asset_dir, exist_ok=True)
    shutil.copy(P('dist', 'catalog_template.html'), asset_dir)
    shutil.copy(P('assets', 'ledger.docx'), asset_dir)
    shutil.copy(P('shared', 'config.json'), asset_dir)

    print('v%s  생성기 %.2fMB · 카탈로그 틀 %.0fKB' % (version, os.path.getsize(out) / 1e6, len(catalog.encode()) / 1e3))


if __name__ == '__main__':
    sys.exit(main())
