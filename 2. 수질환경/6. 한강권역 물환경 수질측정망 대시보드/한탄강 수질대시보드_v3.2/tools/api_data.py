"""
api_data.py — 수질측정망/수질측정망_자료.csv → 대시보드 API 자료(D.api)와 묶음 정의

하는 일
- 지점(연구원 + 한강유역환경청)·월(처음 달~마지막 달 연속)·7개 항목 표를 한 번만 만든다(D.api).
  묶음은 같은 자료를 기관으로 걸러 보여 준다.
    연구원 관리      = 조사기관이 INST_ORG(경기도 보건환경연구원)인 지점
    한강유역환경청   = 연구원 + 한강유역환경청 지점 모두
- 같은 달 여러 회차는 평균한다. 월은 API 측정연월(wmyr·wmod) 기준.
- 자동 점검: 이상값 의심(지점별 로버스트 z), 전월 동일, 검사일과 측정연월이 2개월 이상 어긋남
- 화면 크기를 줄이려고 채취일은 '일(day)' 숫자만 넣는다(화면이 열 때 YYYY-MM-DD 로 되돌림).
- pandas 없이 표준 라이브러리만 쓴다.

이럴 때 고침
- 묶음 이름·기관 → GROUPS, INST_ORG
- 처음 열 때 선택할 하천(중권역)·기간 → DEFAULT_RIVER, DEFAULT_YEARS
- 왼쪽 패널 묶음 기준 → RIVER_FIELD
"""
import csv
import json
import re
import statistics
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import wq_common as W  # noqa: E402

WQ = W.ROOT / "수질측정망"
ALL_FILE = WQ / "수질측정망_자료.csv"
INFO_FILE = WQ / "갱신정보.json"
RIVER_FIELD = "중권역"        # 왼쪽 패널 묶음 기준(중권역)
DEFAULT_RIVER = "한탄강"      # 처음 열 때 선택할 중권역(목록 맨 위로 올림)
DEFAULT_YEARS = 10           # 처음 열 때 보여 줄 최근 연도 수
INST_ORG = "경기도 보건환경연구원"
ORG_SHORT = {"경기도 보건환경연구원": "연구원", "한강유역환경청": "유역청"}
# 묶음: key, 버튼 이름, 포함할 기관(None = 전부), 설명
GROUPS = [
    ("inst", "연구원 관리", [INST_ORG], "수질측정망 중 경기도 보건환경연구원 조사 지점"),
    ("hrec", "한강유역환경청", None, "연구원 + 한강유역환경청 조사 지점 모두"),
]
SIGUN_RE = re.compile(r"(\S+?(?:시|군))(?:\s|$)")


def _num(v):
    try:
        return float(v) if v not in ("", None) else None
    except ValueError:
        return None


def month_range(a, b):
    y, m = int(a[:4]), int(a[5:])
    out = []
    while f"{y}-{m:02d}" <= b:
        out.append(f"{y}-{m:02d}")
        m += 1
        if m > 12:
            y, m = y + 1, 1
    return out


def build_api(cfg):
    """cfg: DB 설정 시트(dict). 반환: (api 데이터 dict 또는 None, 묶음 목록, 주의 목록)"""
    warns = []
    if not ALL_FILE.exists():
        warns.append(f"수질측정망/{ALL_FILE.name} 이 없어 API 묶음을 빼고 만들었습니다 (수질측정망_갱신 실행 후 다시 빌드).")
        return None, [], warns
    with open(ALL_FILE, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    codes = W.ITEMS
    meta, acc, days, bad_date = {}, defaultdict(lambda: defaultdict(list)), {}, []
    for r in rows:
        no = r["지점코드"]
        try:
            ym = f"{int(r['연도'])}-{int(r['월']):02d}"
        except ValueError:
            continue
        meta[no] = r                                   # 마지막(최근) 행의 이름·좌표 사용
        d = r.get("검사일", "")
        if re.match(r"^\d{4}-\d{2}-\d{2}$", d):
            gap = abs((int(d[:4]) * 12 + int(d[5:7])) - (int(ym[:4]) * 12 + int(ym[5:])))
            if gap == 0:
                days[(no, ym)] = int(d[8:])
            elif gap > 1:          # 앞뒤 1개월 차이는 조사 일정상 흔함 → 2개월 이상 차이만 점검
                bad_date.append((no, ym, d))
        for c in codes:
            v = _num(r.get(c))
            if v is not None:
                acc[(no, ym)][c].append(v)
    if not acc:
        return None, [], warns + ["API 자료에 측정값이 없습니다."]
    allm = sorted({k[1] for k in acc})
    months = month_range(allm[0], allm[-1])
    midx = {m: i for i, m in enumerate(months)}

    # 지점: 처음 선택 중권역을 맨 위로, 나머지는 코드 순서(대체로 상류→하류) · 같은 이름이면 코드 붙임
    nos = sorted(meta, key=lambda no: (meta[no].get(RIVER_FIELD) != DEFAULT_RIVER, no))
    cnt = defaultdict(int)
    for no in nos:
        cnt[meta[no]["지점명"]] += 1
    stations, name_of = [], {}
    for i, no in enumerate(nos, 1):
        m = meta[no]
        name = m["지점명"] if cnt[m["지점명"]] == 1 else f"{m['지점명']}({no})"
        name_of[no] = name
        sg = SIGUN_RE.findall(m.get("주소", ""))
        org = m.get("조사기관", "")
        kind = m.get("구분", "")
        stations.append({"id": "A" + no, "code": no, "name": name, "river": m.get(RIVER_FIELD) or "미분류",
                         "sigun": sg[0] if sg else "", "addr": m.get("주소", ""),
                         "lat": _num(m.get("위도")), "lon": _num(m.get("경도")),
                         "coord": "확정" if m.get("위도") else "미입력", "coordSrc": "물환경정보시스템(수질측정망)",
                         "org": org, "orgShort": ORG_SHORT.get(org, org), "kind": kind,
                         "note": ORG_SHORT.get(org, org) + ("" if kind in ("하천수", "") else "·" + kind),
                         "order": i})

    values, dates, multi = {}, {}, 0
    for no in nos:
        n = name_of[no]
        values[n] = {c: [None] * len(months) for c in codes}
        dl = [0] * len(months)
        for c in codes:
            row = values[n][c]
            for m in months:
                vs = acc.get((no, m), {}).get(c)
                if vs:
                    row[midx[m]] = round(sum(vs) / len(vs), 4)
                    multi += len(vs) > 1
        for m in months:
            if (no, m) in days:
                dl[midx[m]] = days[(no, m)]
        dates[n] = dl

    # ── 자료 점검 ─────────────────────────
    qc = []
    zthr = float(W.to_num(cfg.get("이상값_기준")) or 6)
    ratio = float(W.to_num(cfg.get("이상값_배율")) or 5)
    nrep = int(W.to_num(cfg.get("전월동일_항목수")) or 4)
    for n in values:
        for c in codes:
            arr = values[n][c]
            v = [x for x in arr if x is not None]
            if len(v) < 8:
                continue
            med = statistics.median(v)
            mad = statistics.median([abs(x - med) for x in v])
            if mad == 0 or med == 0:
                continue
            for i, x in enumerate(arr):
                if x is None:
                    continue
                z = 0.6745 * (x - med) / mad
                rr = x / med
                if abs(z) >= zthr and (rr >= ratio or rr <= 1 / ratio):
                    qc.append({"type": "outlier", "st": n, "m": months[i], "item": c, "z": round(z, 1),
                               "note": f"지점 중앙값 {med:g}의 {rr:.1f}배 (z={z:.1f})"})
        for i in range(1, len(months)):
            same = [c for c in codes if values[n][c][i] is not None and values[n][c][i] == values[n][c][i - 1]]
            if len(same) >= nrep:
                for c in same:
                    qc.append({"type": "repeat", "st": n, "m": months[i], "item": c,
                               "note": f"전월({months[i - 1]})과 {len(same)}개 항목 값이 같음 — 원자료 확인"})
    for no, ym, d in bad_date:
        qc.append({"type": "manual", "st": name_of[no], "m": ym, "item": None,
                   "note": f"검사일 {d} 이(가) 측정연월({ym})과 다름 — API 원자료 입력 오류 의심(값은 측정연월 기준으로 사용)"})

    info = {}
    if INFO_FILE.exists():
        try:
            info = json.loads(INFO_FILE.read_text(encoding="utf-8"))
        except ValueError:
            info = {}
    first_y = max(int(months[0][:4]), int(months[-1][:4]) - DEFAULT_YEARS + 1)
    api = {"source": "물환경 수질측정망 API", "updated": info.get("updated", ""), "lastDate": info.get("last", ""),
           "stations": stations, "months": months, "values": values, "datesD": dates, "qc": qc,
           "note": "같은 달 여러 회차는 평균 · 측정연월(wmyr·wmod) 기준"}
    groups = []
    for key, label, orgs, desc in GROUPS:
        sts = [s for s in stations if orgs is None or s["org"] in orgs]
        if not sts:
            continue
        rivers = [s["river"] for s in sts]
        def_river = DEFAULT_RIVER if DEFAULT_RIVER in rivers else rivers[0]
        groups.append({"key": key, "label": label, "n": len(sts), "orgs": orgs, "api": True,
                       "desc": f"{desc} {len(sts)}개 · {months[0][:4]}년~ · API 갱신 {api['updated'] or '-'}",
                       "defaults": {"sel": [s["name"] for s in sts if s["river"] == def_river],
                                    "from": midx.get(f"{first_y}-01", 0), "profRiver": def_river}})
    if multi:
        warns.append(f"API 자료: 같은 달 여러 회차 {multi:,}건(지점·월·항목)을 평균했습니다.")
    return api, groups, warns


if __name__ == "__main__":
    a, g, w = build_api({})
    for x in w:
        print("[확인]", x)
    if a:
        s = json.dumps(a, ensure_ascii=False, separators=(",", ":"))
        print(f"지점 {len(a['stations'])} · 월 {len(a['months'])} ({a['months'][0]}~{a['months'][-1]}) · "
              f"점검 {len(a['qc'])} · 크기 {len(s.encode()) / 1e6:.1f} MB")
        for x in g:
            print(f"  묶음 {x['key']} {x['label']}: {x['n']}개, 처음 선택 {len(x['defaults']['sel'])}개")
