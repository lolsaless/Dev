#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""장비관리대장 생성기 (Python 판) 실행 파일.
   이 파일과 같은 폴더에 eqledger/ 폴더가 있어야 한다.
   설치: pip install -r requirements.txt
   실행: python 장비관리대장_생성기.py            (창)
         python 장비관리대장_생성기.py --help     (명령행 옵션)"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from eqledger.cli import main  # noqa: E402

if __name__ == '__main__':
    main()
