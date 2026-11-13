# matrix_face

VSCode 화면에서 코드가 매트릭스처럼 타이핑되고, 문자 비가 훑고 지나가며 얼굴 이미지가 생성되는 배경화면 프로그램.
Notion 디자인 규칙 기반 · 순수 HTML/CSS/JS · 외부 라이브러리 없음.

## 실행
- 분리 버전: `index.html` 을 브라우저로 열기 (css/·js/ 폴더가 같은 위치에 있어야 함)
- 단일 파일: `python build.py` → `matrix_face.html` 생성 (파일 하나로 어디서든 실행)

## 조작
- 좌측 하단 슬라이더 아이콘 또는 상태바 `◐ 테마` → 화면 설정 (모드·프리셋·색상)
- `D` 다크/라이트 전환 · `Esc` 설정 닫기 · 더블클릭 전체화면

## 파일 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 화면 뼈대(HTML)와 모듈 로드 순서 |
| `css/tokens.css` | 색·글꼴 토큰, 라이트/다크 팔레트 |
| `css/layout.css` | 타이틀바·액티비티바·사이드바·상태바 |
| `css/editor.css` | 탭·코드 영역·구문 강조 색 |
| `css/pane.css` | 얼굴 프리뷰 영역·터미널 패널 |
| `css/settings.css` | 설정 팝오버 |
| `js/00-util.js` | 난수·이징·색 계산, 공유 상태(`MF.state`), 단계 길이(`MF.DUR`) |
| `js/10-highlight.js` | 파이썬 구문 강조 |
| `js/11-script-text.js` | 화면에 타이핑될 코드 내용 |
| `js/20-editor.js` | 타이핑 효과·줄 스크롤·커서 |
| `js/30-terminal.js` | 터미널 로그·진행률 막대 |
| `js/40-face-shape.js` | 얼굴 모양 수학 모델(눈·코·입·머리카락) |
| `js/41-face-canvas.js` | canvas 그리기, 문자 비, 색 팔레트(atlas) |
| `js/50-sequence.js` | 생성→유지→녹음 단계 진행, 로그 시점, UI 갱신 |
| `js/60-theme.js` | 다크모드·색상 설정, 설정 저장 |
| `js/90-main.js` | 초기화, 메인 루프(≈20fps), 전체화면·커서 숨김 |
| `build.py` | 분리 파일을 단일 HTML 로 합치는 스크립트 |

## 자주 바꾸는 곳
- 타이핑되는 코드 → `js/11-script-text.js`
- 단계별 시간(생성 13초 등) → `js/00-util.js` 의 `MF.DUR`
- 색 프리셋 추가 → `js/60-theme.js` 의 `PRESETS`
- 얼굴 생김새 → `js/40-face-shape.js`
- 글자 크기·칸 간격 → `js/41-face-canvas.js` 의 `CW`, `CH`
- 프레임 속도 → `js/90-main.js` 의 `MIN_DT`
