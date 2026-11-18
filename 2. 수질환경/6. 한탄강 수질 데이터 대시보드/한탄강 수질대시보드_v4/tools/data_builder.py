"""
data_builder.py — 설정 엑셀(한탄강_설정.xlsx) + 수질측정망 API 자료 → 대시보드 데이터(D)

하는 일
- 설정 엑셀에서 항목정보·기준값·설정을 읽는다(v4부터 측정값은 넣지 않음).
- 측정값·지점·자료 점검은 tools/api_data.py 가 수질측정망/수질측정망_자료.csv 로 만든다(D.api, D.groups).
- HTML 조립은 하지 않는다(tools/build.py 가 담당).

이럴 때 고침
- 설정 시트에 새 설정을 추가해 화면에서 쓰고 싶을 때 → 아래 "settings" 사전 + 20_공통/00_설정값.js
- 자동 점검 규칙 → tools/api_data.py 의 '자료 점검'
"""
import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import wq_common as W  # noqa: E402
import api_data  # noqa: E402


class NoApiData(W.DBLocked):
    """수질측정망 자료가 없어 만들 수 없음(빌드 오류로 표시)"""


def build_data(db_path):
    db = W.read_db(db_path)
    cfg = W.settings_dict(db)
    warns = []

    items = [{"code": str(r["항목"]).strip(), "name": r.get("표시명") or r["항목"], "unit": r.get("단위") or "",
              "dec": int(W.to_num(r.get("소수자리"))) if W.to_num(r.get("소수자리")) is not None else 2,
              "desc": r.get("설명") or ""} for r in db["items"] if r.get("항목")]
    limits, target = defaultdict(list), {}
    for r in db["limits"]:
        it = str(r.get("항목") or "").strip()
        if not it:
            continue
        if r.get("구분") == "목표":
            target[it] = W.to_num(r.get("상한값"))
        else:
            limits[it].append({"code": r.get("등급코드"), "name": r.get("등급명"), "max": W.to_num(r.get("상한값"))})

    api, groups, aw = api_data.build_api(cfg)
    warns.extend(aw)
    if not api:
        raise NoApiData("수질측정망 자료(수질측정망/수질측정망_자료.csv)가 없습니다. "
                        "'수질측정망_갱신'을 먼저 실행하세요.")

    data = {
        "title": "한탄강 수계 수질 대시보드",
        "generated": datetime.now().strftime("%Y-%m-%d %H:%M"), "source": api["source"],
        "items": items, "limits": limits, "target": target,
        # 아래 6개는 화면이 열릴 때 고른 묶음(조사기관)으로 채운다(20_공통/00_자료묶음.js)
        "stations": [], "months": [], "values": {}, "dates": {}, "loq": {}, "qc": [],
        "yearly": {}, "yearlyInfo": {},
        "api": api, "groups": groups,
        "settings": {
            "vworldKey": str(cfg.get("VWORLD_KEY") or "").strip(),
            "basemap": str(cfg.get("기본배경지도") or "자동"),
            "item": str(cfg.get("기본항목") or "색도"),
            "band": {"표준편차": "sd", "퍼센트": "pct", "전체": "all"}.get(str(cfg.get("평균대비_판정")), "sd"),
            "k": float(W.to_num(cfg.get("평균대비_k")) or 1), "p": float(W.to_num(cfg.get("평균대비_p")) or 30),
            "loqMode": str(cfg.get("정량한계_처리") or "한계값"),
            "spike": float(W.to_num(cfg.get("특이경향_기준")) or 8),
        },
        # 설정 화면에 보여 줄 설정 시트 전체(이름·값·설명·선택지)
        "settingsRaw": [{"key": k, "value": cfg.get(k, dv), "desc": d, "choices": ch} for k, dv, d, ch in W.SETTINGS],
    }
    return data, warns


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="설정 + API 자료 → 대시보드 데이터(JSON) 확인용")
    ap.add_argument("db", nargs="?", default=str(W.DEFAULT_DB))
    a = ap.parse_args()
    d, w = build_data(a.db)
    for x in w:
        print("[확인]", x)
    print(json.dumps({k: (len(v) if hasattr(v, "__len__") else v) for k, v in d.items()}, ensure_ascii=False, indent=1))
    for g in d["groups"]:
        print(f"  {g['label']}: {g['n']}개")
