/* ============================================================
   11-script-text.js — 에디터에 타이핑될 파이썬 코드 내용
   보여줄 코드를 바꾸고 싶으면 이 파일의 배열만 수정하면 된다
   ============================================================ */
(function(M){
  M.scriptLines=function(){
    const S=M.state;
    return [
'import numpy as np',
'from matrix_rain import Rain, glyphs',
'from landmarks import Mesh',
'',
'SEED = '+S.seed,
'GRID = ('+S.cols+', '+S.rows+')            # cols x rows',
'RAMP = " .:-=+/{}10#%@"          # dark -> bright',
'',
'def build_face(seed: int) -> np.ndarray:',
'    rng = np.random.default_rng(seed)',
'    width   = rng.uniform(0.54, 0.68)',
'    eye_gap = rng.uniform(0.21, 0.31)',
'    smile   = rng.uniform(-0.015, 0.06)',
'    hair    = rng.choice(["short", "bob", "long"])',
'    mesh = Mesh(width, eye_gap, smile, hair)',
'    return mesh.rasterize(GRID)',
'',
'def to_glyph(v: float) -> str:',
'    idx = int(v * (len(RAMP) - 1))',
'    return RAMP[idx]',
'',
'def render(face, rain):',
'    for y, row in enumerate(face):',
'        for x, v in enumerate(row):',
'            if rain.passed(x, y) and v > 0.06:',
'                yield x, y, to_glyph(v)',
'',
'def main():',
'    face = build_face(SEED)',
'    for frame in Rain(GRID, fps=20):',
'        for x, y, ch in render(face, frame):',
'            frame.put(x, y, ch)',
'        frame.flush()',
'',
'if __name__ == "__main__":',
'    main()'
    ];
  };
})(window.MF);
