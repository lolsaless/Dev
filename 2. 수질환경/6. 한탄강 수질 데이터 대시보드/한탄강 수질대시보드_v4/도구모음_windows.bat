@echo off
chcp 65001 > NUL
cd /d "%~dp0"
set "PY="
python -c "import sys" >NUL 2>NUL && set "PY=python"
if not defined PY ( py -3 -c "import sys" >NUL 2>NUL && set "PY=py -3" )
title 한탄강 수질 대시보드 도구모음 v4.0
if not defined PY ( echo [오류] Python이 없습니다. python.org 에서 Python 3을 설치하세요. & pause & exit /b 1 )
%PY% -c "import openpyxl" 2> NUL || %PY% -m pip install openpyxl
:MENU
cls
echo ================================================
echo   한탄강 수질 대시보드 도구모음 (v4.0)
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
if "%SEL%"=="1" ( start "한탄강 대시보드 서버" cmd /c 대시보드_열기_windows.bat & goto MENU )
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

