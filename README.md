# jadhrapp.com

The pre-launch page for **Jadhr** — the daily Arabic root. One page, one stylesheet,
one script, no third-party requests.

**Deployed but deliberately not launched.** It is served from
`https://inheriting-islam.github.io/jadhrapp.com/` and the custom domain is *not* attached —
jadhrapp.com still points nowhere. The page is noindexed and `robots.txt` disallows everything
while it sits on the preview URL, because a crawled preview competes with the real domain later.

The app itself lives in `~/jadhr`; this repo is only the page that takes the email address.

---

## What it says, and why

Jadhr's row on `inheritingislam.com/apps/` is deliberately vague — "we are not explaining
how it works until it is in your hands." **That stance does not survive contact with its own
domain.** A page whose only job is to convert a stranger into an email address cannot withhold
the product; a visitor who cannot tell what the thing is has no reason to type anything.

So this page describes the loop — hunt, bloom, āyah — and defends the moat where it actually
is: not in the mechanic, which is a grid of tiles anyone can clone, but in the authored roots,
the word families, and the verses matched against the Qur'anic corpus.

**When this page goes live, the `/apps/` copy has to change with it**, or the two sites
contradict each other.

## Claims, and where each one comes from

Everything numeric on the page is read out of `~/jadhr/app/source/content.mjs` — no rounding
up, no marketing arithmetic:

| On the page | Source |
|---|---|
| 45 roots authored · 170 word forms | `CORPUS_STATS.roots`, `.familyWords` |
| 17% of the Qur'an's rooted words — 8,734 of 50,269 | `CORPUS_STATS.quranCoverage` |
| 18 semantic fields | distinct `semanticTags` across the corpus |
| 44-root rotation | 45 minus `k–t–b`, the tutorial root |
| The thirty roots of Ramadan, in order | the `RAMADAN` export, unedited |
| ṣ–b–r, its four forms, and 70:5 | the `صبر` entry, including `radicalAlignment` |
| Corpus + Pickthall credits | `QURAN_PROVENANCE` |

The status section says the content is **draft** and awaiting human review, because it is.
`tools/check.py` fails the build on "available now", "app store", "verified by scholars", and
on the three translations Jadhr is not licensed to quote — the same assertion the app's own
licensing test makes.

## The waitlist

There is no form backend. `assets/js/site.js` composes a complete message in the visitor's own
mail client and says so plainly on the page — the house pattern from inheritingislam.com.

**To swap in a real list**, replace the one `submit` handler in `site.js` with a `fetch` to your
endpoint. The markup does not change, and neither does the copy, as long as the endpoint really
does store one address and send one email.

## Deploying

GitHub Pages, from `main`, via the workflow in `.github/workflows/deploy.yml` — the same setup
as inheritingislam.com. It runs `tools/check.py` first and refuses to deploy a page that fails
it, or a site over 4 MB. Pages is already configured with **Source: GitHub Actions**, so every
push to `main` publishes to the preview URL.

Asset paths are **relative**, not root-absolute, precisely so the same commit renders correctly
both on the github.io subpath and at an apex domain. Keep them that way.

## Going live — the whole checklist

Nothing below has been done yet. In order:

1. **Cloudflare DNS** (jadhrapp.com's nameservers are `ian`/`sharon.ns.cloudflare.com`):

   | Type | Name | Value | Proxy |
   |---|---|---|---|
   | A | `@` | `185.199.108.153`, `.109.153`, `.110.153`, `.111.153` | **DNS only** |
   | CNAME | `www` | `inheriting-islam.github.io.` | **DNS only** |

   Grey cloud, not orange. A proxied record blocks the Let's Encrypt challenge and GitHub never
   issues the certificate.

2. **Restore the CNAME file** — `echo jadhrapp.com > CNAME` — or set the domain under
   Settings → Pages. It was removed so the deploy could not claim the domain early.
3. **Wait for the certificate**, then tick **Enforce HTTPS**.
4. **Lift the parking**: delete the `noindex` meta in `index.html` and the `Disallow` in
   `robots.txt`. They are commented so neither gets left behind.
5. **Rewrite the Jadhr row on `inheritingislam.com/apps/`** and point it here. Until that
   happens the two sites contradict each other — see the section above.

## Checking it locally

```sh
python3 tools/check.py       # links, landmarks, alt text, lang, third parties, honest claims
python3 -m http.server 8787  # then open http://localhost:8787
```

Root-absolute paths (`/assets/...`) mean the github.io preview URL will look broken. That is
expected — judge it on the custom domain or locally, never on the subpath.

## Regenerating the app screenshots

`assets/img/screen-hunt.webp` and `screen-bloom.webp` come from the app's own capture harness,
which drives it to a named screen and holds it there:

```sh
cd ~/jadhr && python3 -m http.server 8788
# then, per screen — hunt · bloom · quran · complete · map …
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --force-device-scale-factor=2 \
  --window-size=470,860 --screenshot=out.png --virtual-time-budget=6000 \
  "http://localhost:8788/app/tools/walkthrough.html?screen=hunt&vw=470&vh=860"
```

Capture through the harness, not by pointing headless Chrome at the app directly: **this build
of headless Chrome clamps its window to a 500 px minimum**, so a `--window-size=390` capture
silently renders a 500 px layout and crops it. That is what cut the right edge off the older
`screenshot-narrow-*.png` in the app repo. The harness sizes an iframe explicitly, so the phone
is exactly the width you asked for.
