#!/usr/bin/env python3
"""Pull the readable text out of a hub document so Helpful HR can search it.

Usage: extract_text.py <file> <filename>
Prints JSON: {"pages": ["text of page 1", ...]}  (one entry per page/slide/sheet; one entry for Word)
"""
import json, sys, os, re

MAX = 400_000  # characters per document


def clean(t):
    t = (t or '').replace('\x00', ' ')
    t = re.sub(r'[ \t ]+', ' ', t)
    t = re.sub(r'\n\s*\n\s*\n+', '\n\n', t)
    return t.strip()


def pdf(path):
    from pypdf import PdfReader
    r = PdfReader(path)
    if r.is_encrypted:
        try: r.decrypt('')
        except Exception: pass
    out = []
    for p in r.pages[:400]:
        try: out.append(clean(p.extract_text() or ''))
        except Exception: out.append('')
    return out


def docx(path):
    import docx as d
    doc = d.Document(path)
    parts = [p.text for p in doc.paragraphs]
    for table in doc.tables:
        for row in table.rows:
            parts.append(' | '.join(c.text.strip() for c in row.cells))
    return [clean('\n'.join(parts))]


def xlsx(path):
    import openpyxl
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    out = []
    for ws in wb.worksheets[:30]:
        rows = []
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i > 2000: break
            cells = [str(v) for v in row if v is not None and str(v).strip()]
            if cells: rows.append(' | '.join(cells))
        out.append(clean(ws.title + '\n' + '\n'.join(rows)))
    return out


def pptx(path):
    from pptx import Presentation
    out = []
    for s in Presentation(path).slides:
        bits = []
        for sh in s.shapes:
            if getattr(sh, 'has_text_frame', False) and sh.has_text_frame:
                bits.append(sh.text_frame.text)
        out.append(clean('\n'.join(bits)))
    return out


def main():
    path, name = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else sys.argv[1]).lower()
    with open(path, 'rb') as f: head = f.read(8)
    ext = os.path.splitext(name.split('?')[0])[1]
    try:
        if head.startswith(b'%PDF') or ext == '.pdf': pages = pdf(path)
        elif ext in ('.docx', '.docm', '.dotx'): pages = docx(path)
        elif ext in ('.xlsx', '.xlsm'): pages = xlsx(path)
        elif ext in ('.pptx',): pages = pptx(path)
        elif ext in ('.txt', '.csv', '.md', '.htm', '.html'):
            with open(path, 'r', encoding='utf-8', errors='replace') as f: pages = [clean(re.sub(r'<[^>]+>', ' ', f.read()))]
        elif head.startswith(b'PK'):  # an Office file without a useful name: try Word, then PowerPoint, then Excel
            pages = None
            for fn in (docx, pptx, xlsx):
                try: pages = fn(path); break
                except Exception: continue
            if pages is None: raise ValueError('unsupported Office file')
        else:
            print(json.dumps({'pages': [], 'error': 'This type of file can’t be read (only PDF, Word, Excel, PowerPoint and text).'})); return
    except Exception as e:
        print(json.dumps({'pages': [], 'error': f'Couldn’t read the file ({type(e).__name__}).'})); return
    total, keep = 0, []
    for p in pages:
        if total >= MAX: break
        keep.append(p[: MAX - total]); total += len(keep[-1])
    print(json.dumps({'pages': keep}, ensure_ascii=False))


if __name__ == '__main__':
    main()
