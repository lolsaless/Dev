"""화면_시험.py — v4 화면 시험(관리 구분 순서·전환·이어보기, 하천 접기, 농도 색·크기, 종단 편집, 막대 색, 모든 탭 오류, 값 복원)
준비: pip install playwright → python -m playwright install chromium
사용: python 시험/화면_시험.py 한강권역_수질측정망_대시보드.html의_절대경로 결과폴더
"""
import sys, os
from playwright.sync_api import sync_playwright
HTML = sys.argv[1]; OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
res = []
def ok(n, c, d=""):
    res.append((n, bool(c))); print(("[통과] " if c else "[실패] ") + n + (f" — {d}" if d and not c else ""))
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ["CHROME_PATH"], args=["--no-sandbox"]) if os.environ.get("CHROME_PATH") else p.chromium.launch()   # CHROME_PATH: Chrome 위치 직접 지정(선택)
    pg = b.new_page(viewport={"width": 1500, "height": 1000})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "ERR_TUNNEL" not in m.text and "Failed to load resource" not in m.text else None)
    pg.goto("file://" + HTML); pg.wait_for_timeout(2500)
    groups = pg.evaluate("GRPS.map(g=>({key:g.key,label:g.label,n:g.n}))")
    print(groups)
    ok("맨 위 = 전체 지점(647)", groups[0]["key"] == "all" and groups[0]["n"] == 647)
    ok("그다음 = 경기도 보건환경연구원", groups[1]["label"] == "경기도 보건환경연구원")
    ns = [g["n"] for g in groups[2:]]
    ok("나머지는 지점 수 많은 순", ns == sorted(ns, reverse=True))
    ok("엑셀 DB 묶음 없음", not any("엑셀" in g["label"] for g in groups))
    ok("처음 열면 경기도 보건환경연구원", pg.evaluate("GRP") == groups[1]["key"])
    btns = pg.evaluate("[...document.querySelectorAll('#grpSeg button')].map(b=>b.textContent)")
    ok("관리 구분 버튼 수 = 기관 수", len(btns) == len(groups), str(btns))
    # 값 복원: 한강유역환경청 한탄강4 T-P 2017-01~2026-09
    hk = next(g["key"] for g in groups if g["label"] == "한강유역환경청")
    pg.goto("file://" + HTML + "#grp=" + hk); pg.reload(); pg.wait_for_timeout(2500)
    r = pg.evaluate("""(()=>{ const a=M.indexOf('2017-01'), b=M.indexOf('2026-09'); const v=D.values['한탄강4']['T-P'].slice(a,b+1).filter(x=>x!=null);
        return {n:v.length, mean:v.reduce((p,q)=>p+q,0)/v.length, st:ST.length, tabs:[...document.querySelectorAll('#tabs button')].map(b=>b.dataset.view)}; })()""")
    print(r)
    ok("값 복원 = 독립 계산(한탄강4 T-P n=115, 평균 0.04708)", r["n"] == 115 and abs(r["mean"] - 0.04708) < 1e-4, str(r))
    ok("지점 관리 탭 없음", "edit" not in r["tabs"])
    for g in groups[:5]:
        pg.goto("file://" + HTML + "#grp=" + g["key"]); pg.reload(); pg.wait_for_timeout(2500)
        info = pg.evaluate("({st:ST.length, sel:S.sel.size, tabs:[...document.querySelectorAll('#tabs button')].map(b=>b.dataset.view), river:[...S.sel].map(n=>stByName[n].river)[0]})")
        print(g["label"], info["st"], "선택", info["sel"], info["river"])
        ok(f"{g['label']}: 지점 수 = {g['n']}", info["st"] == g["n"])
        for v in info["tabs"]:
            n0 = len(errs)
            pg.evaluate(f"setView('{v}')"); pg.wait_for_timeout(600 if v != "map" else 1200)
            if v == "ana":
                for a in ["trend", "corr", "box", "exceed"]:
                    pg.evaluate(f"S.anaTab='{a}'; refresh()"); pg.wait_for_timeout(300)
            ok(f"{g['label']}: {v} 탭 오류 없음", len(errs) == n0, "; ".join(errs[n0:])[:300])
        pg.evaluate("setView('ts')"); pg.wait_for_timeout(400)
        pg.click("#pQuick button[data-q='5y']"); pg.wait_for_timeout(500)
        ok(f"{g['label']}: 최근 5년 = 60개월", pg.evaluate("S.to-S.from+1") == 60)
        if g is groups[0]:
            pg.screenshot(path=f"{OUT}/v4_first.png", full_page=False)
    # ── v4 마지막 수정 시험 ──
    gk = groups[1]["key"]
    pg.goto("file://" + HTML + "#grp=" + gk); pg.reload(); pg.wait_for_timeout(2000)
    nr = pg.evaluate("document.querySelectorAll('#stlist .rgrp').length"); nc = pg.evaluate("document.querySelectorAll('#stlist .rgrp.closed').length")
    ok("하천 목록 기본 접힘", nr > 0 and nr == nc, f"{nc}/{nr}")
    pg.click("#stlist .rgrp .tog"); pg.wait_for_timeout(300)
    ok("▸ 누르면 첫 하천 펼침", pg.evaluate("!document.querySelector('#stlist .rgrp').classList.contains('closed')"))
    pg.evaluate("S.item='T-P'; renderHeader(); setView('map')"); pg.wait_for_timeout(800)
    pg.click("#pQuick button[data-q='5y']"); pg.wait_for_timeout(500)
    rad = pg.evaluate("(()=>{ const a=[]; mkLayer.eachLayer(l=>a.push([l.getRadius(), l.options.fillColor])); return a; })()")
    rs = sorted(r for r,_ in rad); print("반지름", rs[:3], rs[-3:])
    ok("지도 원 크기가 농도에 따라 다름", rs[-1] - rs[0] >= 8)
    big = max(rad)[1]; print("가장 큰 원 색", big)
    ok("가장 높은 값 = 붉은 계열", int(big[1:3],16) > int(big[5:7],16))
    pg.screenshot(path=f"{OUT}/v4b_map.png")
    pg.click("#grpToggle")
    pg.click(f"#grpSeg button[data-g='{hk}']"); pg.wait_for_timeout(2500)
    st = pg.evaluate("({g:GRP, v:S.view, it:S.item, n:S.to-S.from+1, to:M[S.to]})"); print(st)
    ok("기관을 바꿔도 지도·T-P·기간 유지", st["g"] == hk and st["v"] == "map" and st["it"] == "T-P" and st["n"] == 60)
    pg.evaluate("setView('heat')"); pg.wait_for_timeout(600)
    ok("히트맵 색 = 옅은 파랑→빨강", pg.evaluate("JSON.stringify(charts.hmChart.getOption().visualMap[0].inRange.color)==JSON.stringify(CONC_STOPS)"))
    pg.evaluate("S.profRiver='한탄강'; setView('prof')"); pg.wait_for_timeout(800)
    sz = pg.evaluate("charts.pfChart.getOption().series.filter(s=>s.type==='line'&&s.name!=='__limits').flatMap(s=>s.data).filter(d=>d&&d.symbolSize).map(d=>d.symbolSize)")
    ok("종단 점 크기가 농도에 따라 다름", max(sz) - min(sz) >= 6, str((min(sz), max(sz))))
    pg.click("#pfEdit"); pg.wait_for_timeout(800)
    ok("종단 편집 지도 열림", pg.evaluate("!$('peCard').hidden && !!peMap"))
    pg.select_option("#peRiver", "한탄강"); pg.wait_for_timeout(400)
    pg.click("#pePick"); pg.wait_for_timeout(200)
    pick = pg.evaluate("(()=>{ const s = ST.filter(x=>x.river==='한탄강'); const p=[s[3],s[0],s[5]]; p.forEach(x=>peClick(x)); return p.map(x=>x.name); })()")
    pg.click("#pePick"); pg.click("#peSave"); pg.wait_for_timeout(800)
    cats = pg.evaluate("charts.pfChart.getOption().xAxis[0].data")
    print("편집 순서", pick, "→ 종단", cats)
    ok("편집한 순서대로 종단 그래프", cats == pick)
    pg.screenshot(path=f"{OUT}/v4b_prof.png", full_page=True)
    pg.click("#peReset"); pg.wait_for_timeout(600)
    ok("기본 순서로 되돌리기", len(pg.evaluate("charts.pfChart.getOption().xAxis[0].data")) > 3)
    pg.evaluate("setView('interp')"); pg.wait_for_timeout(800)
    pg.evaluate("const e=$('ipC_wet'); e.value='#00aa00'; e.dispatchEvent(new Event('change'))"); pg.wait_for_timeout(500)
    c = pg.evaluate("charts.ipSeason.getOption().series[0].data[6].itemStyle.color")
    ok("자료해석 막대 색 지정(7월=#00aa00)", c == "#00aa00", c)
    pg.screenshot(path=f"{OUT}/v4b_interp.png")
    pg.click("#grpToggle")
    pg.click("#grpSeg button[data-g='all']"); pg.wait_for_timeout(3000)
    ok("전체 지점 묶음 열림(647)", pg.evaluate("ST.length") == 647 and pg.evaluate("S.view") == "interp")
    pg.evaluate("setView('interp')"); pg.wait_for_timeout(800)
    pg.screenshot(path=f"{OUT}/v4_interp.png", full_page=False)
    b.close()
print(f"\n{sum(c for _, c in res)}/{len(res)} 통과")
