@echo off
chcp 65001 > NUL
cd /d "%~dp0"
set "PY="
python -c "import sys" >NUL 2>NUL && set "PY=python"
if not defined PY ( py -3 -c "import sys" >NUL 2>NUL && set "PY=py -3" )
title 한탄강 수질 대시보드 도구모음 v3.2
if not defined PY ( echo [오류] Python이 없습니다. python.org 에서 Python 3을 설치하세요. & pause & exit /b 1 )
%PY% -c "import openpyxl" 2> NUL || %PY% -m pip install openpyxl
:MENU
cls
echo ================================================
echo   한탄강 수질 대시보드 도구모음 (v3.2)
echo ================================================
echo   1. 대시보드 열기 (권장: 저장·V월드 지도·자동 빌드)
echo   2. 월별 결과 엑셀 가져오기 (YYYYMM 시트, 연구원 관리)
echo   3. V월드로 좌표 일괄 검색 ('추정' 좌표만)
echo   4. 빌드 (부품 + DB + API 자료 → HTML)
echo   5. 공유용 HTML 만들기 (V월드 키 제외)
echo   6. 자동 빌드 (부품을 저장할 때마다 다시 빌드, Ctrl+C로 멈춤)
echo   7. 검사만 (부품 이름 중복·문법 등)
echo   8. 기존 월별 엑셀 전체를 DB로 다시 변환
echo   9. 수질측정망 최신 자료 받기(API) → 빌드   [연구원·유역청]
echo  10. API 인증키 연결 시험
echo  11. 자동 갱신 예약 등록 (매달 15일 09:30)
echo  12. 자동 갱신 예약 해제
echo   0. 끝내기
echo ------------------------------------------------
set "SEL="
set /p SEL=번호를 입력하세요:
if "%SEL%"=="1" ( start "한탄강 대시보드 서버" cmd /c 대시보드_열기_windows.bat & goto MENU )
if "%SEL%"=="2" goto IMPORT
if "%SEL%"=="3" goto VW
if "%SEL%"=="4" ( %PY% tools\build.py & pause & goto MENU )
if "%SEL%"=="5" ( %PY% tools\build.py --no-key & pause & goto MENU )
if "%SEL%"=="6" ( %PY% tools\build.py --watch & goto MENU )
if "%SEL%"=="7" ( %PY% tools\build.py --check & pause & goto MENU )
if "%SEL%"=="8" goto LEGACY
if "%SEL%"=="9" ( call 수질측정망_갱신_windows.bat & goto MENU )
if "%SEL%"=="10" ( %PY% tools\api_update.py --check-key & pause & goto MENU )
if "%SEL%"=="11" ( %PY% tools\make_launchers.py --schedule & pause & goto MENU )
if "%SEL%"=="12" ( %PY% tools\make_launchers.py --unschedule & pause & goto MENU )
if "%SEL%"=="0" exit /b
goto MENU

:IMPORT
set /p F=가져올 결과 엑셀을 이 창에 끌어다 놓고 Enter:
%PY% tools\import_month.py %F%
echo 서버(1번)가 켜져 있으면 브라우저에서 새로고침(F5)만 하면 반영됩니다.
pause
goto MENU

:VW
echo [1/2] 미리보기(저장하지 않음)...
%PY% tools\coords_tool.py --dry
set /p OK=위 결과를 DB에 저장할까요? (Y/N):
if /i "%OK%"=="Y" %PY% tools\coords_tool.py
pause
goto MENU

:LEGACY
set /p F=기존 월별 시트 형식 엑셀을 끌어다 놓고 Enter:
%PY% tools\convert_legacy.py %F%
pause
goto MENU
