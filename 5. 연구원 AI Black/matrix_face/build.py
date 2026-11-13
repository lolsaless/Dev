"""build.py — 분리된 css/js 를 index.html 하나로 합쳐 단일 파일(matrix_face.html)을 만든다.
사용법:  python build.py            → ./matrix_face.html 생성
"""
import re
from pathlib import Path

root = Path(__file__).resolve().parent
html = (root / "index.html").read_text(encoding="utf-8")

def inline_css(m):
    css = (root / m.group(1)).read_text(encoding="utf-8")
    return f"<style>\n/* ---- {m.group(1)} ---- */\n{css}</style>"

def inline_js(m):
    js = (root / m.group(1)).read_text(encoding="utf-8")
    return f"<script>\n/* ---- {m.group(1)} ---- */\n{js}</script>"

html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)
html = re.sub(r'<script src="([^"]+)"></script>', inline_js, html)

out = root / "matrix_face.html"
out.write_text(html, encoding="utf-8")
print(f"생성 완료: {out} ({out.stat().st_size/1024:.1f} KB)")
