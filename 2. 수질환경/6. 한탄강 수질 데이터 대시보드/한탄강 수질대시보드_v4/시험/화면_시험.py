"""화면_시험.py — v4 화면 시험(관리 구분 순서·전환, 모든 탭 오류, 값 복원, 기간 막대)
준비: pip install playwright → python -m playwright install chromium
사용: python 시험/화면_시험.py 한탄강_수질대시보드.html의_절대경로 결과폴더
"""
import sys, os
from playwright.sync_api import sync_playwright
HTML = sys.argv[1]; OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
res = []
def ok(n, c, d=""):
    res.append((n, bool(c))); print(("[통과] " if c else "[실패] ") + n + (f" — {d}" if d and not c else ""))
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1500, "height": 1000})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "ERR_TUNNEL" not in m.text and "Failed to load resource" not in m.text else None)
    pg.goto("file://" + HTML); pg.wait_for_timeout(2500)
    groups = pg.evaluate("GRPS.map(g=>({key:g.key,label:g.label,n:g.n}))")
    print(groups)
    ok("맨 위 = 경기도 보건환경연구원", groups[0]["label"] == "경기도 보건환경연구원")
    ns = [g["n"] for g in groups[1:]]
    ok("나머지는 지점 수 많은 순", ns == sorted(ns, reverse=True))
    ok("엑셀 DB 묶음 없음", not any("엑셀" in g["label"] for g in groups))
    ok("처음 열면 경기도 보건환경연구원", pg.evaluate("GRP") == groups[0]["key"])
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
    for g in groups[:4]:
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
    pg.goto("file://" + HTML + "#grp=" + groups[0]["key"]); pg.reload(); pg.wait_for_timeout(2000)
    pg.click(f"#grpSeg button[data-g='{hk}']"); pg.wait_for_timeout(2500)
    ok("버튼으로 기관 전환", pg.evaluate("GRP") == hk)
    pg.evaluate("setView('interp')"); pg.wait_for_timeout(800)
    pg.screenshot(path=f"{OUT}/v4_interp.png", full_page=False)
    b.close()
print(f"\n{sum(c for _, c in res)}/{len(res)} 통과")
