"""[부품 P8] 창(tkinter) — 엑셀·사진 폴더 고르기, 시트 선택, 대상 표, 실행"""
import os
import queue
import threading
import tkinter as tk
from datetime import datetime
from tkinter import filedialog, messagebox, ttk

from . import VERSION
from .config import FORM
from .excel_reader import open_book
from .generate import generate
from .images import HAVE_HEIF, find, scan
from .text_fit import fit


def run_gui():
    root = tk.Tk()
    root.title('장비관리대장 생성기 v' + VERSION)
    root.geometry('1040x800')
    st = dict(book=None, records=[], index=[], sheet_vars={})
    q = queue.Queue()
    v = {k: tk.StringVar() for k in ('xlsx', 'img', 'comp', 'mode', 'date', 'limit', 'target')}
    v['mode'].set('하나의 Word 파일'); v['date'].set('dot'); v['limit'].set('1024'); v['target'].set('300')
    v_cat = tk.BooleanVar(value=True)
    pad = dict(padx=6, pady=3)
    f = ttk.Frame(root, padding=10); f.pack(fill='both', expand=True)
    f.columnconfigure(1, weight=1)

    def log(m):
        q.put(('log', m))

    def entry_row(r, label, var, cmd):
        ttk.Label(f, text=label).grid(row=r, column=0, sticky='w', **pad)
        ttk.Entry(f, textvariable=var).grid(row=r, column=1, sticky='ew', **pad)
        ttk.Button(f, text='찾아보기', command=cmd).grid(row=r, column=2, **pad)

    def note_hint(r):
        N = FORM['note']
        if not r['note']:
            return '-'
        x = fit(r['note'], N['w'], N['h'] - N['labelH'], N['max'], N['min'])
        return ('%gpt' % x['size']) if x['fits'] else '넘침 위험'

    def refresh():
        tree.delete(*tree.get_children())
        for i, r in enumerate(st['records']):
            e = find(r, st['index'])[0] if st['index'] else None
            tree.insert('', 'end', iid=str(i), values=(r['sheet'], r['seq'], r['id'], r['name'],
                        e['name'] if e else ('없음' if st['index'] else '-'), len(r['comps']) or '-', note_hint(r)))
        tree.selection_set(tree.get_children())
        lab.config(text='%d대 — Ctrl/Shift 클릭으로 일부만 선택 가능(기본 전체)' % len(st['records']))

    def reload(*_):
        b = st['book']
        if not b:
            return
        sheets = [n for n, var in st['sheet_vars'].items() if var.get()]
        try:
            st['records'], warns = b.read(sheets, v['comp'].get())
            log('장비 %d대 읽음 (%s)' % (len(st['records']), ', '.join(sheets)))
            for w in warns:
                log('※ ' + w)
        except Exception as ex:
            messagebox.showerror('엑셀 오류', str(ex))
            st['records'] = []
        refresh()

    def pick_xlsx():
        p = filedialog.askopenfilename(filetypes=[('Excel', '*.xlsx *.xlsm'), ('All', '*.*')])
        if not p:
            return
        try:
            b = open_book(p)
        except Exception as ex:
            messagebox.showerror('엑셀 오류', str(ex)); return
        v['xlsx'].set(p); st['book'] = b
        for w in sheet_box.winfo_children():
            w.destroy()
        st['sheet_vars'] = {}
        for n in b.ledger_sheets:
            var = tk.BooleanVar(value=n in b.default_sheets)
            st['sheet_vars'][n] = var
            ttk.Checkbutton(sheet_box, text=n, variable=var, command=reload).pack(side='left', padx=4)
        cb_comp['values'] = [''] + b.sheet_names
        v['comp'].set(b.comp_sheet)
        reload()

    def pick_img():
        p = filedialog.askdirectory()
        if p:
            v['img'].set(p); st['index'] = scan(p)
            log('사진 %d장 발견' % len(st['index'])); refresh()

    entry_row(0, '엑셀 파일', v['xlsx'], pick_xlsx)
    entry_row(1, '사진 폴더', v['img'], pick_img)
    ttk.Label(f, text='장비 시트').grid(row=2, column=0, sticky='w', **pad)
    sheet_box = ttk.Frame(f); sheet_box.grid(row=2, column=1, sticky='w', **pad)
    ttk.Label(f, text='장비구성 시트').grid(row=3, column=0, sticky='w', **pad)
    cb_comp = ttk.Combobox(f, textvariable=v['comp'], state='readonly'); cb_comp.grid(row=3, column=1, sticky='w', **pad)
    cb_comp.bind('<<ComboboxSelected>>', reload)

    opt = ttk.Frame(f); opt.grid(row=4, column=0, columnspan=3, sticky='ew', **pad)
    ttk.Label(opt, text='Word').pack(side='left')
    ttk.Combobox(opt, textvariable=v['mode'], state='readonly', width=16, values=['하나의 Word 파일', '장비별 파일(ZIP)', '카탈로그만']).pack(side='left', padx=6)
    ttk.Label(opt, text='날짜').pack(side='left')
    ttk.Combobox(opt, textvariable=v['date'], state='readonly', width=6, values=['dot', 'dash', 'kr', 'han']).pack(side='left', padx=6)
    ttk.Label(opt, text='압축 기준(KB)').pack(side='left'); ttk.Entry(opt, textvariable=v['limit'], width=6).pack(side='left', padx=6)
    ttk.Label(opt, text='목표(KB)').pack(side='left'); ttk.Entry(opt, textvariable=v['target'], width=6).pack(side='left', padx=6)
    ttk.Checkbutton(opt, text='카탈로그(HTML)도 생성', variable=v_cat).pack(side='left', padx=12)

    lab = ttk.Label(f, text=''); lab.grid(row=5, column=0, columnspan=3, sticky='w', **pad)
    cols = (('sheet', '구분', 70), ('seq', '순번', 45), ('id', '관리번호', 110), ('name', '물품명', 330), ('img', '사진', 170), ('cmp', '구성', 45), ('note', '성능 글자', 80))
    tree = ttk.Treeview(f, columns=[c[0] for c in cols], show='headings', height=14, selectmode='extended')
    for c, t, w in cols:
        tree.heading(c, text=t); tree.column(c, width=w, anchor='w')
    tree.grid(row=6, column=0, columnspan=3, sticky='nsew', **pad)
    f.rowconfigure(6, weight=1)
    sb = ttk.Scrollbar(f, command=tree.yview); sb.grid(row=6, column=3, sticky='ns'); tree.config(yscrollcommand=sb.set)
    btn = ttk.Button(f, text='만들기'); btn.grid(row=7, column=0, columnspan=3, **pad)
    bar = ttk.Progressbar(f, maximum=100); bar.grid(row=8, column=0, columnspan=3, sticky='ew', **pad)
    txt = tk.Text(f, height=10, state='disabled'); txt.grid(row=9, column=0, columnspan=3, sticky='nsew', **pad)

    def pump():
        try:
            while True:
                k, a = q.get_nowait()
                if k == 'log':
                    txt.config(state='normal'); txt.insert('end', a + '\n'); txt.see('end'); txt.config(state='disabled')
                elif k == 'bar':
                    bar['value'] = a
                elif k == 'done':
                    btn.config(state='normal')
        except queue.Empty:
            pass
        root.after(100, pump)

    def run():
        if not st['records']:
            messagebox.showinfo('안내', '먼저 엑셀 파일을 선택하세요.'); return
        sel = [st['records'][int(i)] for i in sorted(tree.selection(), key=int)] or st['records']
        mode = v['mode'].get()
        zip_mode, word = mode.startswith('장비별'), mode != '카탈로그만'
        ext = '.zip' if zip_mode else ('.docx' if word else '.html')
        out = filedialog.asksaveasfilename(defaultextension=ext, initialfile=('시험장비관리대장_' if word else '장비카탈로그_') + datetime.now().strftime('%Y%m%d'),
                                           initialdir=os.path.dirname(v['xlsx'].get()))
        if not out:
            return
        try:
            lim, tgt = int(v['limit'].get()), int(v['target'].get())
        except ValueError:
            lim, tgt = None, None
        btn.config(state='disabled')

        def work():
            try:
                generate(st['book'], sel, st['index'], out, zip_mode, v['date'].get(), lim, tgt,
                         catalog=v_cat.get() or not word, word=word, log=log, progress=lambda a, b: q.put(('bar', a * 100 / b)))
            except Exception as ex:
                log('오류: %s' % ex)
            q.put(('done', None))
        threading.Thread(target=work, daemon=True).start()

    btn.config(command=run)
    pump()
    if not HAVE_HEIF:
        log('※ pillow-heif 미설치 — 아이폰 HEIC 사진을 쓰려면: pip install pillow-heif')
    root.mainloop()
