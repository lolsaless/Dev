"""생성기 HTML 끝-끝 시험: 엑셀+사진 폴더 → Word + 카탈로그 내려받기 (Playwright/Chromium)
   python tests/e2e_generator.py <엑셀> <사진폴더> <출력폴더> [single|zip]"""
import asyncio, os, sys
from playwright.async_api import async_playwright
XL, IMG, OUT = sys.argv[1:4]; MODE = sys.argv[4] if len(sys.argv) > 4 else 'single'
HTML = os.path.join(os.path.dirname(__file__), '..', 'dist', '장비관리대장_생성기.html')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(accept_downloads=True)
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + os.path.abspath(HTML))
        await pg.set_input_files('#fileXlsx', XL); await pg.wait_for_timeout(700)
        print('XLSX:', await pg.inner_text('#xlsxMsg'))
        print('SHEETS:', await pg.inner_text('#sheetChips'))
        await pg.set_input_files('#fileImgDir', IMG); await pg.wait_for_timeout(700)
        print('IMG:', await pg.inner_text('#imgMsg'))
        await pg.select_option('#optMode', MODE)
        dls = []; pg.on('download', lambda d: dls.append(d))
        await pg.click('#btnRun')
        await pg.wait_for_function("document.getElementById('runState').textContent.match(/완료|오류/)", timeout=300000)
        await pg.wait_for_timeout(2500)
        for d in dls:
            path = os.path.join(OUT, d.suggested_filename); await d.save_as(path); print('saved', path, os.path.getsize(path))
        print(await pg.inner_text('#log'))
        await pg.screenshot(path=os.path.join(OUT, 'generator.png'), full_page=True)
        print('PAGE ERRORS:', errs); await b.close()
asyncio.run(main())
