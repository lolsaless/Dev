"""
serve.py — 대시보드 로컬 서버 (설정·종단순서 저장, 배경지도, 자동 빌드)

사용법 (보통은 대시보드_열기_windows.bat / 대시보드_열기_mac.command 로 실행)
    python tools/serve.py            # 대시보드를 새로 만들고 http://localhost:8765 로 열기
    python tools/serve.py --no-open  # 브라우저 자동 열기 안 함
    python tools/serve.py --port 8800

이 서버로 열면
- '설정' 화면에서 고친 V월드 키·판정 기준 등이 수질측정망_설정.xlsx(설정 시트)에 저장된다(저장 전 '백업' 폴더에 복사).
- 상·하류 종단 [✎ 종단 편집]에서 정한 지점·순서가 수질측정망_설정.xlsx(종단순서 시트)에 저장된다.
- 소스/ 부품을 고치고 브라우저에서 새로고침하면 자동으로 다시 빌드한다(빌드 오류면 이전 화면 유지, 이 창에 오류 표시).
- 설정 엑셀을 고치거나 수질측정망 자료를 갱신한 뒤 브라우저에서 새로고침하면 대시보드를 자동으로 다시 만든다.
- V월드 배경지도가 http://localhost:8765 주소로 요청된다(인증키 서비스 URL에 이 주소를 등록).
보안: 이 PC(127.0.0.1)에서만 접속되며, 다른 사이트에서 보낸 저장 요청은 거절한다.
"""
import argparse
import http.server
import importlib.util
import json
import socketserver
import sys
import threading
import traceback
import webbrowser
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import wq_common as W  # noqa: E402
HERE = W.ROOT   # 웹으로 내보내는 폴더 = 프로그램 폴더


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, TOOLS / file)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


BUILD = _load("build", "build.py")
PORT = 8765
HTML_NAME = W.HTML_NAME
LOCK = threading.Lock()


_BUILT = {"mtime": 0}


def _inputs_mtime():
    api = W.ROOT / "수질측정망" / "수질측정망_자료.csv"     # v3.2: API 자료가 갱신되면 다시 빌드
    return max(BUILD.src_mtime(), W.DEFAULT_DB.stat().st_mtime if W.DEFAULT_DB.exists() else 0,
               api.stat().st_mtime if api.exists() else 0)


def rebuild():
    """빌드 1회. 실패하면 이전 HTML을 그대로 두고 오류를 알린다."""
    _BUILT["mtime"] = _inputs_mtime()
    ok, out, errs, warns = BUILD.build(quiet=True)
    for w in warns:
        if "Node.js" not in w:
            print("[주의]", w)
    if ok:
        print(f"[대시보드] {out.name} 다시 만듦")
    else:
        for e in errs:
            print("[빌드 오류]", e)
        print("[빌드 오류] 이전 화면을 그대로 씁니다. 부품을 고치고 새로고침하세요.")
    return ok, errs


def apply_settings(values):
    """values = {설정 이름: 값} → 설정 시트에 반영 (알려진 설정만)"""
    known = {k: (dv, ch) for k, dv, _, ch in W.SETTINGS}
    with LOCK:
        db = W.read_db(W.DEFAULT_DB)
        rows = {r["설정"]: r for r in db["settings"]}
        changed = []
        for k, v in values.items():
            if k not in known:
                continue
            dv, ch = known[k]
            v = "" if v is None else str(v).strip()
            if ch and v not in ch:
                raise ValueError(f"{k}: '{v}' 는 선택지({', '.join(ch)})에 없습니다")
            if isinstance(dv, (int, float)) and not isinstance(dv, bool):
                try:
                    v = float(v)
                    v = int(v) if v.is_integer() else v
                except ValueError:
                    raise ValueError(f"{k}: 숫자를 넣어야 합니다('{v}')")
            if k not in rows:
                rows[k] = {"설정": k, "값": v, "설명": next(d for kk, _, d, _ in W.SETTINGS if kk == k)}
                db["settings"].append(rows[k])
            rows[k]["값"] = v
            changed.append(k)
        W.write_db(W.DEFAULT_DB, db)
        rebuild()
        return changed


def apply_profile(river, codes, names):
    """v4: 상·하류 종단 지점 순서 → 설정 파일 '종단순서' 시트(그 중권역 행을 통째로 바꿈, 빈 목록 = 기본 순서로)"""
    if not river:
        raise ValueError("중권역 이름이 없습니다")
    with LOCK:
        db = W.read_db(W.DEFAULT_DB)
        db["prof"] = [r for r in db["prof"] if r.get("관리구분") or str(r.get("중권역") or "").strip() != river]
        for i, c in enumerate(codes, 1):
            db["prof"].append({"중권역": river, "순서": i, "지점코드": str(c), "지점명": names[i - 1] if i - 1 < len(names) else ""})
        W.write_db(W.DEFAULT_DB, db)
        rebuild()
        return len(codes)


def apply_branches(scope, river, branches, names):
    if not scope or not river or not isinstance(branches, list):
        raise ValueError("관리 구분·중권역·흐름 그룹을 확인하세요")
    by_name = {}
    for group in branches:
        name = group["name"]
        codes = group["codes"]
        if not isinstance(name, str) or not name or len(name) > 60 or name in by_name:
            raise ValueError("그룹 이름이 비어 있거나 중복됩니다")
        if not isinstance(codes, list) or not codes or not all(isinstance(c, str) and c for c in codes) or len(set(codes)) != len(codes):
            raise ValueError("그룹마다 서로 다른 지점이 필요합니다")
        by_name[name] = group
    for start in by_name:
        seen = set()
        name = start
        previous = None
        path_codes = set()
        while name:
            if name in seen or name not in by_name:
                raise ValueError("하류 연결을 확인하세요. 순환 연결은 저장할 수 없습니다")
            seen.add(name)
            group = by_name[name]
            codes = group["codes"]
            part = codes[codes.index(previous) + 1:] if previous in codes else codes
            if path_codes.intersection(part):
                raise ValueError("한 흐름에서 지점이 반복됩니다")
            path_codes.update(part)
            previous = codes[-1]
            name = group["next"]
    rows = [
        {"관리구분": scope, "중권역": river, "흐름그룹": group["name"], "하류그룹": group["next"],
         "순서": i, "지점코드": code, "지점명": names.get(code, "")}
        for group in branches for i, code in enumerate(group["codes"], 1)
    ]
    if not rows:
        rows = [{"관리구분": scope, "중권역": river}]
    with LOCK:
        db = W.read_db(W.DEFAULT_DB)
        db["prof"] = [row for row in db["prof"] if (
            str(row.get("관리구분") or "").strip(), str(row.get("중권역") or "").strip()
        ) != (scope, river)] + rows
        W.write_db(W.DEFAULT_DB, db)
        rebuild()
    return len(rows)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(HERE), **kw)

    def log_message(self, fmt, *args):  # 조용히: API 요청만 출력
        if "/api/" in (self.path or ""):
            sys.stderr.write("[요청] %s\n" % (fmt % args))

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _same_origin(self):
        host = (self.headers.get("Host") or "").split(":")[0]
        origin = self.headers.get("Origin")
        ok_hosts = ("localhost", "127.0.0.1")
        if host not in ok_hosts:
            return False
        if origin and not any(origin == f"http://{h}:{PORT}" for h in ok_hosts):
            return False
        return True

    def end_headers(self):
        if self.path.endswith(".html") or self.path in ("/", ""):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self.send_response(302)
            self.send_header("Location", "/" + HTML_NAME)
            self.end_headers()
            return
        if self.path.startswith("/api/ping"):
            return self._json(200, {"ok": True, "server": True, "db": W.DEFAULT_DB.name})
        if self.path.split("?")[0].endswith(".html"):
            # DB 엑셀·소스 부품이 바뀌었으면 새로고침할 때 자동으로 다시 만든다
            try:
                if _inputs_mtime() > _BUILT["mtime"] + 0.5:
                    with LOCK:
                        rebuild()
            except Exception as e:  # noqa: BLE001
                print("[오류] 다시 만들기 실패:", e)
        if self.path.split("?")[0].endswith((".py", ".xlsx", ".bat", ".command", ".csv", ".js", ".txt", ".md")) or "/소스/" in self.path or "%EC%86%8C%EC%8A%A4" in self.path:
            return self._json(403, {"ok": False, "error": "이 파일은 내려받을 수 없습니다"})
        return super().do_GET()

    def do_POST(self):
        if not self._same_origin():
            return self._json(403, {"ok": False, "error": "다른 사이트에서 보낸 요청은 거절합니다"})
        try:
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n).decode("utf-8") or "{}")
        except Exception:  # noqa: BLE001
            return self._json(400, {"ok": False, "error": "요청 형식 오류"})
        try:
            if self.path.startswith("/api/profile"):
                river = str(body.get("river") or "").strip()
                if "branches" in body:
                    n_saved = apply_branches(str(body.get("scope") or "").strip(), river, body["branches"], body.get("names") or {})
                else:
                    n_saved = apply_profile(river, body.get("codes") or [], body.get("names") or [])
                return self._json(200, {"ok": True, "n": n_saved})
            if self.path.startswith("/api/settings"):
                changed = apply_settings(body.get("values") or {})
                return self._json(200, {"ok": True, "changed": changed})
            if self.path.startswith("/api/rebuild"):
                with LOCK:
                    rebuild()
                return self._json(200, {"ok": True})
            return self._json(404, {"ok": False, "error": "없는 주소"})
        except W.DBLocked as e:
            return self._json(200, {"ok": False, "error": str(e)})
        except ValueError as e:
            return self._json(200, {"ok": False, "error": str(e)})
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            return self._json(500, {"ok": False, "error": f"서버 오류: {e}"})


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-open", action="store_true")
    ap.add_argument("--port", type=int, default=PORT)
    a = ap.parse_args()
    globals()["PORT"] = a.port
    rebuild()
    try:
        srv = Server(("127.0.0.1", a.port), Handler)
    except OSError:
        import urllib.request
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{a.port}/api/ping", timeout=3) as r:
                ok = json.loads(r.read().decode("utf-8")).get("server")
        except Exception:  # noqa: BLE001
            ok = False
        if ok:
            print(f"[안내] 대시보드 서버가 이미 켜져 있습니다. 브라우저만 엽니다.")
            if not a.no_open:
                webbrowser.open(f"http://localhost:{a.port}/{HTML_NAME}")
        else:
            print(f"[오류] {a.port} 포트를 다른 프로그램(예: 이전 버전 서버 창)이 쓰고 있습니다. 그 창을 닫고 다시 실행하세요.")
            input("Enter를 누르면 닫힙니다...")
        return
    url = f"http://localhost:{a.port}/{HTML_NAME}"
    print(f"[서버] {url}\n  이 창을 닫으면 저장·V월드 검색·배경지도가 멈춥니다. (끝내기: Ctrl+C)")
    if not a.no_open:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n[서버] 종료")


if __name__ == "__main__":
    main()
