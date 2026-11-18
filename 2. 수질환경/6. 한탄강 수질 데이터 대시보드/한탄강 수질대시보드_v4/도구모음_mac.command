#!/bin/bash
# Mac: Finder에서 더블클릭. 처음 한 번은 오른쪽 클릭 → 열기(확인되지 않은 개발자 안내가 나올 때)
cd "$(dirname "$0")"
PY=""
if command -v python3 >/dev/null 2>&1 && python3 -c "import sys" >/dev/null 2>&1; then PY="python3"; fi
ensure_openpyxl() {
  "$PY" -c "import openpyxl" 2>/dev/null || "$PY" -m pip install --user openpyxl || "$PY" -m pip install --user --break-system-packages openpyxl
}
[ -z "$PY" ] && { echo "[오류] python3 가 없습니다."; read -n 1 -s -r; exit 1; }
ensure_openpyxl
pause() { read -n 1 -s -r -p "아무 키나 누르면 메뉴로 돌아갑니다"; echo; }
while true; do
  clear
  echo "================================================"
  echo "  한탄강 수질 대시보드 도구모음 (v4.0)"
  echo "================================================"
  echo "  1. 대시보드 열기 (권장: 저장·V월드 지도·자동 빌드)"
  echo "  2. 빌드 (부품 + 설정 + API 자료 → HTML)"
  echo "  3. 공유용 HTML 만들기 (V월드 키 제외)"
  echo "  4. 자동 빌드 (부품을 저장할 때마다 다시 빌드, Ctrl+C로 멈춤)"
  echo "  5. 검사만 (부품 이름 중복·문법 등)"
  echo "  6. 수질측정망 최신 자료 받기(API) → 빌드   [모든 조사기관]"
  echo "  7. API 인증키 연결 시험"
  echo "  8. 자동 갱신 예약 등록 (매달 15일 09:30)"
  echo "  9. 자동 갱신 예약 해제"
  echo "  0. 끝내기"
  echo "------------------------------------------------"
  read -r -p "번호를 입력하세요: " SEL
  case "$SEL" in
    1) open -a Terminal "$(pwd)/대시보드_열기_mac.command" ;;
    2) "$PY" tools/build.py; pause ;;
    3) "$PY" tools/build.py --no-key; pause ;;
    4) "$PY" tools/build.py --watch ;;
    5) "$PY" tools/build.py --check; pause ;;
    6) "$PY" tools/api_update.py && "$PY" tools/build.py; pause ;;
    7) "$PY" tools/api_update.py --check-key; pause ;;
    8) "$PY" tools/make_launchers.py --schedule; pause ;;
    9) "$PY" tools/make_launchers.py --unschedule; pause ;;
    0) exit 0 ;;
  esac
done
