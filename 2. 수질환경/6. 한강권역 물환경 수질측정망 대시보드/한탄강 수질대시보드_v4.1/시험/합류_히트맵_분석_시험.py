"""Chrome에서 주요 수정 사항 검증. 사용법: python 시험/합류_히트맵_분석_시험.py HTML [미리보기 PNG]
   Chrome 위치를 직접 줄 때: 환경변수 CHROME_PATH (없으면 설치된 Chrome 채널 사용)"""
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

source = sys.argv[1] if sys.argv[1].startswith("http://127.0.0.1:") else Path(sys.argv[1]).resolve().as_uri()
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ["CHROME_PATH"], args=["--no-sandbox"]) if os.environ.get("CHROME_PATH") else p.chromium.launch(channel="chrome")
    page = browser.new_page(viewport={"width": 1480, "height": 1020})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.route("https://api.vworld.kr/**", lambda route: route.abort())
    page.goto(source)
    if source.startswith("http:"):
        page.wait_for_function("SERVER")
    page.click('[data-view="heat"]')
    page.locator("#hmChart").scroll_into_view_if_needed()
    cell = page.evaluate("""() => {
      const chart=charts.hmChart, option=chart.getOption();
      const row=option.yAxis[0].data.indexOf("영평천1");
      const data=option.series[0].data.find(d=>d.value[1]===row);
      return chart.convertToPixel({seriesIndex:0},data.value.slice(0,2));
    }""")
    page.locator("#hmChart").click(position={"x": cell[0], "y": cell[1]})
    expect(page.locator("#hmDetailTitle")).to_contain_text("영평천1")
    assert page.evaluate("S.view") == "heat"
    # 상세는 연도×월 히트맵: 1~12월, 최근 연도가 맨 위(echarts y축 마지막 = 맨 위), 칸 높이는 위 히트맵과 같음
    detail = page.evaluate("""() => {
      const o=charts.hmDetailChart.getOption(), ys=o.yAxis[0].data, d=o.series[0].data[0];
      const vals=D.values['영평천1'][S.item], last=M.filter((m,i)=>Number.isFinite(vals[i])).at(-1).slice(0,4);
      const row=h=>(h-HEAT_GRID.top-HEAT_GRID.bottom-8);
      return {months:o.xAxis[0].data.length, top:ys.at(-1), last, sorted:ys.every((y,i)=>!i||y>ys[i-1]),
        same:Math.abs(row($("hmChart").offsetHeight)/selectedOrdered().length - row($("hmDetailChart").offsetHeight)/ys.length)<0.5,
        cell:[d.m, d.raw, D.values['영평천1'][S.item][M.indexOf(d.m)]]};
    }""")
    assert detail["months"] == 12 and detail["top"] == detail["last"] + "년" and detail["sorted"] and detail["same"], detail
    assert detail["cell"][1] == detail["cell"][2], detail
    page.select_option("#hmDetailStation", "신천1")
    expect(page.locator("#hmDetailTitle")).to_contain_text("신천1")
    print("히트맵 셀 클릭 → 정확한 지점·측정값, 탭 유지")

    page.click('[data-view="ana"]')
    page.click('[data-a="trend"]')
    page.click('[data-trend-st="영평천1"]')
    before = page.evaluate("charts.anChart.getOption().series[0].data")
    page.click('[data-trend-st="신천1"]')
    assert "신천1" in page.evaluate("charts.anChart.getOption().title[0].text")
    assert page.evaluate("charts.anChart.getOption().series[0].data") != before
    page.locator('td.c[data-st="영평천1"][data-it="TOC"]').click()
    assert "영평천1" in page.evaluate("charts.anChart.getOption().title[0].text")
    # 그래프 위 고르기 막대: 목록·다음 버튼·항목 버튼·키보드로 표를 누르지 않고 바꿈
    page.select_option("#tpSt", "신천3")
    assert "신천3" in page.evaluate("charts.anChart.getOption().title[0].text")
    page.click('#tpItems [data-tp-it="T-P"]')
    assert page.evaluate("S.anaCell") == {"st": "신천3", "it": "T-P"}
    nxt = page.evaluate("selectedOrdered()[selectedOrdered().indexOf('신천3')+1]")
    if nxt:
        page.click("#tpNext")
        assert page.evaluate("S.anaCell.st") == nxt
        page.locator("#anChart").click(position={"x": 5, "y": 5})
        page.keyboard.press("ArrowLeft")
        assert page.evaluate("S.anaCell.st") == "신천3"
    page.keyboard.press("ArrowUp")
    assert page.evaluate("S.anaCell.it") == "T-N"
    assert page.evaluate("charts.anChart.getOption().series[0].data") == page.evaluate("series('신천3','T-N')")

    page.click('[data-a="box"]')
    chart = page.locator("#anChart")
    chart.scroll_into_view_if_needed()
    page.wait_for_timeout(350)
    box = page.evaluate("""() => {
      const chart=charts.anChart, items=chart.getOption().series[0].data;
      const i=items.findIndex(item=>item[2]>0 && item[1]!==item[3]);
      return [i,chart.convertToPixel({xAxisIndex:0,yAxisIndex:0},[i,items[i][2]])];
    }""")
    chart.click(position={"x": box[1][0], "y": box[1][1]})
    expect(page.locator("#anBoxDetail")).to_be_visible()
    assert page.locator("#anBoxDetail tbody tr").count() == page.evaluate(
        "i=>selectedOrdered().filter(n=>series(n,S.item)[i]!=null).length", box[0]
    )
    page.click('[data-a="exceed"]')
    page.fill("#exVal", "2")
    page.press("#exVal", "Tab")
    first = page.locator('[data-ex-row]:enabled').first
    station = first.locator("xpath=ancestor::tr").locator("td").first.inner_text()
    first.click()
    expect(page.locator("#anExDetail")).to_be_visible()
    expect(page.locator("#anExTitle")).to_contain_text(station)
    assert page.locator("#anExTable tbody tr").count() > 0
    assert "기준 대비 초과율" in page.locator("#anExTable thead").inner_text()
    page.keyboard.press("Escape")

    page.click('[data-a="recent"]')
    rows = page.locator("#anTbl tr[data-analysis-row]")
    assert rows.count() >= 2
    first_data = page.evaluate("charts.anChart.getOption().series[0].data")
    second_station = rows.nth(1).locator("button").inner_text()
    rows.nth(1).locator("td").last.click()
    assert page.evaluate("charts.anChart.getOption().title[0].text") == second_station
    assert page.evaluate("charts.anChart.getOption().series[0].data") != first_data

    assert page.locator('[data-a="seasonAlert"]').count() == 0
    page.evaluate("S.anaTab='seasonAlert'; refresh()")   # 예전 저장값이 남아 있어도 추세 검정으로
    assert page.evaluate("S.anaTab") == "trend"
    print("추세검정 고르기 막대·키보드·최근 비교 데이터 교체, 상자 클릭, 초과 상세, 계절 기준 이탈 제거")

    page.click('[data-view="prof"]')
    page.click('#pfRivers [data-r="한탄강"]')
    page.click("#pfEdit")
    page.wait_for_function('!!peLayer && !!document.querySelector("#peOn button")')
    page.evaluate("""() => {
      const ids=names=>names.map(n=>stationCode(stByName[n]));
      PE.groups=[
        {name:"차탄천",next:"",codes:ids(["차탄천"])},
        {name:"신천",next:"차탄천",codes:ids(["신천1","신천3","차탄천"])},
        {name:"영평천",next:"차탄천",codes:ids(["영평천1","영평천2","포천천","차탄천"])}
      ];
      PE.index=1; peChanged();
    }""")
    page.click("#peSave")
    page.wait_for_function('savedBranches("한탄강").length===3 && !PE.saving')
    page.click("#peClose")
    expect(page.locator("#pfTitle")).to_contain_text("합류 농도 비교")
    routes = page.evaluate("""() => {
      const option=charts.pfChart.getOption(), cats=option.xAxis[0].data;
      return option.series.filter(s=>s.name.endsWith("기간 평균")).map(s=>({
        stations:s.data.map(d=>cats[d.value[0]]), end:s.data.at(-1).value
      }));
    }""")
    assert [r["stations"] for r in routes] == [
        ["신천1", "신천3", "차탄천"], ["영평천1", "영평천2", "포천천", "차탄천"]
    ]
    assert routes[0]["end"] == routes[1]["end"]
    assert page.locator("#pfFlow").count() == 0
    assert page.locator("#pfBranch").count() == 0
    # 구간별 변화 표 = 한탄강의 모든 지류 지점(흐름 고르기 없음), 10년이면 연평균 열로 줄임
    table = page.evaluate("""() => { S.from=Math.max(0,M.length-120); S.to=M.length-1; S.pfCols="auto"; refresh();
      const names=[...document.querySelectorAll('#pfTbl td[data-st]')].map(td=>td.dataset.st);
      return {names, river:stationsInRiver('한탄강').map(s=>s.name), cols:document.querySelectorAll('#pfTbl thead th').length,
        join:document.querySelector('#pfTbl td[data-st="차탄천"]').parentElement.querySelector('.pf-join')!=null}; }""")
    assert sorted(table["names"]) == sorted(table["river"]) and table["join"], table
    assert table["cols"] <= 6 + 12, table
    page.click('#pfCols [data-c="month"]')
    assert page.locator("#pfTbl thead th").count() == 6 + 120
    if len(sys.argv) > 2:
        page.evaluate("S.from=Math.max(0,S.to-35); syncOpts(); refresh()")
        page.locator("#pfChart").locator("xpath=..").screenshot(path=sys.argv[2])
    page.uncheck("#pfCompare")
    assert page.evaluate('charts.pfChart.getOption().xAxis[0].data') == ["신천1", "신천3", "차탄천"]
    print("두 지류는 독립 관측값을 사용하고 차탄천에서 같은 좌표·농도로 합류")
    assert not errors, errors
