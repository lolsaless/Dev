@echo off
chcp 65001 > NUL
cd /d "%~dp0"
set "PY="
python -c "import sys" >NUL 2>NUL && set "PY=python"
if not defined PY ( py -3 -c "import sys" >NUL 2>NUL && set "PY=py -3" )
title 수질측정망 API 갱신 (한강유역환경청 · 7개 항목)
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
