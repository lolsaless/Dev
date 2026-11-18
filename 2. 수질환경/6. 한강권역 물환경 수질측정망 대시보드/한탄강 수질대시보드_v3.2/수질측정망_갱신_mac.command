#!/bin/bash
# Mac: Finder에서 더블클릭. 처음 한 번은 오른쪽 클릭 → 열기(확인되지 않은 개발자 안내가 나올 때)
cd "$(dirname "$0")"
PY=""
if command -v python3 >/dev/null 2>&1 && python3 -c "import sys" >/dev/null 2>&1; then PY="python3"; fi
ensure_openpyxl() {
  "$PY" -c "import openpyxl" 2>/dev/null || "$PY" -m pip install --user openpyxl || "$PY" -m pip install --user --break-system-packages openpyxl
}
# 사용: 더블클릭 = 최신 자료 받기(올해·작년·빠진 연도) → HTML 다시 만들기
#       bash 수질측정망_갱신_mac.command auto  = 예약 실행용(기다리지 않음, 기록은 수질측정망/갱신기록.txt)
AUTO=""; [ "$1" = "auto" ] && AUTO="--auto"
wait_key() { [ -z "$AUTO" ] && read -n 1 -s -r -p "아무 키나 누르면 닫힙니다"; echo; }
[ -z "$PY" ] && { echo "[오류] python3 가 없습니다."; wait_key; exit 1; }
if ! "$PY" tools/api_update.py $AUTO; then
  echo "[실패] 자료 받기에 실패했습니다. 인터넷 연결과 수질측정망/물환경.env 인증키를 확인하세요."; wait_key; exit 1
fi
ensure_openpyxl
"$PY" tools/build.py
wait_key
