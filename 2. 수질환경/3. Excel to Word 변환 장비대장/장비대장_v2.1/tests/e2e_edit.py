"""관리대장(HTML) 편집 시험: 구분 탭 · 직인 등록 · 구성내역/수리이력 편집 · 통합 엑셀 내보내기 · 파일 저장 · Word
   python tests/e2e_edit.py <관리대장.html> <직인폴더(stamp_*.png)> <출력폴더>"""
import asyncio, os, sys
from playwright.async_api import async_playwright
HTML, ST, OUT = sys.argv[1:4]

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': 1360, 'height': 900}, accept_downloads=True)
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto('file://' + os.path.abspath(HTML)); await pg.wait_for_timeout(700)
        print('탭:', await pg.locator('#catTabs').inner_text(), '|', await pg.inner_text('#resTitle'))
        await pg.screenshot(path=f'{OUT}/e1_tabs.png')
        await pg.click('#catTabs [data-cat="이관장비"]'); await pg.wait_for_timeout(200); print('이관 탭:', await pg.inner_text('#resTitle'))
        await pg.click('#catTabs [data-cat="기타장비"]'); await pg.wait_for_timeout(200); print('기타 탭:', await pg.inner_text('#resTitle'))
        await pg.click('#catTabs [data-cat="장비대장"]'); await pg.wait_for_timeout(200)
        # 직인 등록: 담당자 2명(교체), 팀장 1명
        await pg.click('#btnPeople'); await pg.wait_for_timeout(200)
        for role, name, start, f in [('담당자', '김담당', '2024-01-01', 'stamp_kim.png'), ('담당자', '이담당', '2026-07-01', 'stamp_lee.png'), ('팀장', '박팀장', '2025-01-01', 'stamp_park.png')]:
            await pg.select_option('#pRole', role); await pg.fill('#pName', name); await pg.fill('#pStart', start)
            await pg.set_input_files('#pFile', os.path.join(ST, f)); await pg.wait_for_timeout(400)
            await pg.click('#pAdd'); await pg.wait_for_timeout(200)
        await pg.screenshot(path=f'{OUT}/e2_people.png')
        await pg.click('#people [data-close]'); await pg.wait_for_timeout(200)
        # 구성내역 없는 장비(04-장비-30) 편집
        await pg.fill('#qId', '04-장비-30'); await pg.wait_for_timeout(300); await pg.click('.card'); await pg.wait_for_timeout(300)
        await pg.click('[data-ed="comp"]')
        await pg.fill('#secComp tbody tr:nth-child(1) input[data-f="n"]', '본체(분석저울)')
        await pg.click('#secComp [data-op="add"]'); await pg.fill('#secComp tbody tr:nth-child(2) input[data-f="n"]', '바람막이 커버')
        await pg.click('#secComp [data-op="save"]'); await pg.wait_for_timeout(200)
        # 이력: 옛 담당자(김담당) 1건 + 새 기본값(이담당) 1건
        await pg.click('[data-ed="hist-add"]'); await pg.wait_for_timeout(100)
        await pg.fill('#secHist tbody tr:nth-child(1) input[data-f="d"]', '2025-03-10')
        await pg.fill('#secHist tbody tr:nth-child(1) textarea', '정기 교정(외부 교정기관)')
        await pg.select_option('#secHist tbody tr:nth-child(1) select[data-f="m"]', '김담당')
        await pg.click('#secHist [data-op="add"]')
        await pg.fill('#secHist tbody tr:nth-child(2) textarea', '로드셀 부품 교체')
        print('새 줄 기본 담당자:', await pg.input_value('#secHist tbody tr:nth-child(2) select[data-f="m"]'), '/ 팀장:', await pg.input_value('#secHist tbody tr:nth-child(2) select[data-f="l"]'))
        await pg.click('#secHist [data-op="save"]'); await pg.wait_for_timeout(300)
        await pg.evaluate("document.getElementById('secComp').scrollIntoView()"); await pg.wait_for_timeout(200)
        await pg.screenshot(path=f'{OUT}/e3_detail_edit.png')
        async with pg.expect_download() as d: await pg.click('#dWord')
        await (await d.value).save_as(f'{OUT}/one_from_catalog.docx')
        await pg.click('#detail [data-close]'); await pg.wait_for_timeout(200)
        print('편집 띠:', await pg.inner_text('#editbar'))
        await pg.screenshot(path=f'{OUT}/e4_editbar.png')
        async with pg.expect_download() as d: await pg.click('#eXlsx')
        dd = await d.value; await dd.save_as(f'{OUT}/{dd.suggested_filename}'); print('통합 엑셀:', dd.suggested_filename)
        async with pg.expect_download() as d: await pg.click('#eHtml')
        dd = await d.value; await dd.save_as(f'{OUT}/saved_{dd.suggested_filename}'); print('저장 HTML:', dd.suggested_filename)
        # 저장된 HTML 다시 열기 → 편집 내용이 들어 있는지
        pg2 = await ctx.new_page(); pg2.on('pageerror', lambda e: errs.append('saved: ' + str(e)))
        await pg2.goto('file://' + os.path.abspath(f'{OUT}/saved_{dd.suggested_filename}')); await pg2.wait_for_timeout(700)
        await pg2.fill('#qId', '04-장비-30'); await pg2.wait_for_timeout(300); await pg2.click('.card'); await pg2.wait_for_timeout(300)
        print('저장본 구성:', (await pg2.inner_text('#secComp'))[:60].replace('\n', ' '), '| 이력:', (await pg2.inner_text('#secHist'))[:80].replace('\n', ' '))
        print('저장본 편집 띠 숨김:', await pg2.locator('#editbar').is_hidden())
        await pg2.click('#detail [data-close]'); await pg2.click('#tabSheet'); await pg2.wait_for_timeout(300)
        print('저장본 시트 탭:', await pg2.inner_text('#sheetTabs'))
        print('PAGE ERRORS:', errs); await b.close()
asyncio.run(main())
