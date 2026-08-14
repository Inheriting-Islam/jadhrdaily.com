import {
  evaluateRootGuess,
  isSolved,
  isAcceptedRoot,
  rootKey,
  buildShareText,
  resolveRootSubmission,
  isCorrectSpotSelection,
  isExactRootSelection,
  selectDailyRoot,
  puzzleNumber,
  alignRadicals,
  baseLetters,
} from "./logic.mjs";
import { CORPUS, ACCEPTED_ROOT_KEYS, QURAN_PROVENANCE, CORPUS_STATS } from "./content.mjs";

const app = document.querySelector("#app");
const params = new URLSearchParams(location.search);

const ROOTS = {
  ktb: {
    id: "ktb",
    radicals: ["ك", "ت", "ب"],
    translit: "k–t–b",
    gloss: "writing · inscription · prescription",
    family: [
      { ar: "كِتَاب", tr: "kitāb", en: "book", marked: "<mark class='root-letter root-1'>ك</mark>ِ<mark class='root-letter root-2'>ت</mark>َا<mark class='root-letter root-3'>ب</mark>" },
      { ar: "كَاتِب", tr: "kātib", en: "writer", marked: "<mark class='root-letter root-1'>ك</mark>َا<mark class='root-letter root-2'>ت</mark>ِ<mark class='root-letter root-3'>ب</mark>" },
      { ar: "مَكْتُوب", tr: "maktūb", en: "written", marked: "مَ<mark class='root-letter root-1'>ك</mark>ْ<mark class='root-letter root-2'>ت</mark>ُو<mark class='root-letter root-3'>ب</mark>" },
      { ar: "مَكْتَب", tr: "maktab", en: "desk / office", marked: "مَ<mark class='root-letter root-1'>ك</mark>ْ<mark class='root-letter root-2'>ت</mark>َ<mark class='root-letter root-3'>ب</mark>" },
    ],
  },
  // No authored `quran` block: the corpus supplies Uthmani text with a public-domain
  // translation, which the hand-authored Sahih International verse could not be licensed for.
  sbr: {
    id: "sbr",
    radicals: ["ص", "ب", "ر"],
    translit: "ṣ–b–r",
    gloss: "patience · endurance · steadfastness",
    discoveryEvidence: [
      { roman: "ṢABR", gloss: "patience · steadfastness" },
      { roman: "ṢĀBIR", gloss: "one who remains patient" },
      { roman: "ṢĀBIRĪN", gloss: "those who remain patient" },
    ],
    pool: [
      { ar: "ص", lat: "ṣ" }, { ar: "ب", lat: "b" }, { ar: "ر", lat: "r" },
      { ar: "س", lat: "s" }, { ar: "ت", lat: "t" }, { ar: "ل", lat: "l" },
    ],
    family: [
      { ar: "صَبْر", tr: "ṣabr", en: "patience · steadfastness", marked: "<mark class='root-letter root-1'>ص</mark>َ<mark class='root-letter root-2'>ب</mark>ْ<mark class='root-letter root-3'>ر</mark>" },
      { ar: "صَابِر", tr: "ṣābir", en: "patient · steadfast", marked: "<mark class='root-letter root-1'>ص</mark>َا<mark class='root-letter root-2'>ب</mark>ِ<mark class='root-letter root-3'>ر</mark>" },
      { ar: "صَابِرِينَ", tr: "ṣābirīn", en: "those who are patient", marked: "<mark class='root-letter root-1'>ص</mark>َا<mark class='root-letter root-2'>ب</mark>ِ<mark class='root-letter root-3'>ر</mark>ِينَ" },
      { ar: "اِصْبِرْ", tr: "iṣbir", en: "be patient / endure", marked: "اِ<mark class='root-letter root-1'>ص</mark>ْ<mark class='root-letter root-2'>ب</mark>ِ<mark class='root-letter root-3'>ر</mark>ْ" },
    ],
  },
  rhm: {
    id: "rhm",
    radicals: ["ر", "ح", "م"],
    translit: "r–ḥ–m",
    gloss: "mercy · compassion",
    family: [
      { ar: "رَحْمَة", tr: "raḥmah", en: "mercy", marked: "<mark class='root-letter root-1'>ر</mark>َ<mark class='root-letter root-2'>ح</mark>ْ<mark class='root-letter root-3'>م</mark>َة" },
      { ar: "رَحِيم", tr: "raḥīm", en: "merciful", marked: "<mark class='root-letter root-1'>ر</mark>َ<mark class='root-letter root-2'>ح</mark>ِي<mark class='root-letter root-3'>م</mark>" },
    ],
  },
};

// Merge the imported corpus into the hand-authored roots. Authored entries win *field by field*,
// not wholesale: they contribute hand-marked family words, while everything Qur'anic now comes
// from the corpus so provenance is uniform. rhm is only a stub, and letting a stub shadow a
// complete legacy entry would leave that root unplayable. Dedupe on the radicals, since authored
// entries are keyed "sbr" while the legacy twin is keyed "صبر".
const ALIASES = new Map();
{
  const authoredByKey = new Map(Object.entries(ROOTS).map(([key, r]) => [rootKey(r.radicals), key]));
  for (const entry of Object.values(CORPUS)) {
    const key = rootKey(entry.radicals);
    const imported = fromCorpus(entry);
    const authoredKey = authoredByKey.get(key);
    if (authoredKey) {
      const authored = ROOTS[authoredKey];
      ROOTS[authoredKey] = {
        ...imported,
        ...Object.fromEntries(Object.entries(authored).filter(([, v]) =>
          v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0))),
        id: authoredKey,
      };
      ALIASES.set(key, authoredKey);
    } else {
      ROOTS[entry.id] = imported;
      ALIASES.set(key, entry.id);
    }
  }
}

// Adapt a doc-11 CORPUS record to the shape the screens render.
function fromCorpus(entry) {
  const occurrence = entry.quranOccurrences[0];
  return {
    id: entry.id,
    radicals: entry.radicals,
    translit: entry.transliteration,
    gloss: entry.coreSemanticNotes.en,
    theme: entry.semanticTags[0],
    frequency: entry.quranFrequency || 0,
    rank: entry.quranRank || null,
    discoveryEvidence: entry.teaching.discoveryEvidence,
    pool: entry.teaching.pool,
    family: entry.familyWords.map((w) => ({
      ar: w.arabic,
      tr: w.transliteration,
      en: w.gloss.en,
      alignment: w.radicalAlignment,
    })),
    quran: occurrence && {
      reference: occurrence.reference,
      arabic: occurrence.arabic,
      script: occurrence.script,
      translation: occurrence.translation.en,
      translationSource: occurrence.translation.source,
      target: occurrence.targetSurfaceForm,
      spotForm: occurrence.spotForm || occurrence.targetSurfaceForm,
      targetAlignment: occurrence.targetAlignment,
    },
    draft: true,
  };
}

// k–t–b is the tutorial root and the Echo root; serving it as "today's discovery" minutes after
// onboarding taught it would waste a day of the rotation.
const ONBOARDING_ROOT = "ktb";

// Roots eligible for the shared Daily: they need a Qur'anic word in which all three radicals
// surface in order, otherwise the Spot stage has nothing to teach. The rest stay reachable
// through Explore and the Atlas rather than being dropped from the corpus.
const DAILY_POOL = Object.values(ROOTS)
  .filter((r) => r.id !== ONBOARDING_ROOT && r.quran?.target && r.discoveryEvidence?.length && r.pool?.length)
  .map((r) => r.id)
  .sort();

const ACCEPTED = new Set(ACCEPTED_ROOT_KEYS.map((key) => rootKey([...key])));
for (const entry of Object.values(ROOTS)) ACCEPTED.add(rootKey(entry.radicals));

// `?date=YYYY-MM-DD` and `?root=<id>` pin the Daily so tests and QA are deterministic. A root may
// be named by its own key or by its Arabic radicals, which resolve through the alias map.
function dailyRootId() {
  const forced = params.get("root");
  if (forced) {
    if (ROOTS[forced]) return forced;
    const alias = ALIASES.get(rootKey([...forced]));
    if (alias) return alias;
  }
  return selectDailyRoot(DAILY_POOL, params.get("date") || new Date());
}
function dailyRoot() { return ROOTS[dailyRootId()]; }

// Practice and Challenge reuse the entire Daily flow, so every play surface reads
// activeRoot() rather than dailyRoot(). Screens that report on the DAY — the today
// card, the atlas, the share sheet — deliberately keep asking for the daily root.
function activeRootId() {
  const s = state.session;
  return s ? s.queue[s.index] : dailyRootId();
}
function activeRoot() { return ROOTS[activeRootId()] || dailyRoot(); }

// Practice never serves today's root: meeting it here would spend the Daily before
// you played it. Challenge draws from the same pool for the same reason.
function sessionPool() {
  const today = dailyRootId();
  return DAILY_POOL.filter((id) => id !== today);
}

const CHALLENGE_LENGTH = 5;

function newChallengeQueue() {
  const pool = [...sessionPool()];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, CHALLENGE_LENGTH);
}
function dailyNumber() { return puzzleNumber(params.get("date") || new Date()); }

const defaultState = () => ({
  screen: "onboarding-intro",
  onboardingDone: false,
  dailyComplete: false,
  dailyStarted: false,
  checkpoint: null, // furthest Daily stage reached: hunt → bloom → quran → spot (D1)
  supportMode: "guided",
  selected: [],
  guesses: [],
  invalidMessage: "",
  supportMessage: "",
  hintUsed: false,
  solved: false,
  rootRevealed: false,
  spotSelected: [],
  spotComplete: false,
  modal: null,
  map: {
    ktb: "met",
    sbr: null,
    rhm: null,
  },
  echoSelected: [],
  echoComplete: false,
  echoMessage: "",
  atlasOpen: [],
  // A session is a run OUTSIDE the Daily. While one is set, the play flow reads its
  // root instead of today's and no Daily progress is written — practice cannot
  // manufacture a streak, and challenge cannot spend today's root before you meet it.
  session: null,
  practiceLog: { played: 0, solved: 0 },
  challengeBest: 0,
});

let state = loadState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem("jadhr-prototype-state") || "null");
    if (!saved) return defaultState();
    const next = { ...defaultState(), ...saved, selected: [], spotSelected: [], echoSelected: [], modal: null, session: null };
    // Resume at the furthest checkpoint, never earlier — a solved Hunt must not reopen (D1).
    if (next.onboardingDone) next.screen = next.dailyComplete ? "today" : next.dailyStarted ? (next.checkpoint || "hunt") : "today";
    return next;
  } catch {
    return defaultState();
  }
}

function persist() {
  const persistent = { ...state, selected: [], spotSelected: [], echoSelected: [], modal: null, invalidMessage: "", supportMessage: "" };
  localStorage.setItem("jadhr-prototype-state", JSON.stringify(persistent));
}

function setState(patch, save = true) {
  state = { ...state, ...patch };
  if (save) persist();
  render();
}

function rootMark() {
  return `<span class="micro-root-mark" aria-hidden="true"><i></i><i></i><i></i></span>`;
}

function icon(name) {
  const icons = {
    back: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>`,
    today: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.4" class="fill"/></svg>`,
    map: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="7" r="1.7" class="fill"/><circle cx="18" cy="6" r="1.7" class="fill"/><circle cx="9" cy="17" r="1.7" class="fill"/><path d="M7.6 7.7l8.8-1M7 8.5l1.2 6.8M10.5 16l6.2-8.2"/></svg>`,
    explore: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 16l8-8M10 8h6v6"/><circle cx="12" cy="12" r="8"/></svg>`,
    history: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8h10M7 12h10M7 16h7"/><path d="M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z"/></svg>`,
  };
  return icons[name] || "";
}

function topbar({ back = null, quiet = false } = {}) {
  return `<div class="topbar">
    ${back ? `<button class="icon-btn" data-action="${back}" aria-label="Go back">${icon("back")}</button>` : `<div class="brand">${rootMark()} <span>Jadhr</span></div>`}
    ${quiet ? `<span class="eyebrow">Root by root</span>` : `<button class="type-btn" data-action="open-settings" aria-label="Learning support settings">Aa</button>`}
  </div>`;
}

function nav(active) {
  return `<nav class="nav" aria-label="Primary">
    ${navBtn("today", "Today", active)}
    ${navBtn("map", "Map", active)}
    ${navBtn("explore", "Explore", active)}
    ${navBtn("history", "History", active)}
  </nav>`;
}

function navBtn(id, label, active) {
  return `<button data-action="nav-${id}" class="${active === id ? "active" : ""}"><span class="nav-icon">${icon(id)}</span>${label}</button>`;
}

function onboardingIntro() {
  return `<main class="screen no-nav hero" data-screen="onboarding-intro">
    <div class="intro-top"><span></span><span class="eyebrow">Root by root</span></div>
    <div class="onboarding-intro-body">
      <div class="brand-lockup" aria-label="Jadhr, Arabic root game">
        <img class="brand-emblem-large" src="./jadhr-logo-emblem.png" alt="" aria-hidden="true" />
        <div class="brand-stack">
          <div class="brand-wordmark"><strong>Jadhr</strong><span lang="ar" dir="rtl">جذر</span></div>
          <div class="publisher-line">an <strong>Inheriting Islam</strong> app</div>
        </div>
      </div>
      <div class="eyebrow">A daily Arabic root game</div>
      <h1 style="margin-top:12px">Arabic starts<br>to reveal itself.</h1>
      <p class="lede">Find the three letters that stay. Watch whole word families become visible.</p>
      <div class="hero-root root-rail signature-root" aria-label="Three unknown root letters">
        <div class="root-node mystery tone-1"><span class="mystery-dot"></span></div>
        <div class="root-node mystery tone-2"><span class="mystery-dot"></span></div>
        <div class="root-node mystery tone-3"><span class="mystery-dot"></span></div>
      </div>
      <div class="promise-row" aria-label="What Jadhr teaches"><span>Discover</span><i></i><span>See</span><i></i><span>Remember</span></div>
      <button class="btn primary" id="start-onboarding" data-action="onboarding-family">Show me how</button>
      <p class="micro center">No account. No Arabic required.</p>
    </div>
  </main>`;
}

function onboardingFamily() {
  return `<main class="screen no-nav onboarding-family-screen" data-screen="onboarding-family">
    ${topbar({ back: "onboarding-intro", quiet: true })}
    <section class="lesson-head">
      <div class="eyebrow">One pattern hiding in plain sight</div>
      <h2>Look at what refuses to disappear.</h2>
      <p>Different words. The same three consonants keep returning.</p>
    </section>
    <div class="family-demo family-demo-premium">
      <div class="family-row"><div class="word"><strong>K</strong>I<strong>T</strong>Ā<strong>B</strong></div><div class="meaning">book</div></div>
      <div class="family-row"><div class="word"><strong>K</strong>Ā<strong>T</strong>I<strong>B</strong></div><div class="meaning">writer</div></div>
      <div class="family-row"><div class="word">MA<strong>K</strong><strong>T</strong>Ū<strong>B</strong></div><div class="meaning">written</div></div>
    </div>
    <div class="root-explainer">
      <div class="root-rail signature-root" aria-label="Root kaf ta ba">
        ${rootNode("ك", "k", true, "", "tone-1")}${rootNode("ت", "t", true, "", "tone-2")}${rootNode("ب", "b", true, "", "tone-3")}
      </div>
      <div class="root-caption"><strong>ك · ت · ب</strong><span>k–t–b · writing</span></div>
    </div>
    <p class="micro">Arabic is read right-to-left. Jadhr keeps transliteration visible while you learn the shapes.</p>
    <button class="btn primary" id="continue-family" data-action="start-first-daily">Find today's root</button>
  </main>`;
}

function rootNode(ar = "", lat = "", filled = false, feedback = "", tone = "", unpickIdx = null) {
  const unpick = filled && unpickIdx !== null
    ? ` data-action="unpick-letter" data-idx="${unpickIdx}" role="button" tabindex="0" aria-label="Remove ${ar}"`
    : "";
  return `<div class="root-node ${filled ? "filled" : ""} ${feedback} ${tone}"${unpick}><span class="ar">${ar || "·"}</span>${lat ? `<span class="lat">${lat}</span>` : ""}</div>`;
}

// Every number shown to the player is derived from state — no mock counts (D4 / spec D-5).
// Forms opened = the family of every root they have actually met. Counting only today's root
// told a player holding 21 roots that they had seen 8 forms.
function wordsOpened() {
  let total = 0;
  for (const [id, stage] of Object.entries(state.map)) {
    if (!stage) continue;
    total += ROOTS[id]?.family?.length || 0;
  }
  return total;
}

function rootsHeld() {
  return Object.values(state.map).filter(Boolean).length;
}

// Share of Qur'anic word occurrences the player's roots account for — the honest version of
// "how much of the Qur'an can you now see into". Uses real corpus frequencies (M4a).
function corpusCoverage() {
  const total = CORPUS_STATS.quranCoverage?.totalRooted;
  if (!total) return null;
  let covered = 0;
  for (const [id, stage] of Object.entries(state.map)) {
    if (!stage) continue;
    covered += ROOTS[id]?.frequency || 0;
  }
  return covered ? Math.max(0.1, Number(((covered / total) * 100).toFixed(1))) : 0;
}

function dailyLabel() { return `Daily ${String(dailyNumber()).padStart(3, "0")}`; }

function todayKicker() {
  const when = params.get("date") ? new Date(`${params.get("date")}T00:00:00`) : new Date();
  const weekday = when.toLocaleDateString("en-US", { weekday: "long" });
  return `${weekday} · ${dailyLabel()}`;
}

function todayScreen() {
  const held = rootsHeld();
  const inProgress = state.dailyStarted && !state.dailyComplete;
  return `<main class="screen" data-screen="today">
    ${topbar()}
    <section class="today-head">
      <div class="eyebrow today-kicker"><span class="today-live-dot"></span>${todayKicker()}</div>
      <h1>${state.dailyComplete ? "Today's root<br>is yours." : inProgress ? "Your root is<br>still waiting." : "Two minutes.<br>One new lens."}</h1>
      <p class="today-sub">${state.dailyComplete ? "Carry it with you. It will return when your memory needs it." : "A small daily puzzle that changes what you notice in Arabic."}</p>
    </section>
    ${state.dailyComplete ? completedDailyCard() : unplayedDailyCard(inProgress)}
    <section class="lexicon-strip" aria-label="Learning progress">
      <div><span class="lexicon-value">${held}</span><span class="lexicon-label">roots held</span></div>
      <i></i>
      <div><span class="lexicon-value">${wordsOpened()}</span><span class="lexicon-label">words opened</span></div>
      <i></i>
      <button data-action="nav-map"><span>Open your atlas</span>${icon("map")}</button>
    </section>
    ${nav("today")}
  </main>`;
}

function unplayedDailyCard(inProgress = false) {
  const attemptsLeft = 3 - state.guesses.length;
  const mode = state.supportMode.charAt(0).toUpperCase() + state.supportMode.slice(1);
  return `<section class="daily-card premium-daily ${inProgress ? "is-progress" : ""}">
    <img class="daily-brand-emblem" src="./jadhr-logo-emblem.png" alt="" aria-hidden="true" />
    <div class="daily-topline"><div class="daily-number">${inProgress ? "Root in progress" : "Today's discovery"}</div><div class="daily-meta"><span>≈ 2 min</span><span>${mode}</span></div></div>
    <div class="daily-mystery" aria-hidden="true"><i class="tone-1"></i><i class="tone-2"></i><i class="tone-3"></i></div>
    <div class="daily-copy">
      <h3>${inProgress ? "The pattern is still here." : "Find the three consonants that survive every change."}</h3>
      <p>${inProgress ? `${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left. Your valid guesses are saved.` : "Follow the recurring sounds. Build the root. Then watch the family bloom."}</p>
    </div>
    <button class="btn daily-cta" data-action="start-hunt">${inProgress ? "Continue root" : "Begin today's root"}<span aria-hidden="true">→</span></button>
  </section>`;
}

function radicalSpans(radicals) {
  return radicals.map((ch, i) => `<span class="tone-${i + 1}">${ch}</span>`).join("");
}

function completedDailyCard() {
  const root = dailyRoot();
  const forms = root.family.length;
  return `<section class="daily-card premium-daily daily-card-complete">
    <img class="daily-brand-emblem" src="./jadhr-logo-emblem.png" alt="" aria-hidden="true" />
    <div class="daily-topline"><div class="daily-number">Today's root · learned</div><div class="daily-meta"><span class="complete-pill">Held</span></div></div>
    <div class="daily-earned-root" dir="rtl">${radicalSpans(root.radicals)}</div>
    <div class="daily-copy"><h3>${root.translit} · ${root.gloss}</h3><p>You met ${forms} form${forms === 1 ? "" : "s"} and found the same skeleton inside a Qur'anic word.</p></div>
    <div class="daily-actions"><button class="btn glass" data-action="share">Share result</button><button class="btn daily-cta" data-action="preview-echo">Test your memory<span aria-hidden="true">→</span></button></div>
  </section>`;
}

// Latin token for each Arabic radical, used to light up the transliterated evidence rows.
const LATIN_TOKEN = {
  "ا":"Ā","ب":"B","ت":"T","ث":"TH","ج":"J","ح":"Ḥ","خ":"KH","د":"D","ذ":"DH","ر":"R","ز":"Z",
  "س":"S","ش":"SH","ص":"Ṣ","ض":"Ḍ","ط":"Ṭ","ظ":"Ẓ","ع":"ʿ","غ":"GH","ف":"F","ق":"Q","ك":"K",
  "ل":"L","م":"M","ن":"N","ه":"H","و":"W","ي":"Y","ء":"ʾ",
};

function evidenceMarkup(roman) {
  const root = activeRoot();
  const selected = new Set(state.selected.map((x) => x.ar));
  // Longest tokens first so TH/KH/SH/DH/GH are not broken apart by their own second letter,
  // and mark with sentinels so later passes cannot match inside emitted markup.
  const hits = root.radicals
    .map((ar, i) => ({ ar, token: LATIN_TOKEN[ar] || "", cls: `radical-${i + 1}` }))
    .filter((h) => h.token && selected.has(h.ar))
    .sort((a, b) => b.token.length - a.token.length);

  let html = roman;
  hits.forEach((hit, i) => { html = html.replaceAll(hit.token, ` ${i} `); });
  hits.forEach((hit, i) => {
    html = html.replaceAll(` ${i} `, `<span class="evidence-hit ${hit.cls}">${hit.token}</span>`);
  });
  return html;
}

// Build the Bloom highlight from radicalAlignment rather than pre-marked HTML (audit D8):
// content carries indices, code emits markup, so a CMS can never inject tags.
function markedWord(word, radicals) {
  if (word.marked) return word.marked; // hand-authored v5 entries
  const alignment = word.alignment || [];
  const classes = new Map();
  alignment.forEach((index, i) => { if (index !== null) classes.set(index, `root-${i + 1}`); });
  return [...word.ar]
    .map((ch, i) => (classes.has(i) ? `<mark class="root-letter ${classes.get(i)}">${ch}</mark>` : ch))
    .join("");
}

function huntScreen() {
  const root = activeRoot();
  const attemptsLeft = 3 - state.guesses.length;
  const slots = state.selected.map((x) => x.ar);
  const run = state.session;
  const script = Boolean(run && run.script);
  const showLatin = state.supportMode === "guided" && !script;
  const eyebrow = !run ? "Hunt · Discovery"
    : run.mode === "challenge" ? `Challenge · ${run.index + 1} of ${run.queue.length}`
    : "Practice · no streak, no score";
  return `<main class="screen no-nav hunt-screen" data-screen="hunt">
    ${topbar({ back: run ? "end-session" : "today" })}
    <div class="challenge-progress" aria-label="Stage 1 of 4"><i class="on"></i><i></i><i></i><i></i></div>
    <section class="challenge-head">
      <div class="eyebrow">${eyebrow}</div>
      <h2>Find what repeats.</h2>
      <p>${script ? "No transliteration this time. The same three consonants are in all three words." : "The word changes. Three consonants keep their identity."}</p>
    </section>
    <section class="pattern-board" aria-label="Word family evidence">
      <div class="pattern-board-top"><span>WORD FAMILY</span><span>${script ? "Arabic only — find the skeleton" : showLatin ? "Tap a letter to trace its echo" : "Find the shared consonants"}</span></div>
      <div class="pattern-rows">
        ${script
          ? root.family.slice(0, 3).map((w, i) => `<div class="pattern-row"><span class="pattern-index">0${i+1}</span><div><div class="script-word" dir="rtl" lang="ar">${w.ar}</div><div class="gloss">${w.en}</div></div><span class="pattern-pulse" aria-hidden="true"></span></div>`).join("")
          : root.discoveryEvidence.map((w, i) => `<div class="pattern-row"><span class="pattern-index">0${i+1}</span><div><div class="roman">${evidenceMarkup(w.roman)}</div><div class="gloss">${w.gloss}</div></div><span class="pattern-pulse" aria-hidden="true"></span></div>`).join("")}
      </div>
    </section>
    <section class="root-workbench" aria-label="Build the root">
      <div class="workbench-label"><span>Your root</span><span class="attempts">${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left</span></div>
      <div class="root-rail signature-root" aria-label="Current root guess — tap a letter to remove it">
        ${[0,1,2].map((i) => rootNode(slots[i] || "", showLatin ? (state.selected[i]?.lat || "") : "", Boolean(slots[i]), "", `tone-${i+1}`, i)).join("")}
      </div>
      ${guessHistory()}
      ${state.invalidMessage ? `<div class="notice error" role="status">${state.invalidMessage}</div>` : ""}
      ${state.supportMessage ? `<div class="notice support" role="status">${state.supportMessage}</div>` : ""}
    </section>
    <section class="letter-tray" aria-label="Arabic letter pool">
      <div class="tray-label"><span>Letter pool</span><button class="text-action" data-action="hint">Need support?</button></div>
      <div class="keyboard">
        ${root.pool.map((key, index) => {
          const used = state.selected.some((x) => x.id === index);
          const learned = feedbackForLetter(key.ar);
          return `<button class="key ${used ? "used" : ""} ${learned ? `key-${learned}` : ""}" data-action="pick-letter" data-key-id="${index}" data-letter="${key.ar}" data-lat="${key.lat}" ${used ? "disabled" : ""}><span class="ar">${key.ar}</span>${showLatin ? `<span class="lat">${key.lat}</span>` : ""}</button>`;
        }).join("")}
      </div>
    </section>
    <div class="hunt-actions"><button class="btn ghost small" data-action="clear-guess" ${state.selected.length ? "" : "disabled"}>Clear</button><button class="btn primary" id="submit-root" data-action="submit-root" ${state.selected.length === 3 ? "" : "disabled"}>Lock in root</button></div>
  </main>`;
}

function feedbackLabel(value) {
  return value === "exact" ? "right letter, right position" : value === "present" ? "right letter, different position" : "not in this root";
}

function feedbackForLetter(letter) {
  let best = "";
  for (const guess of state.guesses) {
    guess.radicals.forEach((radical, index) => {
      if (radical !== letter) return;
      const feedback = guess.feedback[index];
      if (feedback === "exact") best = "exact";
      else if (feedback === "present" && best !== "exact") best = "present";
      else if (!best) best = "absent";
    });
  }
  return best;
}

function guessHistory() {
  if (!state.guesses.length) return "";
  return `<div class="guess-history" aria-label="Previous guesses">${state.guesses.map((g) => `<div class="guess-row">${g.radicals.map((r, i) => `<div class="guess-cell ${g.feedback[i]}" aria-label="${r}: ${feedbackLabel(g.feedback[i])}">${r}</div>`).join("")}</div>`).join("")}</div>`;
}

function bloomScreen() {
  const root = activeRoot();
  const count = root.family.length;
  return `<main class="screen no-nav bloom-screen" data-screen="bloom">
    ${topbar({ quiet: true })}
    <div class="challenge-progress" aria-label="Stage 2 of 4"><i class="on"></i><i class="on"></i><i></i><i></i></div>
    <section class="bloom-head"><div class="eyebrow">Bloom · Root x-ray</div><h2>The letters stayed.<br>Everything else moved.</h2><p>This is Jadhr's core view: the same three radicals remain visible through every form.</p></section>
    <section class="bloom-stage">
      <div class="bloom-root premium-root">
        <div class="root-source-label">THE ROOT</div>
        <div class="letters" dir="rtl">${radicalSpans(root.radicals)}</div>
        <div class="translit">${root.translit}</div>
        <div class="gloss">${root.gloss}</div>
      </div>
      <div class="root-beam" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="family-transform" aria-label="Derived word family">
        ${root.family.map((w, i) => `<article class="transform-word" style="--delay:${i}"><div class="transform-arabic" dir="rtl">${markedWord(w, root.radicals)}</div><div class="transform-meta"><strong>${w.tr}</strong><span>${w.en}</span></div><div class="transform-tag">same root</div></article>`).join("")}
      </div>
    </section>
    <div class="insight-card"><span class="insight-icon">✦</span><p><strong>You are not memorizing ${count} unrelated words.</strong> You are learning one semantic skeleton that Arabic keeps reusing.</p></div>
    <button class="btn primary" data-action="quran">See the root in Qur'an <span aria-hidden="true">→</span></button>
    <p class="micro center">The game layer ends before the Qur'anic encounter.</p>
  </main>`;
}

function quranScreen() {
  const root = activeRoot();
  const q = root.quran;
  const dotted = root.radicals.join(" · ");
  return `<main class="screen no-nav quran-screen" data-screen="quran">
    ${topbar({ back: "bloom", quiet: true })}
    <section class="quran-head"><div class="eyebrow">In the Qur'an</div><h2>Now meet the root<br>in its real context.</h2></section>
    <div class="quran-rule"><span></span><i></i><span></span></div>
    <p class="quran-target">The family appears here through <span lang="ar" dir="rtl">${q.target}</span>.</p>
    <article class="ayah-card">
      <div class="ayah" lang="ar" dir="rtl">${q.arabic}</div>
      <div class="translation">“${q.translation}”</div>
      <div class="citation"><span>${q.reference}</span>${q.translationSource ? `<span>${q.translationSource}</span>` : ""}</div>
    </article>
    <div class="quran-note"><span>Root lens</span><p>In the next step, you will identify ${dotted} yourself inside the longer word.</p></div>
    <p class="micro center">${QURAN_PROVENANCE.script === "uthmani" ? "Uthmani text" : "Text"} from the Quranic Arabic Corpus · translation ${QURAN_PROVENANCE.translationShort || "unattributed"}, public domain</p>
    <div class="quran-actions"><button class="btn quran-cta" data-action="spot">Spot the root</button></div>
  </main>`;
}

// The exercise form is imlāʾī, never the Uthmani rasm shown in the āyah card (spec D-2). Tiles are
// base letters only, and the alignment is recomputed against the form actually on screen.
function spotForm(root) {
  return root.quran?.spotForm || root.quran?.target || "";
}

function spotLetters(root) {
  const word = spotForm(root);
  // Corpus-derived words carry a stem-anchored alignment: a بِ prefix must not be mistaken for a
  // first radical. Recompute only for hand-authored entries that have none.
  const alignment = root.quran?.targetAlignment || alignRadicals(word, root.radicals);
  const order = new Map();
  alignment.forEach((index, i) => { if (index !== null) order.set(index, i); });
  return baseLetters(word).map((letter, id) => ({
    id,
    ar: letter.ch,
    root: order.has(letter.index),
    radical: order.get(letter.index) ?? null,
  }));
}

function spotScreen() {
  const root = activeRoot();
  const letters = spotLetters(root);
  const selected = new Set(state.spotSelected);
  const correctIds = new Set(letters.filter((x) => x.root).map((x) => x.id));
  const radicalClass = (tile) => (tile.radical === null ? "" : `radical-${tile.radical + 1}`);
  const translit = root.family.find((w) => w.tr)?.tr || root.translit;
  return `<main class="screen no-nav spot-screen" data-screen="spot">
    ${topbar({ back: "quran" })}
    <div class="challenge-progress" aria-label="Stage 3 of 4"><i class="on"></i><i class="on"></i><i class="on"></i><i></i></div>
    <section class="challenge-head"><div class="eyebrow">Spot · Transfer</div><h2>Turn on your own x-ray vision.</h2><p>Tap the three root letters inside this Qur'anic word.</p></section>
    <section class="spot-stage ${state.spotComplete ? "is-complete" : ""}">
      <div class="spot-label">${spotForm(root)}</div>
      <div class="spot-word" dir="rtl" aria-label="Qur'anic word containing the root">
        ${letters.map((l) => {
          const cls = state.spotComplete && correctIds.has(l.id) ? `correct ${radicalClass(l)}` : selected.has(l.id) ? "selected" : state.spotComplete ? "dimmed" : "";
          return `<button class="spot-letter ${cls}" data-action="spot-letter" data-id="${l.id}" ${state.spotComplete ? "disabled" : ""}>${l.ar}</button>`;
        }).join("")}
      </div>
      ${state.spotComplete ? `<div class="spot-root-readout">${root.radicals.map((ch, i) => `<span class="radical-${i + 1}">${ch}</span>`).join("<i>·</i>")}<strong>Same skeleton. New shape.</strong></div>` : `<div class="spot-instruction">Select exactly three letters</div>`}
    </section>
    ${state.spotComplete ? `<div class="notice support"><strong>${root.radicals.join(" · ")}</strong> — the same skeleton, now inside a longer word.</div>` : state.supportMessage ? `<div class="notice support">${state.supportMessage}</div>` : `<p class="micro center">Ignore the article and long-vowel letters. Find only the three radicals.</p>`}
    ${state.spotComplete ? "" : `<p class="micro center">Spelling simplified from the Qur'anic script for this exercise.</p>`}
    ${state.spotComplete ? `<button class="btn primary" data-action="finish-daily">Finish today's root</button>` : `<button class="btn primary" data-action="check-spot" ${selected.size === 3 ? "" : "disabled"}>Check my x-ray</button>`}
  </main>`;
}

function completeScreen() {
  return `<main class="screen complete-screen" data-screen="complete">
    ${topbar()}
    <section class="completion-hero">
      <div class="completion-emblem"><img src="./jadhr-logo-emblem.png" alt="" aria-hidden="true" /></div>
      <div class="eyebrow">One root held</div>
      <h1>You can see<br>more than before.</h1>
      <p>That is the win. Not the streak, not the score—the pattern is now yours to notice.</p>
    </section>
    <section class="earned-card">
      <div class="earned-top"><span>${dailyLabel().toUpperCase()}</span><span class="earned-status">MET</span></div>
      <div class="earned-root" dir="rtl">${radicalSpans(activeRoot().radicals)}</div>
      <div class="earned-translit">${activeRoot().translit}</div>
      <h3>${activeRoot().gloss}</h3>
      <div class="earned-metrics"><div><strong>${activeRoot().family.length}</strong><span>forms opened</span></div><div><strong>${state.spotComplete ? 1 : 0}</strong><span>Qur'anic form spotted</span></div></div>
    </section>
    <div class="actions stack completion-actions"><button class="btn primary" data-action="share">Share today's growth</button><button class="btn secondary" data-action="preview-echo">Preview tomorrow's Echo</button></div>
    ${nav("today")}
  </main>`;
}

function echoScreen() {
  const options = [
    { ar: "ك", lat: "k" }, { ar: "ت", lat: "t" }, { ar: "ب", lat: "b" }, { ar: "م", lat: "m" }, { ar: "ر", lat: "r" },
  ];
  const selected = state.echoSelected;
  const showLatin = state.supportMode === "guided";
  return `<main class="screen no-nav echo-screen" data-screen="echo">
    ${topbar({ back: state.dailyComplete ? "complete" : "today" })}
    <section class="challenge-head echo-head"><div class="eyebrow">Echo · Tomorrow preview</div><h2>Yesterday should feel different today.</h2><p>Recognition is the first proof that the root actually stuck.</p></section>
    <section class="echo-word-card">
      <div class="echo-memory-label">YOU'VE SEEN THIS FAMILY</div>
      <div class="echo-arabic" dir="rtl">مَكْتُوب</div><strong>maktūb</strong><span>written</span>
    </section>
    <div class="root-rail signature-root">${[0,1,2].map((i) => rootNode(selected[i]?.ar || "", showLatin ? (selected[i]?.lat || "") : "", Boolean(selected[i]), "", `tone-${i+1}`)).join("")}</div>
    <div class="keyboard echo-keyboard">${options.map((k, index) => {
      const used = selected.some((x) => x.id === index);
      return `<button class="key ${used ? "used" : ""}" data-action="echo-letter" data-key-id="${index}" data-letter="${k.ar}" data-lat="${k.lat}" ${used ? "disabled" : ""}><span class="ar">${k.ar}</span>${showLatin ? `<span class="lat">${k.lat}</span>` : ""}</button>`;
    }).join("")}</div>
    ${state.echoComplete ? `<div class="echo-success"><div class="echo-success-root" dir="rtl"><span>ك</span><span>ت</span><span>ب</span></div><p>You remembered <strong>ك · ت · ب</strong>. Yesterday changed what you can recognize today.</p></div>` : state.echoMessage ? `<div class="notice support">${state.echoMessage}</div>` : ""}
    <button class="btn primary" data-action="check-echo" ${selected.length === 3 && !state.echoComplete ? "" : "disabled"}>${state.echoComplete ? "Remembered" : "Check memory"}</button>
    ${state.echoComplete ? `<button class="btn secondary full" data-action="today">Back to Today</button>` : ""}
  </main>`;
}

function mapScreen() {
  const held = rootsHeld();
  return `<main class="screen map-screen" data-screen="map">
    ${topbar()}
    <section class="map-head"><div class="eyebrow">Root Atlas</div><h1>Watch your Arabic<br>become legible.</h1><p>This is not a trophy case. It is a map of semantic territory you can now recognize.</p></section>
    <section class="atlas-summary"><div><strong>${held}</strong><span>roots held</span></div><div><strong>${wordsOpened()}</strong><span>forms encountered</span></div><div><strong>${corpusCoverage() ?? 0}%</strong><span>of Qur'anic words</span></div></section>
    <p class="micro atlas-note">Share of the ${(CORPUS_STATS.quranCoverage?.totalRooted || 0).toLocaleString()} Qur'anic words that are built on a root you hold.</p>
    <div class="root-atlas">${atlasClusters()}</div>
    <section class="map-note"><span class="map-note-mark">✦</span><div><strong>Progress means stronger retrieval.</strong><p>Met → Recognized → Recalled → Applied. A root grows brighter only when your memory gives evidence.</p></div></section>
    ${nav("map")}
  </main>`;
}

const THEME_BLURB = {
  Knowledge: "Words for writing, knowing, learning.",
  Character: "Inner qualities made visible through action.",
  Mercy: "Care, forgiveness, and connection.",
  Worship: "How the body and tongue turn toward God.",
  Faith: "Belief, trust, and what is witnessed.",
  Speech: "Saying, calling, and being answered.",
  Perception: "Seeing, hearing, and understanding.",
  Praise: "Gratitude and what is owed.",
  Creation: "The made world and the One who made it.",
};

// The Atlas is a map, not a list. Full-width cards made it eight screens tall at 45 roots
// (measured), so clusters collapse to a one-line summary and roots render as compact chips.
// Only the field today's root belongs to is open by default; the rest expand on tap.
function atlasClusters() {
  const byTheme = new Map();
  for (const entry of Object.values(ROOTS)) {
    const theme = entry.theme || "Other";
    if (!byTheme.has(theme)) byTheme.set(theme, []);
    byTheme.get(theme).push(entry);
  }
  const todaysTheme = dailyRoot().theme;
  const open = new Set(state.atlasOpen?.length ? state.atlasOpen : [todaysTheme]);

  const ordered = [...byTheme.entries()].sort((a, b) => {
    const metA = a[1].filter((r) => state.map[r.id]).length;
    const metB = b[1].filter((r) => state.map[r.id]).length;
    return metB - metA || a[0].localeCompare(b[0]);
  });

  return ordered.map(([theme, roots]) => {
    const met = roots.filter((r) => state.map[r.id]);
    const isOpen = open.has(theme);
    const body = isOpen
      ? `<div class="cluster-roots">${
          [...met.map((r) => mapRoot(r, state.map[r.id])),
           ...roots.filter((r) => !state.map[r.id]).map((r) => lockedRoot(r))].join("")
        }</div>`
      : "";
    return `<section class="atlas-cluster ${isOpen ? "is-open" : ""}">
      <button class="cluster-head" data-action="toggle-cluster" data-theme="${theme}" aria-expanded="${isOpen}">
        <span class="cluster-title"><span class="eyebrow">Semantic field</span><h3>${theme}</h3></span>
        <span class="cluster-meta"><b>${met.length}</b>/${roots.length}<i class="cluster-caret" aria-hidden="true"></i></span>
      </button>
      ${body}
    </section>`;
  }).join("");
}

function mapRoot(root, stage) {
  const stages = ["met", "recognized", "recalled", "applied"];
  const idx = stage ? stages.indexOf(stage) : -1;
  return `<button class="root-chip stage-${stage}" data-action="root-detail" data-root="${root.id}" style="--mastery:${idx + 1}" title="${root.translit} · ${stage}">
    <span class="chip-root" dir="rtl">${root.radicals.join("")}</span>
    <span class="chip-copy"><strong>${root.translit}</strong><em>${stage}</em></span>
    <span class="chip-dots" aria-label="${stage}">${stages.map((_, i) => `<i class="${i <= idx ? "on" : ""}"></i>`).join("")}</span>
  </button>`;
}

function lockedRoot(root) {
  return `<div class="root-chip locked" title="Not met yet">
    <span class="chip-root" dir="rtl">${root.radicals.join("")}</span>
    <span class="chip-copy"><strong>${root.translit}</strong><em>Not met yet</em></span>
  </div>`;
}

function atlasCluster(title, description, items) {
  return `<section class="atlas-cluster"><div class="cluster-head"><div><span class="eyebrow">Semantic field</span><h3>${title}</h3></div><p>${description}</p></div><div class="cluster-roots">${items.join("")}</div></section>`;
}

function exploreScreen() {
  const pool = sessionPool().length;
  const log = state.practiceLog || { played: 0, solved: 0 };
  const best = state.challengeBest || 0;
  return `<main class="screen explore-screen" data-screen="explore">
    ${topbar()}
    <section class="map-head"><div class="eyebrow">Explore</div><h1>Go further<br>when curiosity wins.</h1><p>No review debt. No energy meter. The Daily is one root and then it ends — this is where you go if that was not enough.</p></section>
    <section class="next-move-card">
      <div class="next-badge">Practice</div>
      <h2>Any root, as many as you like.</h2>
      <p>${pool} roots to choose from, minus today's — meeting it here would spend the Daily before you played it. Practice keeps no streak and produces no share card${log.played ? `. You have practised ${log.played} root${log.played === 1 ? "" : "s"}, solving ${log.solved}` : ""}.</p>
      <button class="btn primary" data-action="open-practice">Choose a root</button>
    </section>
    <section class="next-move-card">
      <div class="next-badge">Challenge</div>
      <h2>Five roots. Arabic only.</h2>
      <p>The evidence board drops its transliteration, so you read the family in script and find the skeleton yourself. One miss ends the run.${best ? ` Your best is ${best} of ${CHALLENGE_LENGTH}.` : ""}</p>
      <button class="btn primary" data-action="open-challenge">Start a run</button>
    </section>
    ${nav("explore")}
  </main>`;
}

function historyScreen() {
  return `<main class="screen history-screen" data-screen="history">
    ${topbar()}
    <section class="map-head"><div class="eyebrow">History</div><h1>Nothing<br>expires.</h1><p>Your learning waits without judgment. Come back after a day, a week, or a season.</p></section>
    <div class="history-line">
      <article class="history-entry is-today"><span class="history-dot"></span><div class="history-date">TODAY · DAILY 001</div><div class="history-root" dir="rtl">ص · ب · ر</div><div><strong>patience · steadfastness</strong><span>${state.dailyComplete ? "Completed · Met" : state.dailyStarted ? "In progress" : "Ready when you are"}</span></div></article>
      <article class="history-entry"><span class="history-dot"></span><div class="history-date">WELCOME LESSON</div><div class="history-root" dir="rtl">ك · ت · ب</div><div><strong>writing · inscription</strong><span>${state.map.ktb === "recognized" ? "Recognized later" : "Met"}</span></div></article>
    </div>
    <section class="gentle-return"><span>Missed a week?</span><p>There is no backlog waiting to punish you. Jadhr simply chooses one useful Echo when you return.</p></section>
    ${nav("history")}
  </main>`;
}

function settingsSheet() {
  if (state.modal !== "settings") return "";
  const modes = [["guided", "Guided", "Arabic + Latin labels"],["standard", "Standard", "Arabic letter pool"],["recall", "Recall", "Minimal scaffolding"]];
  return `<div class="modal-backdrop" data-action="close-modal"><section class="sheet" role="dialog" aria-modal="true" aria-label="Learning support">
    <div class="sheet-handle"></div><div class="eyebrow">Learning support</div><h2>Choose your scaffolding.</h2><p>Difficulty should come from language knowledge, not from fighting the interface.</p>
    <div class="mode-picker">${modes.map(([id,label,desc]) => `<button class="mode-option ${state.supportMode === id ? "active" : ""}" data-action="set-support" data-mode="${id}"><span><strong>${label}</strong><small>${desc}</small></span><i></i></button>`).join("")}</div>
    <div class="setting-note"><span>Motion</span><strong>Follows system preference</strong></div><div class="setting-note"><span>Game sounds</span><strong>Prototype silent</strong></div>
    <button class="btn primary" data-action="close-modal">Done</button><button class="btn ghost small reset-link" data-action="reset-prototype">Reset prototype</button>
    <div class="publisher-signature"><span class="publisher-root-mark" aria-hidden="true"><i></i><i></i><i></i></span><span>an <strong>Inheriting Islam</strong> app</span></div>
  </section></div>`;
}

function shareSheet() {
  if (state.modal !== "share") return "";
  const opened = state.dailyComplete ? dailyRoot().family.length : 0;
  const number = dailyNumber();
  const share = buildShareText({ day: number, guesses: state.guesses.map((g) => g.feedback), solved: state.solved, familyWords: opened, remembered: state.map.ktb === "recognized" ? 1 : 0 });
  return `<div class="modal-backdrop" data-action="close-modal"><section class="sheet share-sheet" role="dialog" aria-modal="true" aria-label="Share result">
    <div class="sheet-handle"></div><div class="share-brand"><img src="./jadhr-logo-emblem.png" alt="" aria-hidden="true" /><div><strong>Jadhr</strong><span>${dailyLabel()} · Root by root</span></div></div>
    <h2>Share the growth.<br>Keep the root secret.</h2>
    <div class="share-artifact">
      <div class="share-artifact-head"><span>JADHR · ${String(number).padStart(3, "0")}</span><span>${state.solved ? `FOUND IN ${state.guesses.length}` : "LEARNED TODAY"}</span></div>
      <div class="share-radicals" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="share-grid">${state.guesses.length ? state.guesses.map(g => `<div>${g.feedback.map(f => `<i class="${f}"></i>`).join("")}</div>`).join("") : `<div><i></i><i></i><i></i></div>`}</div>
      <div class="share-growth"><span><strong>${opened}</strong> words opened</span><span><strong>${state.map.ktb === "recognized" ? 1 : 0}</strong> old roots remembered</span></div>
      <div class="share-publisher">an <strong>Inheriting Islam</strong> app</div>
    </div>
    <div class="share-box" id="share-text">${escapeHtml(share)}</div>
    <button class="btn primary" data-action="copy-share">Copy result</button><button class="btn secondary full" data-action="close-modal">Close</button>
  </section></div>`;
}

function rootDetailSheet() {
  if (!state.modal?.startsWith("root:")) return "";
  const id = state.modal.split(":")[1];
  const r = ROOTS[id];
  return `<div class="modal-backdrop" data-action="close-modal"><section class="sheet root-sheet" role="dialog" aria-modal="true" aria-label="Root details">
    <div class="sheet-handle"></div><div class="eyebrow">Root family</div>
    <div class="detail-root" dir="rtl">${r.radicals.map((x,i) => `<span class="tone-${i+1}">${x}</span>`).join("")}</div><div class="detail-translit">${r.translit}</div><h2>${r.gloss}</h2>
    <div class="detail-family">${r.family.slice(0,4).map((w) => `<div class="detail-word"><span dir="rtl">${w.marked}</span><div><strong>${w.tr}</strong><small>${w.en}</small></div></div>`).join("")}</div>
    <button class="btn primary" data-action="close-modal">Done</button>
  </section></div>`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
}

function render() {
  let html;
  switch (state.screen) {
    case "onboarding-intro": html = onboardingIntro(); break;
    case "onboarding-family": html = onboardingFamily(); break;
    case "today": html = todayScreen(); break;
    case "hunt": html = huntScreen(); break;
    case "bloom": html = bloomScreen(); break;
    case "quran": html = quranScreen(); break;
    case "spot": html = spotScreen(); break;
    case "complete": html = completeScreen(); break;
    case "echo": html = echoScreen(); break;
    case "map": html = mapScreen(); break;
    case "explore": html = exploreScreen(); break;
    case "practice": html = practiceScreen(); break;
    case "challenge-intro": html = challengeIntroScreen(); break;
    case "challenge-result": html = challengeResultScreen(); break;
    case "history": html = historyScreen(); break;
    default: html = todayScreen();
  }
  app.innerHTML = html + settingsSheet() + shareSheet() + rootDetailSheet();
  if (new URLSearchParams(location.search).get("qa") === "1" && !document.querySelector("#qa-results")) {
    // QA runner appends its own panel asynchronously.
  }
}

function resetTransientForHunt() {
  return { selected: [], guesses: [], invalidMessage: "", supportMessage: "", hintUsed: false, solved: false, rootRevealed: false };
}

function handleAction(action, el) {
  if (!action) return;
  if (action === "onboarding-family") return setState({ screen: "onboarding-family" }, false);
  if (action === "onboarding-intro") return setState({ screen: "onboarding-intro" }, false);
  if (action === "start-first-daily") return setState({ ...resetTransientForHunt(), onboardingDone: true, dailyStarted: true, checkpoint: "hunt", screen: "hunt" });
  if (action === "start-hunt") return state.dailyStarted && !state.dailyComplete ? setState({ screen: state.checkpoint || "hunt", selected: [], invalidMessage: "" }, false) : setState({ ...resetTransientForHunt(), dailyStarted: true, checkpoint: "hunt", screen: "hunt" });
  if (action === "today" || action === "nav-today") return setState({ ...(state.session ? resetRun() : {}), screen: "today", modal: null, session: null }, Boolean(state.session));
  if (action === "nav-map") return setState({ screen: "map", modal: null }, false);
  if (action === "nav-explore") return setState({ screen: "explore", modal: null, session: null }, false);
  if (action === "open-practice") return setState({ ...resetRun(), session: null, screen: "practice", modal: null });
  if (action === "start-practice") {
    const id = el.dataset.root;
    if (!ROOTS[id]) return;
    return setState({ ...resetRun(), session: { mode: "practice", queue: [id], index: 0, solved: 0, script: false }, screen: "hunt" });
  }
  if (action === "open-challenge") return setState({ ...resetRun(), session: null, screen: "challenge-intro", modal: null });
  if (action === "start-challenge") {
    const queue = newChallengeQueue();
    if (!queue.length) return;
    return setState({ ...resetRun(), session: { mode: "challenge", queue, index: 0, solved: 0, script: true }, screen: "hunt" });
  }
  if (action === "end-session") {
    const run = state.session;
    const patch = { ...resetRun(), session: null, screen: run?.mode === "challenge" ? "explore" : "practice" };
    if (run?.mode === "practice") {
      patch.practiceLog = { played: (state.practiceLog?.played || 0) + 1, solved: (state.practiceLog?.solved || 0) + (state.solved ? 1 : 0) };
    }
    if (run?.mode === "challenge" && !run.done) patch.challengeBest = Math.max(state.challengeBest || 0, run.solved || 0);
    return setState(patch);
  }
  if (action === "nav-history") return setState({ screen: "history", modal: null }, false);
  if (action === "open-settings") return setState({ modal: "settings" }, false);
  if (action === "close-modal") return setState({ modal: null }, false);
  if (action === "share") return setState({ modal: "share" }, false);
  if (action === "root-detail") return setState({ modal: `root:${el.dataset.root}` }, false);
  if (action === "set-support") return setState({ supportMode: el.dataset.mode }, true);
  if (action === "toggle-cluster") {
    const theme = el.dataset.theme;
    const current = state.atlasOpen?.length ? state.atlasOpen : [dailyRoot().theme];
    const next = current.includes(theme) ? current.filter((t) => t !== theme) : [...current, theme];
    return setState({ atlasOpen: next.length ? next : ["__none__"] }, false);
  }

  if (action === "pick-letter") {
    if (state.selected.length >= 3) return;
    if (navigator.vibrate) navigator.vibrate(7);
    return setState({ selected: [...state.selected, { id: Number(el.dataset.keyId), ar: el.dataset.letter, lat: el.dataset.lat }], invalidMessage: "" }, false);
  }
  if (action === "clear-guess") return setState({ selected: [], invalidMessage: "" }, false);
  if (action === "unpick-letter") {
    if (state.solved || state.guesses.length >= 3) return;
    const idx = Number(el.dataset.idx);
    return setState({ selected: state.selected.filter((_, i) => i !== idx), invalidMessage: "" }, false);
  }
  if (action === "hint") {
    const first = activeRoot().radicals[0];
    const lat = activeRoot().pool.find((k) => k.ar === first)?.lat || "";
    return setState({ hintUsed: true, supportMessage: `Support: the first radical is ${first}${lat ? ` (${lat})` : ""}. Taking support does not reduce your score or shame the result.` }, false);
  }
  if (action === "submit-root") return submitRoot();
  if (action === "bloom") return setState({ screen: "bloom", checkpoint: "bloom" });
  if (action === "quran") return setState({ screen: "quran", checkpoint: "quran" });
  if (action === "spot") return setState({ screen: "spot", checkpoint: "spot", spotSelected: [], spotComplete: false, supportMessage: "" });

  if (action === "spot-letter") {
    if (state.spotComplete) return;
    const id = Number(el.dataset.id);
    const exists = state.spotSelected.includes(id);
    let next = exists ? state.spotSelected.filter((x) => x !== id) : [...state.spotSelected, id];
    if (next.length > 3) next = next.slice(1);
    return setState({ spotSelected: next }, false);
  }
  if (action === "check-spot") return checkSpot();
  if (action === "finish-daily") {
    // A practice run finishes into the practice screen and records nothing but its own
    // tally: no streak, no atlas entry, no share. The Daily stays the only thing the
    // record is a record OF.
    if (state.session) {
      return setState({ ...resetRun(), session: null, screen: "practice",
        practiceLog: { played: (state.practiceLog?.played || 0) + 1, solved: (state.practiceLog?.solved || 0) + 1 } });
    }
    return setState({ dailyComplete: true, dailyStarted: true, checkpoint: null, screen: "complete", map: { ...state.map, [dailyRootId()]: state.map[dailyRootId()] || "met" } });
  }
  if (action === "preview-echo") return setState({ screen: "echo", echoSelected: [], echoComplete: false, echoMessage: "" }, false);
  if (action === "echo-letter") {
    if (state.echoSelected.length >= 3) return;
    return setState({ echoSelected: [...state.echoSelected, { id: Number(el.dataset.keyId), ar: el.dataset.letter, lat: el.dataset.lat }], echoMessage: "" }, false);
  }
  if (action === "check-echo") return checkEcho();
  if (action === "copy-share") return copyShare(el);
  if (action === "reset-prototype") {
    localStorage.removeItem("jadhr-prototype-state");
    state = defaultState();
    return render();
  }
}

function submitRoot() {
  if (state.selected.length !== 3) return;
  if (state.solved || state.guesses.length >= 3) return; // Hunt is over — no further submissions (D1)
  const radicals = state.selected.map((x) => x.ar);
  const resolution = resolveRootSubmission({ target: activeRoot().radicals, selected: radicals, acceptedKeys: ACCEPTED, priorGuesses: state.guesses });

  if (resolution.status === "invalid") {
    // Keep the selection — a typo in one radical should not cost re-entering all three (D5).
    return setState({ invalidMessage: "Not in Jadhr's root lexicon yet. This attempt does not count." }, false);
  }
  if (resolution.status === "incomplete") return;

  if (resolution.status === "solved") {
    state = { ...state, guesses: resolution.guesses, solved: true, selected: [], invalidMessage: "", checkpoint: "bloom" };
    persist();
    render();
    if (state.session?.mode === "challenge") {
      const run = { ...state.session, solved: state.session.solved + 1 };
      window.setTimeout(() => advanceChallenge(run), 340);
      return;
    }
    window.setTimeout(() => setState({ screen: "bloom" }), 340);
    return;
  }

  if (resolution.exhausted) {
    state = { ...state, guesses: resolution.guesses, solved: false, rootRevealed: true, selected: [], invalidMessage: "", checkpoint: "bloom" };
    persist();
    render();
    if (state.session?.mode === "challenge") {
      window.setTimeout(() => setState({ session: { ...state.session, over: true }, screen: "bloom" }), 460);
      return;
    }
    window.setTimeout(() => setState({ screen: "bloom" }), 460);
    return;
  }
  return setState({ guesses: resolution.guesses, selected: [], invalidMessage: "", supportMessage: resolution.guesses.length === 1 ? "One radical clue is available whenever you want it." : state.supportMessage });
}

function resetRun() {
  return { ...resetTransientForHunt(), guesses: [], selected: [], solved: false, rootRevealed: false,
    invalidMessage: "", supportMessage: "", hintUsed: false, spotSelected: [], spotComplete: false };
}

function advanceChallenge(run) {
  if (run.index + 1 >= run.queue.length) {
    return setState({
      session: { ...run, index: run.index, done: true },
      challengeBest: Math.max(state.challengeBest || 0, run.solved),
      screen: "challenge-result",
    });
  }
  return setState({ ...resetRun(), session: { ...run, index: run.index + 1 }, screen: "hunt" });
}

function practiceScreen() {
  const log = state.practiceLog || { played: 0, solved: 0 };
  const byTheme = new Map();
  for (const id of sessionPool()) {
    const root = ROOTS[id];
    const theme = root.theme || "Other";
    if (!byTheme.has(theme)) byTheme.set(theme, []);
    byTheme.get(theme).push(root);
  }
  const groups = [...byTheme.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return `<main class="screen practice-screen" data-screen="practice">
    ${topbar({ back: "nav-explore" })}
    <section class="map-head">
      <div class="eyebrow">Practice</div>
      <h1>Pick a root.<br>Play it properly.</h1>
      <p>The full four stages — hunt, bloom, the āyah, the x-ray — for any root but today's. Nothing here touches your streak, your atlas or your share card.${log.played ? ` <strong>${log.solved}/${log.played}</strong> solved so far.` : ""}</p>
    </section>
    ${groups.map(([theme, roots]) => `<section class="practice-group">
      <div class="practice-theme">${theme}</div>
      <div class="practice-grid">
        ${roots.map((r) => `<button class="practice-chip" data-action="start-practice" data-root="${r.id}">
          <span class="chip-root" dir="rtl" lang="ar">${r.radicals.join("")}</span>
          <span class="chip-translit">${r.translit}</span>
        </button>`).join("")}
      </div>
    </section>`).join("")}
    ${nav("explore")}
  </main>`;
}

function challengeIntroScreen() {
  const best = state.challengeBest || 0;
  return `<main class="screen no-nav challenge-intro-screen" data-screen="challenge-intro">
    ${topbar({ back: "nav-explore" })}
    <section class="challenge-head">
      <div class="eyebrow">Challenge</div>
      <h2>Five roots.<br>Arabic only.</h2>
      <p>Every other screen in Jadhr shows you the family in transliteration, where the three consonants are legible in Latin capitals. Here they are not. You read the words in script and find the skeleton that survives all three.</p>
    </section>
    <section class="next-move-card">
      <h3>The rules</h3>
      <p>Three attempts per root, as always. Solve it and the next one arrives — no bloom, no verse, just the next hunt. <strong>One miss ends the run.</strong> Losing still shows you the root, because losing never costs you the root.</p>
      <p>Nothing here touches the Daily.${best ? ` Your best run is <strong>${best} of ${CHALLENGE_LENGTH}</strong>.` : ""}</p>
    </section>
    <div class="hunt-actions"><button class="btn ghost small" data-action="nav-explore">Back</button><button class="btn primary" data-action="start-challenge">Start the run</button></div>
  </main>`;
}

function challengeResultScreen() {
  const run = state.session || { solved: 0, queue: [] };
  const perfect = run.solved >= CHALLENGE_LENGTH;
  return `<main class="screen no-nav challenge-result-screen" data-screen="challenge-result">
    ${topbar({ quiet: true })}
    <section class="completion-hero">
      <div class="eyebrow">Challenge complete</div>
      <h1>${perfect ? "All five.<br>In script." : `${run.solved} of ${CHALLENGE_LENGTH}.`}</h1>
      <p>${perfect ? "You read five families in Arabic and found every skeleton. That is the skill the Daily is quietly building." : "Every root you met is still yours — the ones you missed are in Practice whenever you want them."}</p>
    </section>
    <section class="earned-card">
      <div class="earned-top"><span>THIS RUN</span><span class="earned-status">${run.solved}/${CHALLENGE_LENGTH}</span></div>
      <div class="challenge-run">
        ${run.queue.map((id, i) => {
          const r = ROOTS[id];
          const done = i < run.solved;
          return `<div class="run-row ${done ? "run-hit" : "run-miss"}"><span class="run-root" dir="rtl" lang="ar">${r.radicals.join("")}</span><span class="run-translit">${r.translit}</span><span class="run-gloss">${r.gloss}</span></div>`;
        }).join("")}
      </div>
    </section>
    <div class="hunt-actions"><button class="btn ghost small" data-action="nav-explore">Done</button><button class="btn primary" data-action="start-challenge">Run again</button></div>
  </main>`;
}

function checkSpot() {
  const correct = spotLetters(activeRoot()).filter((l) => l.root).map((l) => l.id);
  const ok = isCorrectSpotSelection(state.spotSelected, correct);
  if (ok) return setState({ spotComplete: true }, false);
  return setState({ spotSelected: [], supportMessage: `Look past the article and long-vowel letters. Find ${activeRoot().translit.replaceAll("–", " · ")}.` }, false);
}

// Echo is pinned to the onboarding root (k–t–b) until the scheduler picks the due item (M3).
function checkEcho() {
  const radicals = state.echoSelected.map((x) => x.ar);
  const ok = isExactRootSelection(radicals, ROOTS.ktb.radicals);
  if (ok) return setState({ echoComplete: true, echoMessage: "", map: { ...state.map, ktb: "recognized" } });
  return setState({ echoSelected: [], echoMessage: "Not quite. Look for the consonants shared by kitāb, kātib, and maktūb." }, false);
}

async function copyShare(button) {
  const text = document.querySelector("#share-text")?.textContent || "";
  let copied = false;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { copied = document.execCommand("copy"); } catch { copied = false; }
    ta.remove();
  }
  button.textContent = copied ? "Copied" : "Select and copy above";
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  if (target.classList.contains("modal-backdrop") && event.target !== target) return;
  handleAction(target.dataset.action, target);
});

render();

// Browser-level smoke test. It drives the actual rendered controls so Chromium can verify the state machine.
async function runBrowserQA() {
  const results = [];
  const assert = (name, condition) => results.push({ name, pass: Boolean(condition) });
  const click = (selector) => {
    const node = document.querySelector(selector);
    if (!node) throw new Error(`Missing selector: ${selector}`);
    node.click();
  };
  const delay = (ms = 10) => new Promise((r) => setTimeout(r, ms));

  localStorage.removeItem("jadhr-prototype-state");
  state = defaultState(); render();
  assert("Starts at onboarding", document.querySelector('[data-screen="onboarding-intro"]'));

  click("#start-onboarding");
  assert("Family explanation renders", document.querySelector('[data-screen="onboarding-family"]'));
  click("#continue-family");
  assert("Discovery Hunt renders", document.querySelector('[data-screen="hunt"]'));

  // Unknown root: س ت ل is deliberately not in demo lexicon and must not burn an attempt.
  for (const l of ["س","ت","ل"]) click(`[data-action="pick-letter"][data-letter="${l}"]`);
  click("#submit-root");
  assert("Unknown root rejected", state.guesses.length === 0 && Boolean(state.invalidMessage));
  assert("Rejected guess stays on the rail for editing", state.selected.length === 3);

  // Edit the last radical rather than retyping all three, then submit a valid wrong root.
  click('[data-action="unpick-letter"][data-idx="2"]');
  assert("A radical can be removed from the rail", state.selected.length === 2);
  click('[data-action="pick-letter"][data-letter="ر"]');
  click("#submit-root");
  assert("Valid wrong root burns one attempt", state.guesses.length === 1);
  assert("Hint becomes usable", Boolean(document.querySelector('[data-action="hint"]')));
  click('[data-action="hint"]');
  assert("Support does not burn attempt", state.guesses.length === 1 && state.hintUsed === true);

  // Solve with actual pool buttons.
  click('[data-action="clear-guess"]');
  for (const l of ["ص","ب","ر"]) click(`[data-action="pick-letter"][data-letter="${l}"]`);
  click("#submit-root");
  await delay(420);
  assert("Correct root reaches Bloom", document.querySelector('[data-screen="bloom"]'));
  assert("Solved state retained", state.solved === true && state.guesses.length === 2);
  assert("Solved Hunt records a resume checkpoint", state.checkpoint === "bloom");

  click('[data-action="quran"]');
  assert("Qur'an is a separate screen", document.querySelector('[data-screen="quran"]'));
  // Scope to rendered screen text: document.body.textContent also contains this file's own source
  // in the standalone bundle, which made this assertion self-defeating there.
  const quranText = document.querySelector('[data-screen="quran"]')?.textContent || "";
  assert("Qur'an screen has no score UI", !document.querySelector(".guess-history") && !/\bXP\b|streak|points|score/i.test(quranText));

  // D1: a reload mid-Daily must resume at the checkpoint, not back in the Hunt.
  persist();
  state = loadState();
  render();
  assert("Reload mid-Daily resumes at Qur'an, not the Hunt", document.querySelector('[data-screen="quran"]'));

  click('[data-action="spot"]');
  assert("Spot flags the simplified spelling", document.body.textContent.includes("Spelling simplified"));
  // Tile ids are positions in the exercise form, so read them off the day's root.
  for (const tile of spotLetters(activeRoot()).filter((l) => l.root)) {
    click(`[data-action="spot-letter"][data-id="${tile.id}"]`);
  }
  click('[data-action="check-spot"]');
  assert("Spot challenge recognizes root", state.spotComplete === true);
  click('[data-action="finish-daily"]');
  assert("Daily completion updates mastery", state.dailyComplete === true && state.map.sbr === "met");

  click('[data-action="preview-echo"]');
  for (const l of ["ك","ت","ب"]) click(`[data-action="echo-letter"][data-letter="${l}"]`);
  click('[data-action="check-echo"]');
  assert("Echo upgrades KTB to recognized", state.echoComplete === true && state.map.ktb === "recognized");

  setState({ screen: "map" }, false);
  assert("Root Atlas lists the semantic fields", document.querySelectorAll(".atlas-cluster").length >= 2);
  assert("Root Atlas opens exactly one field by default", document.querySelectorAll(".atlas-cluster.is-open").length === 1);
  click('[data-action="toggle-cluster"][data-theme="Knowledge"]');
  assert("Expanding a field reveals its roots as chips", document.querySelectorAll(".root-chip:not(.locked)").length >= 1);

  // Persistence smoke check.
  persist();
  const raw = JSON.parse(localStorage.getItem("jadhr-prototype-state"));
  assert("Completion persists to localStorage", raw.dailyComplete === true && raw.map.ktb === "recognized");

  const panel = document.createElement("section");
  panel.id = "qa-results";
  panel.className = "qa-panel";
  panel.innerHTML = `<strong>Browser QA: ${results.filter(r => r.pass).length}/${results.length} passed</strong>` +
    results.map(r => `<div class="${r.pass ? "qa-pass" : "qa-fail"}">${r.pass ? "PASS" : "FAIL"} — ${r.name}</div>`).join("");
  app.appendChild(panel);
  document.title = results.every((r) => r.pass) ? "QA PASS — Jadhr" : "QA FAIL — Jadhr";
}

if (new URLSearchParams(location.search).get("qa") === "1") {
  runBrowserQA().catch((error) => {
    const panel = document.createElement("section");
    panel.id = "qa-results"; panel.className = "qa-panel qa-fail"; panel.textContent = `QA ERROR — ${error.message}`;
    app.appendChild(panel); document.title = "QA FAIL — Jadhr";
  });
}
