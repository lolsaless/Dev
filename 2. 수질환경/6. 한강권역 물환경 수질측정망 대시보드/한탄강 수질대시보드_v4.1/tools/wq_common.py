"""
wq_common.py — 수질측정망 대시보드 공통 모듈(설정 엑셀 읽기·쓰기) (읽기·쓰기·값 해석·폴더 위치)
모든 스크립트(01~04)가 이 모듈로 DB를 읽고 써서 양식이 항상 같게 유지된다.
"""
import math
import re
import shutil
from datetime import datetime
from pathlib import Path

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.table import Table, TableStyleInfo

TOOLS = Path(__file__).resolve().parent          # tools/ 폴더
ROOT = TOOLS.parent                               # 프로그램 폴더(DB·HTML이 있는 곳)
HERE = ROOT                                       # 이전 버전 호환
SRC = ROOT / "소스"
LIBDIR = SRC / "10_외부라이브러리"
OUTDIR = ROOT / "빌드결과"
DEFAULT_DB = ROOT / "수질측정망_설정.xlsx"          # v4: 측정자료 없이 항목정보·기준값·설정만
HTML_NAME = "한강권역_수질측정망_대시보드.html"
ITEMS = ["TOC", "COD", "BOD", "SS", "T-N", "T-P", "색도"]

MEAS_COLS = ["조사연월", "채취일", "시료번호"] + ITEMS + ["검토표시", "비고"]
ST_COLS = ["정렬순서", "지점ID", "하천명", "시료번호", "시군", "주소", "위도", "경도", "좌표상태", "좌표출처", "비고"]
ITEM_COLS = ["항목", "표시명", "단위", "소수자리", "설명"]
LIM_COLS = ["항목", "구분", "등급코드", "등급명", "상한값", "비고"]
YEAR_COLS = ["시료번호", "하천명", "주소", "연도", "평균색도", "구간"]
SET_COLS = ["설정", "값", "설명"]
PROF_COLS = ["중권역", "순서", "지점코드", "지점명", "관리구분", "흐름그룹", "하류그룹"]   # v4: 상·하류 종단 지점 순서(대시보드 [종단 편집]에서 저장)

ITEM_INFO = [
    ("TOC", "총유기탄소(TOC)", "mg/L", 2, "하천 생활환경기준 등급 판정 항목"),
    ("COD", "화학적산소요구량(COD)", "mg/L", 1, "일부 지점만 분석"),
    ("BOD", "생물화학적산소요구량(BOD)", "mg/L", 1, "하천 생활환경기준 등급 판정 항목"),
    ("SS", "부유물질(SS)", "mg/L", 1, "하천 생활환경기준 등급 판정 항목"),
    ("T-N", "총질소(T-N)", "mg/L", 3, "하천 기준 없음(참고)"),
    ("T-P", "총인(T-P)", "mg/L", 3, "하천 생활환경기준 등급 판정 항목"),
    ("색도", "색도", "도", 0, "목표 기준(기준값 시트) 대비 달성 여부"),
]
GRADES = ["매우좋음", "좋음", "약간좋음", "보통", "약간나쁨", "나쁨", "매우나쁨"]
GRADE_CODE = ["Ia", "Ib", "II", "III", "IV", "V", "VI"]
GRADE_LIMITS = {
    "BOD": [1, 2, 3, 5, 8, 10],
    "TOC": [2, 3, 4, 5, 6, 8],
    "SS": [25, 25, 25, 25, 100, None],
    "T-P": [0.02, 0.04, 0.1, 0.2, 0.3, 0.5],
}
COLOR_TARGET = 15

# 설정: (키, 기본값, 설명, 선택지)
SETTINGS = [
    ("VWORLD_KEY", "", "V월드 인증키(지도 배경·좌표 검색). 비우면 시군 경계만 표시", None),
    ("VWORLD_DOMAIN", "", "인증키 발급 때 등록한 서비스 URL(예: http://localhost:8765). 좌표 검색에 사용", None),
    ("기본배경지도", "자동", "자동=라이트 일반지도·다크 야간지도", ["자동", "일반", "백지도", "위성", "하이브리드", "야간", "없음"]),
    ("기본항목", "색도", "대시보드를 열었을 때 처음 보이는 항목", ITEMS),
    ("평균대비_판정", "표준편차", "▲▼ 표시 기준. 표준편차=평균±k·σ 밖, 퍼센트=평균±p% 밖, 전체=평균과 다르면 모두", ["표준편차", "퍼센트", "전체"]),
    ("평균대비_k", 1, "표준편차 배수 k (보통 1)", None),
    ("평균대비_p", 30, "퍼센트 기준 p (%)", None),
    ("이상값_기준", 6, "지점별 중앙값에서 벗어난 정도(로버스트 z). 이 값 이상이고 아래 배율도 넘으면 '이상값 의심'", None),
    ("이상값_배율", 5, "지점 중앙값의 몇 배 이상(또는 몇 분의 1 이하)일 때 이상값으로 볼지", None),
    ("특이경향_기준", 8, "시계열에서 선을 강조할 '특이 경향(급변)' 기준. 지점별 중앙값 대비 로버스트 z 최대값", None),
    ("전월동일_항목수", 4, "전월과 같은 값이 이 개수 이상인 항목이면 '전월 동일' 점검", None),
    ("정량한계_처리", "한계값", "'<0.5'처럼 입력된 값의 계산 방법: 한계값=0.5, 절반=0.25, 제외=계산 제외", ["한계값", "절반", "제외"]),
]


HEAD_FILL = PatternFill("solid", fgColor="1F4E5A")
HEAD_FONT = Font(name="맑은 고딕", bold=True, color="FFFFFF", size=10)
BODY_FONT = Font(name="맑은 고딕", size=10)
NOTE_FILL = PatternFill("solid", fgColor="FFF2CC")
THIN = Side(style="thin", color="C9D3D6")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


# ── 값 해석 ──────────────────────────────────────────────
def to_num(v):
    if v is None or v == "":
        return None
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return None if (isinstance(v, float) and math.isnan(v)) else float(v)
    try:
        return float(str(v).strip().replace(",", ""))
    except ValueError:
        return None


LOQ_RE = re.compile(r"^\s*(?:<|＜|ND\s*<?)\s*([\d.]+)\s*$", re.I)


def parse_value(v):
    """측정값 해석 → (숫자, 정량한계 문자열 또는 None). '<0.5' → (0.5, '<0.5'), 'ND' → (None,'ND')."""
    if isinstance(v, str):
        s = v.strip()
        m = LOQ_RE.match(s)
        if m:
            return float(m.group(1)), "<" + m.group(1)
        if s.upper() == "ND":
            return None, "ND"
    return to_num(v), None


def norm_month(v):
    if isinstance(v, datetime):
        return f"{v.year}-{v.month:02d}"
    s = str(v).strip().replace(".", "-").replace("/", "-")
    if len(s) == 6 and s.isdigit():
        return f"{s[:4]}-{s[4:]}"
    y, m = s.split("-")[:2]
    return f"{int(y)}-{int(m):02d}"


def clean_river(name):
    return re.sub(r"^\d+\)\s*", "", str(name)).strip() if name else None


# ── 읽기 ─────────────────────────────────────────────────
def sheet_dicts(wb, name):
    if name not in wb.sheetnames:
        return []
    it = wb[name].iter_rows(values_only=True)
    try:
        hdr = [str(h).strip() if h is not None else "" for h in next(it)]
    except StopIteration:
        return []
    return [dict(zip(hdr, r)) for r in it if any(v not in (None, "") for v in r)]


def read_db(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    db = {
        "meas": sheet_dicts(wb, "측정결과"),
        "stations": sheet_dicts(wb, "지점정보"),
        "items": sheet_dicts(wb, "항목정보"),
        "limits": sheet_dicts(wb, "기준값"),
        "yearly": sheet_dicts(wb, "연평균색도"),
        "settings": sheet_dicts(wb, "설정"),
        "prof": sheet_dicts(wb, "종단순서"),
    }
    # 이전 버전 호환: '지점명' → '시료번호', 사용하지 않는 '수계' 열 제거
    for key in ("meas", "stations", "yearly"):
        for r in db[key]:
            if "시료번호" not in r and "지점명" in r:
                r["시료번호"] = r.pop("지점명")
            r.pop("수계", None)
    for s in db["stations"]:
        if s.get("좌표상태") == "측정망":
            s["좌표상태"] = "추정"
    # v1 DB 호환: 없는 시트는 기본값으로 채움
    if not db["items"]:
        db["items"] = [dict(zip(ITEM_COLS, r)) for r in ITEM_INFO]
    if not db["limits"]:
        db["limits"] = default_limits()
    have = {r.get("설정") for r in db["settings"]}
    for k, v, d, _ in SETTINGS:
        if k not in have:
            db["settings"].append({"설정": k, "값": v, "설명": d})
    for s in db["stations"]:
        s.setdefault("좌표출처", "주소 기반 추정" if s.get("좌표상태") == "추정" else "")
    return db


def settings_dict(db):
    out = {k: v for k, v, _, _ in SETTINGS}
    for r in db["settings"]:
        if r.get("설정"):
            out[str(r["설정"]).strip()] = r.get("값") if r.get("값") is not None else ""
    return out


def default_limits():
    rows = []
    for it, lims in GRADE_LIMITS.items():
        for code, gname, lim in zip(GRADE_CODE, GRADES, lims + [None]):
            rows.append({"항목": it, "구분": "생활환경기준", "등급코드": code, "등급명": gname,
                         "상한값": lim, "비고": "상한 없음" if lim is None else ""})
    rows.append({"항목": "색도", "구분": "목표", "등급코드": "-", "등급명": "목표", "상한값": COLOR_TARGET,
                 "비고": "연평균 이하이면 달성(원본 판정과 일치하도록 설정, 확인 필요)"})
    return rows


# ── 쓰기 ─────────────────────────────────────────────────
def _style(ws, widths):
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    for c in ws[1]:
        c.fill, c.font, c.border = HEAD_FILL, HEAD_FONT, BORDER
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[1].height = 24
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.font, c.border = BODY_FONT, BORDER
    ws.freeze_panes = "A2"


def _table(ws, name, style="TableStyleLight11"):
    ref = f"A1:{get_column_letter(ws.max_column)}{max(ws.max_row, 2)}"
    t = Table(displayName=name, ref=ref)
    t.tableStyleInfo = TableStyleInfo(name=style, showRowStripes=True)
    ws.add_table(t)


def _sheet(wb, title, cols, rows, widths, tname, tstyle="TableStyleLight11"):
    ws = wb.create_sheet(title)
    ws.append(cols)
    for r in rows:
        ws.append([r.get(c) for c in cols])
    _style(ws, widths)
    _table(ws, tname, tstyle)
    return ws


GUIDE = [
    ("한강권역 물환경 수질측정망 대시보드 — 설정 (v4)", ""),
    ("", ""),
    ("시트", "용도 / 입력 규칙"),
    ("항목정보", "7개 항목의 표시 이름·단위·소수 자리."),
    ("기준값", "하천 생활환경기준 등급 상한값과 색도 목표값."),
    ("설정", "V월드 인증키, 기본 배경지도·항목, ▲▼ 판정 기준, 이상값 기준. 대시보드 '설정' 탭에서도 고칠 수 있음."),
    ("종단순서", "관리 구분·중권역별 흐름 그룹과 합류할 하류 그룹. 그룹 안의 순서 1은 첫 상류 지점. 대시보드 종단 편집에서 저장."),
    ("", ""),
    ("측정자료", "v4부터 측정값은 물환경 수질측정망 API 자료(수질측정망/ 폴더)만 쓴다. 이 파일에는 측정값을 넣지 않는다."),
]


def write_db(path, db, backup=True):
    """설정 파일(안내·항목정보·기준값·설정 시트)을 표준 양식으로 저장. 기존 파일은 '백업' 폴더에 복사 후 덮어씀."""
    path = Path(path)
    if backup and path.exists():
        bdir = path.parent / "백업"
        bdir.mkdir(exist_ok=True)
        shutil.copy2(path, bdir / f"{path.stem}_{datetime.now():%Y%m%d_%H%M%S}{path.suffix}")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "안내"
    for g in GUIDE:
        ws.append(g)
    ws["A1"].font = Font(name="맑은 고딕", bold=True, size=14, color="1F4E5A")
    for r in ws.iter_rows(min_row=3, max_row=ws.max_row):
        r[0].font = Font(name="맑은 고딕", bold=True, size=10)
        r[1].font = Font(name="맑은 고딕", size=10)
        r[1].alignment = Alignment(wrap_text=True, vertical="top")
    ws.column_dimensions["A"].width = 14
    ws.column_dimensions["B"].width = 110

    _sheet(wb, "항목정보", ITEM_COLS, db["items"], [8, 26, 8, 9, 46], "항목정보")
    _sheet(wb, "기준값", LIM_COLS, db["limits"], [8, 12, 9, 10, 9, 56], "기준값")
    ws = _sheet(wb, "설정", SET_COLS, db["settings"], [18, 42, 90], "설정")
    for i, r in enumerate(db["settings"], start=2):
        choice = next((c for k, _, _, c in SETTINGS if k == r.get("설정")), None)
        if choice:
            dv = DataValidation(type="list", formula1='"' + ",".join(choice) + '"', allow_blank=False)
            dv.add(f"B{i}")
            ws.add_data_validation(dv)
    prof = sorted(db.get("prof") or [], key=lambda r: (str(r.get("중권역") or ""), to_num(r.get("순서")) or 0))
    ws = _sheet(wb, "종단순서", PROF_COLS, prof, [14, 8, 12, 18, 15, 22, 22], "종단순서")
    for row in ws.iter_rows(min_row=2, min_col=6, max_col=7):
        for cell in row:
            if isinstance(cell.value, str):
                cell.data_type = "s"
    try:
        wb.save(path)
    except PermissionError:
        raise DBLocked(f"'{path.name}' 파일이 엑셀에서 열려 있습니다. 엑셀을 닫고 다시 저장하세요.")


class DBLocked(SystemExit):
    """DB 엑셀이 다른 프로그램(엑셀)에서 열려 있어 저장할 수 없음"""


# ── 기존(월별 시트) 양식 읽기 ─────────────────────────────
def _cell_value(v):
    """원본 셀 값: 숫자는 숫자, '7.3 ' 같은 문자 숫자는 숫자로, '<0.5'는 문자 그대로 보존."""
    if isinstance(v, str):
        s = v.strip()
        if s in ("", "-", "—"):
            return None
        if LOQ_RE.match(s) or s.upper() == "ND":
            return s
        n = to_num(s)
        return n if n is not None else s
    return v


def read_legacy(path, only_months=None):
    """YYYYMM 이름 시트들을 읽어 (측정행 목록, 지점 메타 dict, 지점 순서, 연평균색도 목록) 반환."""
    wb = openpyxl.load_workbook(path, data_only=True)
    rows, stations, order = [], {}, []
    sheets = sorted([ws for ws in wb.worksheets if re.fullmatch(r"\d{6}", ws.title.strip())], key=lambda w: w.title)
    for ws in sheets:
        ym = f"{ws.title[:4]}-{ws.title[4:6]}"
        if only_months and ym not in only_months:
            continue
        hdr_row = None
        for r in range(1, 10):
            vals = [str(c.value).strip() if c.value else "" for c in ws[r]]
            if "시료번호" in vals:
                hdr_row, hdr = r, vals
                break
        if not hdr_row:
            print(f"[경고] {ws.title}: 헤더(시료번호)를 찾지 못해 건너뜀")
            continue
        col = {h: i for i, h in enumerate(hdr) if h}
        addr_i = col.get("주 소", col.get("주소", 3))
        river = None
        for r in ws.iter_rows(min_row=hdr_row + 1, values_only=True):
            st = r[col["시료번호"]] if len(r) > col["시료번호"] else None
            if not st:
                continue
            st = str(st).strip()
            if "하천명" in col and r[col["하천명"]]:
                river = clean_river(r[col["하천명"]])
            addr = r[addr_i]
            date = r[col["시료채취일"]] if "시료채취일" in col else None
            note = r[len(hdr) - 1] if len(r) >= len(hdr) else None
            if st not in stations:
                order.append(st)
                stations[st] = {"하천명": river, "주소": str(addr).strip() if addr else "", "비고": ""}
            if note and str(note).strip() in ("변경지점", "신규지점"):
                stations[st]["비고"] = str(note).strip()
            rec = {"조사연월": ym, "채취일": date if isinstance(date, datetime) else None, "시료번호": st,
                   "검토표시": None, "비고": None}
            for it in ITEMS:
                rec[it] = _cell_value(r[col[it]]) if it in col else None
            rows.append(rec)
    yearly = []
    if "연도별 평균색도" in wb.sheetnames:
        ws = wb["연도별 평균색도"]
        hdr = [c.value for c in ws[2]]
        years = [(i, int(h)) for i, h in enumerate(hdr) if isinstance(h, (int, float))]
        river = None
        for r in ws.iter_rows(min_row=3, values_only=True):
            if not r[2]:
                continue
            if r[1]:
                river = clean_river(r[1])
            for i, y in years:
                v = to_num(r[i])
                if v is not None:
                    yearly.append({"시료번호": str(r[2]).strip(), "하천명": river, "주소": str(r[3] or "").strip(),
                                   "연도": y, "평균색도": round(v, 2), "구간": (r[12] or "") if len(r) > 12 else ""})
    return rows, stations, order, yearly
