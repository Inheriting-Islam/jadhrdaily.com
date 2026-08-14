export const ROOT_STAGES = ["met", "recognized", "recalled", "applied"];

// Matching-only normalization \u2014 never applied to displayed text (REVISED_PRODUCT_SPEC D-2).
// Beyond diacritic/tatweel stripping: alif-wasla folds to alif, hamza seats fold to the bare
// radical hamza, alif-maqsura folds to ya, ta-marbuta to ha. Content must not use \u0622 as a radical
// tile \u2014 a radical is a single consonant, and \u0622 encodes hamza + long a.
export function normalizeArabicInput(value = "") {
  return value
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/\u0640/g, "")
    .replace(/\u0671/g, "\u0627") // \u0671 \u2192 \u0627
    .replace(/[\u0623\u0625\u0624\u0626]/g, "\u0621") // \u0623 \u0625 \u0624 \u0626 \u2192 \u0621
    .replace(/\u0649/g, "\u064A") // \u0649 \u2192 \u064A
    .replace(/\u0629/g, "\u0647") // \u0629 \u2192 \u0647
    .trim();
}

export function rootKey(radicals) {
  return radicals.map(normalizeArabicInput).join("");
}

// Wordle-style multiset evaluation. Exact matches consume inventory first.
export function evaluateRootGuess(target, guess) {
  if (!Array.isArray(target) || !Array.isArray(guess) || target.length !== 3 || guess.length !== 3) {
    throw new Error("Root evaluation requires exactly three target and guess radicals.");
  }

  const normalizedTarget = target.map(normalizeArabicInput);
  const normalizedGuess = guess.map(normalizeArabicInput);
  const result = Array(3).fill("absent");
  const remaining = new Map();

  for (let i = 0; i < 3; i += 1) {
    if (normalizedGuess[i] === normalizedTarget[i]) {
      result[i] = "exact";
    } else {
      remaining.set(normalizedTarget[i], (remaining.get(normalizedTarget[i]) || 0) + 1);
    }
  }

  for (let i = 0; i < 3; i += 1) {
    if (result[i] === "exact") continue;
    const radical = normalizedGuess[i];
    const count = remaining.get(radical) || 0;
    if (count > 0) {
      result[i] = "present";
      remaining.set(radical, count - 1);
    }
  }

  return result;
}

export function isSolved(feedback) {
  return feedback.length === 3 && feedback.every((item) => item === "exact");
}

export function isAcceptedRoot(radicals, acceptedKeys) {
  return acceptedKeys.has(rootKey(radicals));
}

export function nextMasteryStage(stage, challengeType, usedStrongSupport = false) {
  const currentIndex = ROOT_STAGES.indexOf(stage);
  const current = currentIndex >= 0 ? currentIndex : 0;
  if (usedStrongSupport) return ROOT_STAGES[current];

  const required = {
    discovery: 0,
    recognition: 1,
    recall: 2,
    extraction: 3,
  }[challengeType];

  if (required == null) return ROOT_STAGES[current];
  return ROOT_STAGES[Math.max(current, Math.min(required, current + 1))];
}

export function scheduleIntervalDays(stage, successful = true) {
  const success = { met: 1, recognized: 3, recalled: 7, applied: 30 };
  const retry = { met: 1, recognized: 1, recalled: 3, applied: 7 };
  return (successful ? success : retry)[stage] ?? 1;
}


export function resolveRootSubmission({ target, selected, acceptedKeys, priorGuesses = [] }) {
  if (!Array.isArray(selected) || selected.length !== 3) {
    return { status: "incomplete", guesses: priorGuesses };
  }
  if (!isAcceptedRoot(selected, acceptedKeys)) {
    return { status: "invalid", guesses: priorGuesses };
  }
  const feedback = evaluateRootGuess(target, selected);
  const guesses = [...priorGuesses, { radicals: [...selected], feedback }];
  return {
    status: isSolved(feedback) ? "solved" : "wrong",
    feedback,
    guesses,
    exhausted: !isSolved(feedback) && guesses.length >= 3,
  };
}

// Combining marks and joiners that are never radicals.
const COMBINING = /[ً-ٰٕـۖ-ۭٖ-ٟ]/;

export function isCombiningMark(ch) { return COMBINING.test(ch); }

// Base letters with their index into the original string, so alignment survives tashkīl
// (doc 11: never use raw offsets when combining marks are present).
export function baseLetters(text = "") {
  const out = [];
  [...text].forEach((ch, index) => {
    if (COMBINING.test(ch) || ch === " ") return;
    out.push({ ch, index });
  });
  return out;
}

// Walk a word left to right consuming radicals in order. Returns one entry per radical: the
// string index where it surfaces, or null when it does not (weak, assimilated, or elided).
export function alignRadicals(word, radicals) {
  const letters = baseLetters(word);
  const alignment = [];
  let cursor = 0;
  for (const radical of radicals) {
    let found = null;
    for (let i = cursor; i < letters.length; i += 1) {
      if (normalizeArabicInput(letters[i].ch) === normalizeArabicInput(radical)) {
        found = letters[i].index;
        cursor = i + 1;
        break;
      }
    }
    alignment.push(found);
  }
  return alignment;
}

// Day 0 of the Jadhr calendar. Puzzle numbers and the Daily rotation are both derived from it, so
// every player on a given local date gets the same root without a server.
export const EPOCH = "2026-02-17";

function dayIndex(date) {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00`) : date;
  const local = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const epoch = new Date(`${EPOCH}T00:00:00`);
  const start = Date.UTC(epoch.getFullYear(), epoch.getMonth(), epoch.getDate());
  return Math.floor((local - start) / 86400000);
}

export function puzzleNumber(date) {
  return dayIndex(date) + 1;
}

// Deterministic rotation: walk the ordered pool with a stride coprime to its length so
// consecutive days are far apart in the list, and every root appears once per cycle.
export function selectDailyRoot(pool, date) {
  if (!pool.length) return null;
  const n = pool.length;
  let stride = Math.floor(n / 2) + 1;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  while (gcd(stride, n) !== 1) stride += 1;
  const index = dayIndex(date);
  return pool[(((index * stride) % n) + n) % n];
}

export function isCorrectSpotSelection(selectedIds, correctIds) {
  if (!Array.isArray(selectedIds) || !Array.isArray(correctIds) || selectedIds.length !== correctIds.length) return false;
  const a = [...selectedIds].sort((x, y) => x - y);
  const b = [...correctIds].sort((x, y) => x - y);
  return a.every((x, i) => x === b[i]);
}

export function isExactRootSelection(selected, target) {
  return Array.isArray(selected) && Array.isArray(target) && selected.length === target.length && selected.every((x, i) => normalizeArabicInput(x) === normalizeArabicInput(target[i]));
}

export function buildShareText({ day = 1, guesses = [], solved = false, familyWords = 0, remembered = 0 }) {
  const icon = { exact: "●", present: "↔", absent: "×" };
  const grid = guesses.map((row) => row.map((cell) => icon[cell] || "·").join("  ")).join("\n");
  const outcome = solved ? `Found in ${guesses.length}` : "Learned today";
  return [
    `JADHR · ${day}`,
    "",
    grid || "·  ·  ·",
    "",
    outcome,
    `${remembered} old root${remembered === 1 ? "" : "s"} remembered`,
    `${familyWords} family words opened`,
  ].join("\n");
}
