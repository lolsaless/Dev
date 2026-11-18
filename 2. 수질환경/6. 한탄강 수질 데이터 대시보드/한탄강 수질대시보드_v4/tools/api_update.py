"""
api_update.py — 물환경 수질측정망(공공데이터포털 API) 대권역 한강 지점 자료 받기·갱신(조사기관 전부)

대시보드의 '관리 구분'(조사기관별 묶음) 자료를 만든다. 필요한 7개 항목(TOC·COD·BOD·SS·T-N·T-P·색도)만 남긴다.
추가 패키지 없이(표준 라이브러리만) 동작한다.

사용법 (프로그램 폴더에서, Mac은 python 대신 python3)
    python tools/api_update.py                 # 자동 갱신: 빠진 연도 + 최근 2개 연도(올해·작년)만 다시 받기 → 합치기
    python tools/api_update.py --years 2024 2025
    python tools/api_update.py --full          # 시작 연도~올해 전부 다시 받기(오래 걸림)
    python tools/api_update.py --merge-only    # 받지 않고 연도별 파일만 다시 합치기
    python tools/api_update.py --check-key     # 인증키로 1번 요청해 연결 시험
    python tools/api_update.py --import-local "…/수질측정망/raw_data"
                                               # 이미 받아 둔 연도별 CSV(원본 전체 열)에서 대상 기관·7항목만 가져오기(API 안 씀)
    --auto                                     # 예약 실행용: 끝나고 기다리지 않음, 결과를 갱신기록.txt 에 덧붙임

폴더 (프로그램 폴더/수질측정망/)
    물환경.env                 공공데이터포털 인증키(DATA_GO_KR_API_KEY=키) — 공유본에서 빼야 함
    지점코드_한강.csv          대권역 한강 지점 코드표(원본 코드표에서 필요한 열·행만)
    지점목록.csv               수집 대상 지점(ORGS=None 이면 대권역 한강 코드표 전체)
    연도별/2000.csv …          연도별 자료(대상 기관·7항목)
    수질측정망_자료.csv        연도별 파일을 합친 것 → tools/api_data.py 가 대시보드 데이터로 바꿈
    갱신정보.json              마지막 갱신 시각·연도별 행 수·최신 검사일
    갱신기록.txt               실행할 때마다 한 줄씩 기록

이럴 때 고침
    시작 연도·다시 받을 최근 연도 수·대상 기관(ORGS) → 아래 '설정' 상수
"""
# ==================================================================
# ★ 설정 — 여기만 바꾸면 됩니다
# ==================================================================
START_YEAR = 2000              # 처음 연도
RECENT_YEARS = 2               # 자동 갱신 때 항상 다시 받을 최근 연도 수(올해 + 작년: 늦게 올라오는 자료 반영)
ORGS = None                    # 남길 조사기관(orgNm) 목록. None = 대권역의 모든 기관
                               # 예: ["경기도 보건환경연구원", "한강유역환경청"]
BASIN = "한강"                 # 코드표 대권역
ENV_FILE = "물환경.env"
# ==================================================================

import argparse
import csv
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
WQ = ROOT / "수질측정망"
YEAR_DIR = WQ / "연도별"
CODE_FILE = WQ / "지점코드_한강.csv"
SITE_FILE = WQ / "지점목록.csv"
ALL_FILE = WQ / "수질측정망_자료.csv"
INFO_FILE = WQ / "갱신정보.json"
LOG_FILE = WQ / "갱신기록.txt"

API_URL = "https://apis.data.go.kr/1480523/WaterQualityService/getWaterMeasuringList"
BATCH_SIZE = 10        # 한 번에 묻는 지점 수(ptNoList 길이 제한 100자 → 7자리 코드 10개)
NUM_OF_ROWS = 1000
SLEEP_SEC = 0.3        # 요청 간격(서버 부담 줄이기)
TIMEOUT = 60
MAX_RETRY = 4
KEY_NAMES = ["DATA_GO_KR_API_KEY", "SERVICE_KEY", "SERVICEKEY", "API_KEY", "WATER_API_KEY", "KEY"]

# API 열 → 대시보드 항목 코드
ITEM_MAP = {"itemToc": "TOC", "itemCod": "COD", "itemBod": "BOD", "itemSs": "SS",
            "itemTn": "T-N", "itemTp": "T-P", "itemCol": "색도"}
ITEMS = list(ITEM_MAP.values())
META_MAP = {"ptNo": "지점코드", "ptNm": "지점명", "구분": "구분", "중권역": "중권역", "orgNm": "조사기관",
            "addr": "주소", "lon": "경도", "lat": "위도", "wmyr": "연도", "wmod": "월", "wmwk": "회차", "wmcymd": "검사일"}
COLUMNS = list(META_MAP.values()) + ITEMS
YEAR_RE = re.compile(r"^(\d{4})(_partial)?\.csv$")


def nfc(s):
    return unicodedata.normalize("NFC", str(s))


def log(msg, auto=False):
    print(msg)
    if auto:
        WQ.mkdir(exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"{datetime.now():%Y-%m-%d %H:%M} {msg}\n")


# ── CSV 읽기·쓰기(엑셀 'CSV UTF-8'·일반 CSV 모두) ─────────────────
def read_csv(path):
    for enc in ("utf-8-sig", "cp949"):
        try:
            with open(path, encoding=enc, newline="") as f:
                return [{nfc(k).strip(): (v or "").strip() for k, v in r.items() if k} for r in csv.DictReader(f)]
        except UnicodeDecodeError:
            continue
    raise SystemExit(f"[오류] 인코딩을 읽지 못했습니다: {path}")


def write_csv(path, rows, cols):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    tmp.replace(path)          # 다 쓴 뒤 바꿔치기 → 중간에 멈춰도 기존 파일이 깨지지 않음


# ── 인증키 ───────────────────────────────────────────────
def read_key():
    env = next((p for p in WQ.glob("*.env") if nfc(p.name) == nfc(ENV_FILE)), None) if WQ.is_dir() else None
    if env is None:
        raise SystemExit(f"[오류] 인증키 파일이 없습니다: 수질측정망/{ENV_FILE}\n"
                         f"       메모장으로 만들고 한 줄 'DATA_GO_KR_API_KEY=발급받은키' 를 적어 주세요.")
    vals = {}
    for ln in env.read_text(encoding="utf-8-sig").splitlines():
        ln = ln.strip()
        if ln and not ln.startswith("#") and "=" in ln:
            k, v = ln.split("=", 1)
            vals[k.strip().upper()] = v.strip().strip('"').strip("'")
    key = next((vals[k] for k in KEY_NAMES if vals.get(k)), None)
    if key is None and len(vals) == 1:
        key = next(iter(vals.values()))
    if not key:
        raise SystemExit(f"[오류] {ENV_FILE} 에서 인증키를 찾지 못했습니다('DATA_GO_KR_API_KEY=키값').")
    return urllib.parse.unquote(key) if "%" in key else key   # 인코딩 키도 허용


# ── 지점 목록 ─────────────────────────────────────────────
def load_sites():
    """수집 대상 = 지점목록.csv(자료 기준) ∪ 코드표에서 조사기관이 ORGS 에 있는 지점"""
    sites = {}
    if SITE_FILE.exists():
        for r in read_csv(SITE_FILE):
            if r.get("지점코드"):
                sites[r["지점코드"]] = r
    if CODE_FILE.exists():
        for r in read_csv(CODE_FILE):
            if r.get("대권역") == BASIN and (ORGS is None or r.get("조사기관") in ORGS) and r.get("지점코드") not in sites:
                sites[r["지점코드"]] = {"지점코드": r["지점코드"], "지점명": r.get("지점명", ""), "구분": r.get("구분", ""),
                                       "중권역": r.get("중권역", ""), "주소": r.get("주소", "")}
    if not sites:
        raise SystemExit("[오류] 수집할 지점이 없습니다. 수질측정망/지점목록.csv 또는 지점코드_한강.csv 를 확인하세요.")
    return dict(sorted(sites.items()))


def code_info():
    return {r["지점코드"]: r for r in read_csv(CODE_FILE)} if CODE_FILE.exists() else {}


# ── API ──────────────────────────────────────────────────
class ApiError(RuntimeError):
    pass


def parse_xml(text):
    """응답 XML → (행 목록, 전체 건수). 자료 없음은 ([], 0)."""
    root = ET.fromstring(text)
    if root.tag == "OpenAPI_ServiceResponse":           # 게이트웨이 오류(인증키·트래픽 등)
        msg = root.findtext(".//returnAuthMsg") or root.findtext(".//errMsg")
        raise ApiError(f"게이트웨이 오류: {msg}")
    code = (root.findtext(".//header/resultCode") or "").strip()
    msg = (root.findtext(".//header/resultMsg") or "").strip()
    if code not in ("00", "0", "000"):
        if code == "03" or "NODATA" in msg.upper().replace("_", ""):
            return [], 0
        raise ApiError(f"API 오류 {code}: {msg}")
    total = int(root.findtext(".//totalCount") or 0)
    rows = [{c.tag: (c.text or "").strip() for c in item} for item in root.iter("item")]
    return rows, total


def call_api(params):
    url = API_URL + "?" + urllib.parse.urlencode(params)
    last = None
    for attempt in range(1, MAX_RETRY + 1):
        try:
            with urllib.request.urlopen(url, timeout=TIMEOUT) as r:
                return parse_xml(r.read().decode("utf-8", "replace"))
        except ApiError as e:
            if "게이트웨이" in str(e) or "SERVICE_KEY" in str(e):
                raise                                 # 키 문제는 다시 해도 같음
            last = e
        except (urllib.error.URLError, TimeoutError, ET.ParseError, OSError) as e:
            last = e
        time.sleep(2 * attempt)
    raise ApiError(f"{MAX_RETRY}회 실패: {last}")


def fetch_batch(key, codes, year):
    rows, page = [], 1
    while True:
        got, total = call_api({"serviceKey": key, "numOfRows": NUM_OF_ROWS, "pageNo": page, "resultType": "xml",
                               "ptNoList": ",".join(codes), "wmyrList": str(year)})
        rows.extend(got)
        if not got or len(rows) >= total:
            return rows
        page += 1
        time.sleep(SLEEP_SEC)


# ── 정리: API 행(또는 원본 CSV 행) → 한강청·7항목 행 ─────────────────
def _num(v):
    try:
        return float(str(v).replace(",", "")) if str(v).strip() not in ("", "nan", "NaN") else None
    except ValueError:
        return None


def _coord(r, k):
    if r.get(k):
        return _num(r[k])
    d, m, s = (_num(r.get(k + x)) for x in ("Dgr", "Min", "Sec"))
    return d + (m or 0) / 60 + (s or 0) / 3600 if d is not None else None


def tidy(rows, sites, codes):
    out = []
    for r in rows:
        org = nfc(r.get("orgNm", "")).strip()
        if ORGS is not None and org not in ORGS:
            continue
        no = r.get("ptNo", "")
        vals = {ITEM_MAP[k]: _num(r.get(k)) for k in ITEM_MAP}
        if all(v is None for v in vals.values()):
            continue                                  # 7개 항목이 모두 빈 행은 버림
        si, ci = sites.get(no, {}), codes.get(no, {})
        lon, lat = _coord(r, "lon"), _coord(r, "lat")
        ymd = str(r.get("wmcymd", "")).replace(".", "-")[:10]
        row = {"지점코드": no, "지점명": nfc(r.get("ptNm", "")),
               "구분": r.get("구분") or si.get("구분") or ci.get("구분", ""),
               "중권역": r.get("중권역") or si.get("중권역") or ci.get("중권역", ""),
               "조사기관": org, "주소": nfc(r.get("addr", "")),
               "경도": f"{lon:.6f}" if lon else "", "위도": f"{lat:.6f}" if lat else "",
               "연도": str(r.get("wmyr", "")).strip(), "월": str(r.get("wmod", "")).strip().zfill(2),
               "회차": nfc(r.get("wmwk", "")), "검사일": ymd}
        for k, v in vals.items():
            row[k] = "" if v is None else f"{v:g}"
        out.append(row)
    uniq = {tuple(r[c] for c in COLUMNS): r for r in out}           # 완전히 같은 행 제거
    return sorted(uniq.values(), key=lambda r: (r["지점코드"], r["연도"], r["월"], r["검사일"], r["회차"]))


# ── 합치기 ───────────────────────────────────────────────
def year_files():
    by = {}
    if YEAR_DIR.is_dir():
        for p in sorted(YEAR_DIR.iterdir()):
            m = YEAR_RE.match(nfc(p.name))
            if m and (m.group(1) not in by or not m.group(2)):
                by[m.group(1)] = p                     # 완성본이 있으면 일부 실패본(_partial)보다 우선
    return by


def merge_all(auto=False):
    by = year_files()
    if not by:
        log("[알림] 수질측정망/연도별/ 에 합칠 파일이 없습니다.", auto)
        return 1
    rows, per = [], {}
    for y, p in sorted(by.items()):
        rr = read_csv(p)
        rows += rr
        per[y] = len(rr)
    write_csv(ALL_FILE, rows, COLUMNS)
    # 지점목록 갱신(자료에 나온 지점, 마지막 이름·좌표)
    sites = {}
    for r in rows:
        sites[r["지점코드"]] = {k: r[k] for k in ("지점코드", "지점명", "구분", "중권역", "조사기관", "주소", "경도", "위도")}
    old = {r["지점코드"]: r for r in read_csv(SITE_FILE)} if SITE_FILE.exists() else {}
    for k, v in old.items():
        sites.setdefault(k, v)
    write_csv(SITE_FILE, [sites[k] for k in sorted(sites)], ["지점코드", "지점명", "구분", "중권역", "조사기관", "주소", "경도", "위도"])
    dates = [r["검사일"] for r in rows if re.match(r"^\d{4}-\d{2}-\d{2}$", r["검사일"]) and r["검사일"][:4] == r["연도"]]
    info = {"updated": datetime.now().strftime("%Y-%m-%d %H:%M"), "rows": len(rows), "sites": len(sites),
            "first": min(dates) if dates else "", "last": max(dates) if dates else "", "perYear": per,
            "partial": [y for y, p in by.items() if "partial" in p.name], "orgs": ORGS, "items": ITEMS,
            "perOrg": {o: len({r["지점코드"] for r in rows if r["조사기관"] == o}) for o in sorted({r["조사기관"] for r in rows})}}
    INFO_FILE.write_text(json.dumps(info, ensure_ascii=False, indent=1), encoding="utf-8")
    log(f"[합치기] {len(rows):,}행 · 지점 {len(sites)}개 · 검사일 {info['first']} ~ {info['last']} → {ALL_FILE.name}", auto)
    if info["partial"]:
        log(f"[주의] 일부 실패한 연도: {', '.join(info['partial'])} — 다음 실행 때 다시 받습니다.", auto)
    return 0


# ── 가져오기(이미 받은 원본 CSV) ──────────────────────────────
def import_local(src, auto=False):
    src = Path(src).expanduser()
    files = sorted(p for p in src.glob("*.csv") if YEAR_RE.match(nfc(p.name)) and "partial" not in p.name)
    if not files:
        raise SystemExit(f"[오류] 연도별 CSV(2000.csv …)가 없습니다: {src}")
    sites, codes = (load_sites() if SITE_FILE.exists() or CODE_FILE.exists() else {}), code_info()
    for p in files:
        rows = tidy(read_csv(p), sites, codes)
        if rows:
            write_csv(YEAR_DIR / p.name, rows, COLUMNS)
        log(f"  [{p.stem}] 원본 → 대상 기관 {len(rows):,}행", auto)
    return merge_all(auto)


# ── 받기 ────────────────────────────────────────────────
def years_to_fetch(args):
    this = date.today().year
    if args.years:
        return sorted(set(args.years))
    have = set(year_files())
    if args.full:
        return list(range(START_YEAR, this + 1))
    recent = set(range(this - RECENT_YEARS + 1, this + 1))
    missing = {y for y in range(START_YEAR, this + 1) if str(y) not in have}
    partial = {int(y) for y, p in year_files().items() if "partial" in p.name}
    return sorted(recent | missing | partial)


def online():
    """공공데이터포털에 닿는지 10초 안에 확인(행정망·오프라인이면 오래 기다리지 않고 멈춤)"""
    try:
        urllib.request.urlopen(API_URL, timeout=10).close()
        return True
    except urllib.error.HTTPError:
        return True                                   # 서버가 응답함(키 없음 오류 등) = 연결은 됨
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def fetch(args):
    auto = args.auto
    key = read_key()
    if not online():
        log("[중단] 공공데이터포털(apis.data.go.kr)에 연결할 수 없습니다 — 인터넷이 되는 PC에서 실행하세요(행정망 PC는 차단). 기존 자료는 그대로입니다.", auto)
        return 1
    sites, codes = load_sites(), code_info()
    nos = list(sites)
    batches = [nos[i:i + BATCH_SIZE] for i in range(0, len(nos), BATCH_SIZE)]
    years = years_to_fetch(args)
    log(f"[갱신 시작] {'·'.join(ORGS) if ORGS else BASIN + ' 대권역 모든 기관'} 지점 {len(nos)}개 · 받을 연도 {years[0]}~{years[-1]} ({len(years)}개) · 요청 묶음 {len(batches)}개/연도", auto)
    for y in years:
        rows, failed = [], 0
        for i, b in enumerate(batches, 1):
            try:
                rows += fetch_batch(key, b, y)
            except ApiError as e:
                print(f"  [{y}] {i}/{len(batches)} 실패: {e}")
                if "게이트웨이" in str(e) or "SERVICE_KEY" in str(e):
                    log("[중단] 인증키 오류 — 수질측정망/물환경.env 의 키를 확인하세요.", auto)
                    return 1
                failed += 1
            time.sleep(SLEEP_SEC)
        df = tidy(rows, sites, codes)
        out, part = YEAR_DIR / f"{y}.csv", YEAR_DIR / f"{y}_partial.csv"
        if not df:
            log(f"  [{y}] 자료 없음", auto)
            continue
        if failed:
            write_csv(part, df, COLUMNS)              # 완성본은 건드리지 않음 → 다음 실행 때 다시 받음
            log(f"  [{y}] {len(df):,}행(일부 실패 {failed}묶음) → {part.name}", auto)
        else:
            old = len(read_csv(out)) if out.exists() else 0
            write_csv(out, df, COLUMNS)
            if part.exists():
                try:
                    part.unlink()
                except OSError:
                    pass
            last = max((r["검사일"] for r in df if r["검사일"][:4] == str(y)), default="-")
            log(f"  [{y}] {len(df):,}행 (이전 {old:,}행, {len(df) - old:+,}) · 최신 검사일 {last}", auto)
    return merge_all(auto)


def check_key():
    key = read_key()
    sites = list(load_sites())[:1]
    try:
        rows, total = call_api({"serviceKey": key, "numOfRows": 1, "pageNo": 1, "resultType": "xml",
                                "ptNoList": sites[0], "wmyrList": str(date.today().year - 1)})
        print(f"[연결 성공] {sites[0]} 작년 자료 {total}건")
        return 0
    except ApiError as e:
        print(f"[연결 실패] {e}")
        return 1


def main():
    ap = argparse.ArgumentParser(description="물환경 수질측정망 API → 조사기관별 지점 7개 항목")
    ap.add_argument("--years", type=int, nargs="+", help="받을 연도")
    ap.add_argument("--full", action="store_true", help="시작 연도부터 전부 다시")
    ap.add_argument("--merge-only", action="store_true")
    ap.add_argument("--check-key", action="store_true")
    ap.add_argument("--import-local", metavar="폴더")
    ap.add_argument("--auto", action="store_true", help="예약 실행용(기록 파일에 남김)")
    a = ap.parse_args()
    if a.check_key:
        return check_key()
    if a.import_local:
        return import_local(a.import_local, a.auto)
    if a.merge_only:
        return merge_all(a.auto)
    try:
        return fetch(a)
    except SystemExit as e:
        log(str(e), a.auto)
        return 1


if __name__ == "__main__":
    sys.exit(main())
