# jadhrdaily.com

The pre-launch page for **Jadhr** — the daily Arabic root. One page, one stylesheet,
one script, no third-party requests.

**Deployed but deliberately not launched.** It is served from
`https://inheriting-islam.github.io/jadhrdaily.com/` and the custom domain is *not* attached —
jadhrdaily.com still points nowhere. The page is noindexed and `robots.txt` disallows everything
while it sits on the preview URL, because a crawled preview competes with the real domain later.

The app itself lives in `~/jadhr`; this repo is only the page that takes the email address.

## Why this domain and not jadhrapp.com

There is another product called **Jadhr** at `jadhr.app` — an Arabic root explorer and academy,
private beta, © Shahen Dalia, built on Lovable. Same descriptive Arabic word, adjacent subject,
different product: theirs is a lookup tool and a course, this is a sixty-second daily game.

The name stays. *Jadhr* means "root", it is directly descriptive for both of us, and neither of
us can own it or be stopped from using it. What could not stay is the domain: **`jadhrapp.com`
and `jadhr.app` are the same characters with the dot moved, and identical when spoken.** Every
bit of that confusion leaks one way — away from here, toward them — and it is invisible when it
happens. Jadhr's whole distribution is somebody saying the name out loud in a group chat, so the
address has to survive being said out loud.

`jadhrdaily.com` also earns its keep as positioning: "Jadhr Daily" is a phrase that can never be
mistaken for a dictionary. **`jadhrapp.com` is still owned — redirect it, never print it.**

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
| 105 roots authored · 366 word forms | `CORPUS_STATS.roots`, `.familyWords` |
| 47% of the Qur'an's rooted words — 23,466 of 50,269 | `CORPUS_STATS.quranCoverage` |
| 808 playable roots / 94% destination | corpus analysis, 2026-08-14 (roots with ≥3 surface forms) |
| 104-root rotation | 105 minus `ktb` (tutorial) and any Atlas-only root |
| The thirty roots of Ramadan, in order | the `RAMADAN` export, unedited |
| ṣ–b–r, its four forms, and 70:5 | the `صبر` entry, including `radicalAlignment` |
| Corpus + Pickthall credits | `QURAN_PROVENANCE` |

The status section says the content is **draft** and awaiting human review, because it is.
`tools/check.py` fails the build on "available now", "app store", "verified by scholars", and
on the three translations Jadhr is not licensed to quote — the same assertion the app's own
licensing test makes.

## The waitlist

**The page now promises a root a week, not one email at launch.** That is a deliberate change and
it is a commitment: launch is roughly six months out, and every source on waitlists says a list
that hears nothing for six months is cold by the time you need it. A weekly root keeps it warm,
tests the content on real readers before it ships, and is a better thing to be subscribed to than
a notification. **If you are not going to write it weekly, change the copy before launch** — the
strings are "every Friday" in the hero and the whole `#waitlist` section.

Both forms post JSON — `{ email, source }` — to whatever `data-endpoint` names, and expect a 2xx
(409 counts as success: already subscribed is subscribed). Then the form is replaced by a real
confirmation, because going quiet after a signup is a well-documented way to lose people.

`data-endpoint` is **empty**, so today the handler still falls back to composing a mail. That is
honest but it converts badly. To finish it: deploy `worker/` — **first-party capture into
Cloudflare KV on our own account**. No email provider is in the capture loop at all (an earlier
draft posted to Buttondown's API, but their API needs the $29/mo tier — and decoupling capture
from sending is better anyway: the list is ours, exported with one authenticated GET, and the
Friday email goes out through anything, or by hand while the list is small).

```sh
cd worker
npx wrangler kv namespace create LIST   # paste ids into wrangler.toml
npx wrangler kv namespace create RATE
npx wrangler secret put EXPORT_KEY      # any long random string
npx wrangler deploy
# export for the Friday email:
curl -H "Authorization: Bearer $EXPORT_KEY" https://jadhrdaily.com/api/subscribers
```

Then set `data-endpoint="/api/subscribe"` on both forms. **Requires the apex record to be
proxied (orange cloud), which is only safe after GitHub has issued the Pages certificate.**

## Day one is playable

The hero card is the real first move of the real game for one root — ص-ب-ر — with no account and
nothing installed. The markup **contains the answer**: without JavaScript the card is a static
x-ray of the root and its family, and script is what takes the answer away and asks for it back.

After three wrong attempts it reveals the root anyway. That is not politeness, it is the section
further down the page — *"Never a paywall on the Bloom"* — being demonstrated rather than
claimed. Nothing about the puzzle is stored or sent.

## Deploying

GitHub Pages, from `main`, via the workflow in `.github/workflows/deploy.yml` — the same setup
as inheritingislam.com. It runs `tools/check.py` first and refuses to deploy a page that fails
it, or a site over 4 MB. Pages is already configured with **Source: GitHub Actions**, so every
push to `main` publishes to the preview URL.

Asset paths are **relative**, not root-absolute, precisely so the same commit renders correctly
both on the github.io subpath and at an apex domain. Keep them that way.

## Going live — the whole checklist

Nothing below has been done yet. In order:

1. **Cloudflare DNS** (jadhrdaily.com's nameservers are `ian`/`sharon.ns.cloudflare.com`):

   | Type | Name | Value | Proxy |
   |---|---|---|---|
   | A | `@` | `185.199.108.153`, `.109.153`, `.110.153`, `.111.153` | **DNS only** |
   | CNAME | `www` | `inheriting-islam.github.io.` | **DNS only** |

   Grey cloud, not orange. A proxied record blocks the Let's Encrypt challenge and GitHub never
   issues the certificate.

2. **Restore the CNAME file** — `echo jadhrdaily.com > CNAME` — or set the domain under
   Settings → Pages. It was removed so the deploy could not claim the domain early.
3. **Wait for the certificate**, then tick **Enforce HTTPS**.
4. **Lift the parking**: delete the `noindex` meta in `index.html` and the `Disallow` in
   `robots.txt`. They are commented so neither gets left behind.
5. **Point jadhrapp.com here.** Both domains sit in the same Cloudflare account, so it is one
   Redirect Rule: `jadhrapp.com/*` → `https://jadhrdaily.com/$1`, 301. It exists to catch type-ins
   and to keep the near-miss domain out of anyone else's hands, not to be advertised.
6. **Rewrite the Jadhr row on `inheritingislam.com/apps/`** and point it here. Until that
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
