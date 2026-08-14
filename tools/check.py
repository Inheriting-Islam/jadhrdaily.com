#!/usr/bin/env python3
"""Structural audit for jadhrdaily.com. Standard library only, no browser —
so it runs identically on a laptop and in CI. Lifted from the audit that guards
inheritingislam.com, with this site's own host list and its own list of things
it is not yet allowed to claim.

    python3 tools/check.py

Checks, in the order they tend to break:
  1. every internal link and asset reference resolves to a real file
  2. exactly one <h1> per page, and the landmarks are present
  3. every <img> has alt text, every form control has a matching <label>
  4. every Arabic string carries lang="ar"
  5. no third-party requests sneak in (the privacy claim has to stay true)
  6. no page claims work is finished that is not

Exits non-zero on any failure.
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {'.git', '_internal', 'tools', 'docs', '.github'}

# Hosts this site is allowed to reference. Everything else is a privacy break.
ALLOWED_HOSTS = {'jadhrdaily.com', 'inheritingislam.com'}

# Phrases that would make the site claim something it has not earned. The last
# three mirror the app's own licensing test: those translations are permission-
# or NC/ND-licensed and must never appear in anything Jadhr publishes.
BANNED = [
    (r'\bavailable now\b', 'Jadhr has not shipped'),
    (r'\bdownload (?:it|the app|now)\b', 'there is nothing to download yet'),
    (r'\bapp store\b', 'it is not on any store'),
    (r'\bscholar[- ]verified\b|\bverified by scholars\b', 'content review has not happened yet'),
    (r'\bsahih international\b', 'permission-based translation — not licensed for use'),
    (r'\bclear qur', 'CC BY-NC-ND translation — ND forbids excerpting'),
    (r'\bkhattab\b', 'CC BY-NC-ND translation — ND forbids excerpting'),
]

fails, warns = [], []


def pages():
    for dp, dns, fns in os.walk(ROOT):
        dns[:] = [d for d in dns if d not in SKIP_DIRS]
        for fn in fns:
            if fn.endswith('.html'):
                yield os.path.join(dp, fn)


def rel(p):
    return os.path.relpath(p, ROOT)


for path in pages():
    s = open(path, encoding='utf-8').read()
    p = rel(path)

    # 1 ─ references resolve
    for attr in re.findall(r'(?:href|src)="([^"]+)"', s):
        if attr.startswith(('mailto:', 'tel:', 'data:', '#', 'https://', 'http://')):
            continue
        target, _, frag = attr.partition('#')
        target = target.split('?')[0]
        if not target:
            # Same-page link. A bare "#..." was skipped above, but "?a=b#frag"
            # lands here — and used to be skipped too, which let a deleted
            # anchor pass unnoticed. Check the fragment against this file.
            if frag and f'id="{frag}"' not in s:
                fails.append(f'{p}: missing anchor on this page → {attr}')
            continue
        base = ROOT if target.startswith('/') else os.path.dirname(path)
        full = os.path.normpath(os.path.join(base, target.lstrip('/') if target.startswith('/') else target))
        hit = [c for c in (full, os.path.join(full, 'index.html')) if os.path.isfile(c)]
        if not hit:
            fails.append(f'{p}: dead reference → {attr}')
        elif frag and f'id="{frag}"' not in open(hit[0], encoding='utf-8').read():
            fails.append(f'{p}: missing anchor → {attr}')

    # 2 ─ one h1, landmarks present
    n_h1 = len(re.findall(r'<h1[\s>]', s))
    if n_h1 != 1:
        fails.append(f'{p}: expected exactly one <h1>, found {n_h1}')
    for tag, label in (('<header', 'header'), ('<main', 'main'),
                       ('<footer', 'footer'), ('class="skip"', 'skip link')):
        if tag not in s:
            fails.append(f'{p}: missing {label}')

    # 3 ─ alt text and labels
    for img in re.findall(r'<img\b[^>]*>', s):
        if 'alt=' not in img:
            fails.append(f'{p}: <img> without alt → {img[:70]}…')
    for ctl in re.findall(r'<(?:input|select|textarea)\b[^>]*>', s):
        m = re.search(r'id="([^"]+)"', ctl)
        if not m:
            fails.append(f'{p}: form control without id → {ctl[:60]}…')
        elif f'for="{m.group(1)}"' not in s:
            fails.append(f'{p}: no <label for="{m.group(1)}">')

    # 4 ─ Arabic is declared
    for el in re.findall(r'<[^>]*class="[^"]*\bar(?:-lg)?\b[^"]*"[^>]*>', s):
        if 'lang="ar"' not in el:
            fails.append(f'{p}: Arabic without lang="ar" → {el[:70]}…')

    # 5 ─ no third parties
    for url in re.findall(r'(?:href|src)="(https?://[^"]+)"', s):
        host = url.split('//', 1)[1].split('/')[0]
        if host not in ALLOWED_HOSTS:
            fails.append(f'{p}: third-party request → {url}')

    # 6 ─ no unearned claims
    body = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    for pattern, why in BANNED:
        if re.search(pattern, body, re.I):
            warns.append(f'{p}: "{pattern}" — {why}')

n = len(list(pages()))
for w in warns:
    print(f'  warn  {w}')
for f in fails:
    print(f'  FAIL  {f}')
print(f'\n{n} pages checked · {len(fails)} failures · {len(warns)} warnings')
sys.exit(1 if fails else 0)
