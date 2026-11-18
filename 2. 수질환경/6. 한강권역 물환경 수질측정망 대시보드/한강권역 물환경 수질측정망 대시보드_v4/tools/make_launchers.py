"""
make_launchers.py — 실행 파일(Windows .bat · Mac .command)을 만들고, API 자동 갱신 예약을 등록/해제한다

사용법 (프로그램 폴더에서, Mac은 python 대신 python3)
    python tools/make_launchers.py               # 실행 파일 8개를 프로그램 폴더에 (다시) 만든다
    python tools/make_launchers.py --schedule    # + 매달 자동 갱신 예약 등록(이 컴퓨터의 OS에 맞게)
    python tools/make_launchers.py --schedule --day 15 --time 09:30
    python tools/make_launchers.py --unschedule  # 예약 해제

만드는 파일 (프로그램 폴더)
    대시보드_열기_windows.bat / _mac.command     서버로 대시보드 열기(저장·V월드·자동 빌드)
    빌드_windows.bat / 빌드_mac.command          부품 + DB + API 자료 → HTML
    수질측정망_갱신_windows.bat / _mac.command   API로 최신 자료 받기 → HTML 다시 만들기  ('auto' 인자: 예약 실행용, 멈추지 않음)
    도구모음_windows.bat / _mac.command          위 기능 + 가져오기·좌표·검사·예약 메뉴

예약(자동 갱신)
    Windows: 작업 스케줄러(schtasks)에 '한강수질측정망_API갱신' 작업 — 매달 DAY일 TIME
    Mac    : ~/Library/LaunchAgents/kr.hantan.wq.update.plist (launchd) — 매달 DAY일 TIME
    컴퓨터가 꺼져 있던 달은 건너뛴다(Mac launchd는 깨어난 뒤 한 번 실행). 결과는 수질측정망/갱신기록.txt 에 남는다.
    ※ 행정망 PC는 공공데이터포털에 접속할 수 없으므로 인터넷이 되는 PC(개발 PC)에서 예약하고, 만든 HTML을 옮긴다.

이럴 때 고침
    실행 파일 내용·메뉴 → 아래 LAUNCHERS 의 글자 / 예약 방식 → schedule_windows, schedule_mac
"""
import argparse
import os
import platform
import plistlib
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VER = (ROOT / "소스" / "버전.txt").read_text(encoding="utf-8").strip() if (ROOT / "소스" / "버전.txt").exists() else "?"
TASK = "한강수질측정망_API갱신"
PLIST = Path.home() / "Library" / "LaunchAgents" / "kr.hantan.wq.update.plist"

# ── Windows 공통 머리(파이썬 찾기) ────────────────────────────
WIN_PY = r'''@echo off
chcp 65001 > NUL
cd /d "%~dp0"
set "PY="
python -c "import sys" >NUL 2>NUL && set "PY=python"
if not defined PY ( py -3 -c "import sys" >NUL 2>NUL && set "PY=py -3" )
'''
MAC_PY = r'''#!/bin/bash
# Mac: Finder에서 더블클릭. 처음 한 번은 오른쪽 클릭 → 열기(확인되지 않은 개발자 안내가 나올 때)
cd "$(dirname "$0")"
PY=""
if command -v python3 >/dev/null 2>&1 && python3 -c "import sys" >/dev/null 2>&1; then PY="python3"; fi
ensure_openpyxl() {
  "$PY" -c "import openpyxl" 2>/dev/null || "$PY" -m pip install --user openpyxl || "$PY" -m pip install --user --break-system-packages openpyxl
}
'''

LAUNCHERS = {
    # ───────────────────────── 대시보드 열기
    "대시보드_열기_windows.bat": WIN_PY + r'''title 수질측정망 대시보드 서버 (이 창을 닫으면 저장·V월드 지도·자동 빌드가 멈춥니다)
if not defined PY (
  echo [오류] Python이 없습니다. python.org 에서 Python 3을 설치하세요(설치 화면에서 "Add python.exe to PATH" 체크).
  echo        Python 없이 보기만 하려면 한강권역_수질측정망_대시보드.html 을 Edge로 여세요.
  pause & exit /b 1
)
%PY% -c "import openpyxl" 2> NUL || %PY% -m pip install openpyxl
%PY% tools\serve.py
pause
''',
    "대시보드_열기_mac.command": MAC_PY + r'''if [ -z "$PY" ]; then
  echo "[오류] python3 가 없습니다. 터미널에서 xcode-select --install 또는 python.org 에서 Python 3 설치"
  echo "       보기만 하려면 한강권역_수질측정망_대시보드.html 을 Safari·Chrome으로 여세요."
  read -n 1 -s -r -p "아무 키나 누르면 닫힙니다"; exit 1
fi
ensure_openpyxl
echo "이 창을 닫으면 저장·V월드 지도·자동 빌드가 멈춥니다."
"$PY" tools/serve.py
''',
    # ───────────────────────── 빌드
    "빌드_windows.bat": WIN_PY + r'''title 수질측정망 대시보드 빌드
if defined PY (
  %PY% -c "import openpyxl" 2> NUL || %PY% -m pip install openpyxl
  %PY% tools\build.py %*
) else (
  echo [안내] Python이 없어 간단 빌드로 합칩니다(검사 없음, 데이터는 지난번 빌드 것).
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\build_simple.ps1
)
pause
''',
    "빌드_mac.command": MAC_PY + r'''if [ -n "$PY" ]; then
  ensure_openpyxl
  "$PY" tools/build.py "$@"
else
  echo "[안내] python3 가 없어 간단 빌드로 합칩니다(검사 없음, 데이터는 지난번 빌드 것)."
  bash tools/build_simple.sh
fi
read -n 1 -s -r -p "아무 키나 누르면 닫힙니다"; echo
''',
    # ───────────────────────── API 갱신
    "수질측정망_갱신_windows.bat": WIN_PY + r'''title 수질측정망 API 갱신 (한강유역환경청 · 7개 항목)
rem 사용: 더블클릭 = 최신 자료 받기(올해·작년·빠진 연도) → HTML 다시 만들기
rem       수질측정망_갱신_windows.bat auto  = 예약 실행용(끝나도 멈추지 않음, 기록은 수질측정망\갱신기록.txt)
set "AUTO="
if /i "%~1"=="auto" set "AUTO=--auto"
if not defined PY ( echo [오류] Python이 없습니다. & if not defined AUTO pause & exit /b 1 )
%PY% tools\api_update.py %AUTO%
if errorlevel 1 ( echo [실패] 자료 받기에 실패했습니다. 인터넷 연결과 수질측정망\물환경.env 인증키를 확인하세요. & if not defined AUTO pause & exit /b 1 )
%PY% -c "import openpyxl" 2> NUL || %PY% -m pip install openpyxl
%PY% tools\build.py
if not defined AUTO pause
''',
    "수질측정망_갱신_mac.command": MAC_PY + r'''# 사용: 더블클릭 = 최신 자료 받기(올해·작년·빠진 연도) → HTML 다시 만들기
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
''',
    # ───────────────────────── 도구모음
    "도구모음_windows.bat": WIN_PY + r'''title 수질측정망 대시보드 도구모음 v{VER}
if not defined PY ( echo [오류] Python이 없습니다. python.org 에서 Python 3을 설치하세요. & pause & exit /b 1 )
%PY% -c "import openpyxl" 2> NUL || %PY% -m pip install openpyxl
:MENU
cls
echo ================================================
echo   수질측정망 대시보드 도구모음 (v{VER})
echo ================================================
echo   1. 대시보드 열기 (권장: 저장·V월드 지도·자동 빌드)
echo   2. 빌드 (부품 + 설정 + API 자료 → HTML)
echo   3. 공유용 HTML 만들기 (V월드 키 제외)
echo   4. 자동 빌드 (부품을 저장할 때마다 다시 빌드, Ctrl+C로 멈춤)
echo   5. 검사만 (부품 이름 중복·문법 등)
echo   6. 수질측정망 최신 자료 받기(API) → 빌드   [모든 조사기관]
echo   7. API 인증키 연결 시험
echo   8. 자동 갱신 예약 등록 (매달 15일 09:30)
echo   9. 자동 갱신 예약 해제
echo   0. 끝내기
echo ------------------------------------------------
set "SEL="
set /p SEL=번호를 입력하세요:
if "%SEL%"=="1" ( start "수질측정망 대시보드 서버" cmd /c 대시보드_열기_windows.bat & goto MENU )
if "%SEL%"=="2" ( %PY% tools\build.py & pause & goto MENU )
if "%SEL%"=="3" ( %PY% tools\build.py --no-key & pause & goto MENU )
if "%SEL%"=="4" ( %PY% tools\build.py --watch & goto MENU )
if "%SEL%"=="5" ( %PY% tools\build.py --check & pause & goto MENU )
if "%SEL%"=="6" ( call 수질측정망_갱신_windows.bat & goto MENU )
if "%SEL%"=="7" ( %PY% tools\api_update.py --check-key & pause & goto MENU )
if "%SEL%"=="8" ( %PY% tools\make_launchers.py --schedule & pause & goto MENU )
if "%SEL%"=="9" ( %PY% tools\make_launchers.py --unschedule & pause & goto MENU )
if "%SEL%"=="0" exit /b
goto MENU

''',
    "도구모음_mac.command": MAC_PY + r'''[ -z "$PY" ] && { echo "[오류] python3 가 없습니다."; read -n 1 -s -r; exit 1; }
ensure_openpyxl
pause() { read -n 1 -s -r -p "아무 키나 누르면 메뉴로 돌아갑니다"; echo; }
while true; do
  clear
  echo "================================================"
  echo "  수질측정망 대시보드 도구모음 (v{VER})"
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
''',
}


def write_launchers():
    for name, text in LAUNCHERS.items():
        if name.startswith("도구모음"):
            text = text.replace("{VER}", VER)
        p = ROOT / name
        if name.endswith(".bat"):
            p.write_bytes(text.replace("\r\n", "\n").replace("\n", "\r\n").encode("utf-8"))   # cmd 는 CRLF가 안전
        else:
            p.write_bytes(text.replace("\r\n", "\n").encode("utf-8"))
            p.chmod(0o755)                                                                  # Mac 더블클릭 실행 권한
        print(f"  만듦: {name}")


# ── 예약 ────────────────────────────────────────────────
def schedule_windows(day, hhmm, on=True):
    if on:
        bat = ROOT / "수질측정망_갱신_windows.bat"
        cmd = ["schtasks", "/Create", "/F", "/SC", "MONTHLY", "/D", str(day), "/ST", hhmm, "/TN", TASK,
               "/TR", f'cmd /c ""{bat}" auto"']
    else:
        cmd = ["schtasks", "/Delete", "/F", "/TN", TASK]
    r = subprocess.run(cmd, capture_output=True, text=True)
    print((r.stdout or r.stderr).strip())
    return r.returncode


def schedule_mac(day, hhmm, on=True):
    uid = os.getuid()
    if PLIST.exists():
        subprocess.run(["launchctl", "bootout", f"gui/{uid}", str(PLIST)], capture_output=True)
    if not on:
        if PLIST.exists():
            PLIST.unlink()
        print("예약을 해제했습니다.")
        return 0
    h, m = (int(x) for x in hhmm.split(":"))
    PLIST.parent.mkdir(parents=True, exist_ok=True)
    with open(PLIST, "wb") as f:
        plistlib.dump({"Label": "kr.hantan.wq.update",
                       "ProgramArguments": ["/bin/bash", str(ROOT / "수질측정망_갱신_mac.command"), "auto"],
                       "WorkingDirectory": str(ROOT),
                       "StartCalendarInterval": {"Day": day, "Hour": h, "Minute": m},
                       "StandardOutPath": str(ROOT / "수질측정망" / "예약실행_출력.txt"),
                       "StandardErrorPath": str(ROOT / "수질측정망" / "예약실행_출력.txt")}, f)
    r = subprocess.run(["launchctl", "bootstrap", f"gui/{uid}", str(PLIST)], capture_output=True, text=True)
    print(f"예약 등록: 매달 {day}일 {hhmm} → {PLIST}" if r.returncode == 0 else f"[오류] {r.stderr.strip()}")
    print("※ 문서·데스크탑 폴더 안이면 처음 실행 때 '폴더 접근 허용' 창이 뜰 수 있습니다(시스템 설정 > 개인정보 보호 > 파일 및 폴더).")
    return r.returncode


def main():
    ap = argparse.ArgumentParser(description="실행 파일 만들기·자동 갱신 예약")
    ap.add_argument("--schedule", action="store_true", help="매달 자동 갱신 예약 등록")
    ap.add_argument("--unschedule", action="store_true", help="예약 해제")
    ap.add_argument("--day", type=int, default=15, help="매달 며칠(1~28, 기본 15)")
    ap.add_argument("--time", default="09:30", help="시각 HH:MM (기본 09:30)")
    a = ap.parse_args()
    print(f"[실행 파일 만들기] {ROOT.name}")
    write_launchers()
    if a.schedule or a.unschedule:
        on = bool(a.schedule)
        sysname = platform.system()
        if sysname == "Windows":
            return schedule_windows(a.day, a.time, on)
        if sysname == "Darwin":
            return schedule_mac(a.day, a.time, on)
        print(f"[안내] {sysname} 은 예약 등록을 지원하지 않습니다(cron에 '수질측정망_갱신_mac.command auto' 를 등록하세요).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
