// Before & After: game logic.
// Puzzle data lives in data.js, more-phrases.js and topics-1.js through topics-4.js.
const VALUES = [200, 400, 600, 800, 1000];
const CATEGORY_TAGS = { "Grocery List": "f", "Silver Screen": "m t", "Top of the Charts": "u", "On the Map": "p", "Famous Folks": "n", "Bookshelf": "b" };
// Board order: your categories first, then the extras, then the general topics.
const YOUR_TOPICS = ["anime", "disney", "mu00", "mu10", "bfilm", "bmusic", "vg", "a", "vet", "cn", "nick", "nan", "mo00", "mo10", "marvel", "dc", "bway", "hiphop", "sw", "k90"];
const CLASSIC_TOPICS = ["m", "t", "u", "f", "s", "p", "n", "b", "h", "g", "x"];

// ---------- storage (this device only) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
let bank = store.get("ba.bank", 0);
let history = store.get("ba.history", null) || { answers: [], phrases: [] };

// ---------- fusing two phrases ----------
const norm = w => w.toLowerCase().replace(/[’']s?$/, "").replace(/[^a-z0-9]/g, "");
function fuse(first, second, allowCompound = true) {
  const a = first.trim().split(/\s+/), b = second.trim().split(/\s+/);
  for (let k = Math.min(a.length, b.length - 1); k >= 1; k--) {
    if (a.slice(-k).map(norm).join(" ") === b.slice(0, k).map(norm).join(" ")) {
      return { answer: [...a.slice(0, -k), ...b].join(" "), pre: a.slice(0, -k).join(" "), mid: b.slice(0, k).join(" "), post: b.slice(k).join(" ") };
    }
  }
  // Second phrase starts with a compound word, e.g. "Sea" + "Seabiscuit"
  const last = norm(a[a.length - 1]), b0 = norm(b[0]);
  if (allowCompound && a.length > 1 && b0.startsWith(last) && b0.length > last.length) {
    return { answer: [...a.slice(0, -1), ...b].join(" "), pre: a.slice(0, -1).join(" "), mid: b[0], post: b.slice(1).join(" ") };
  }
  return null;
}

// ---------- building the puzzle pool ----------
const STOP = new Set(["the", "and", "of", "in", "a", "an", "to", "on", "with", "for", "by", "it", "my"]);
const words = s => s.toLowerCase().split(/[^a-z0-9']+/).map(norm).filter(w => w && !STOP.has(w));
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

function phraseBank() {
  // A phrase listed more than once keeps its last description and all of its tags.
  const byName = new Map();
  for (const [name, desc, tags] of PHRASES) {
    const key = name.toLowerCase(), prev = byName.get(key);
    const allTags = new Set([...(prev ? prev[2].split(" ") : []), ...tags.split(" ")]);
    byName.set(key, [name, desc, [...allTags].join(" ")]);
  }
  if (typeof EXTRA_TAGS !== "undefined") {
    for (const [code, names] of Object.entries(EXTRA_TAGS)) {
      for (const n of names) { const p = byName.get(n.toLowerCase()); if (p && !p[2].split(" ").includes(code)) p[2] += " " + code; }
    }
  }
  return [...byName.values()].filter(p => p[0].trim().split(/\s+/).length > 1);
}

function buildPool() {
  const pool = new Map(); // answer -> puzzle
  for (const c of CATEGORIES) {
    for (const [first, second, clue] of c.items) {
      const f = fuse(first, second);
      if (f) pool.set(f.answer.toLowerCase(), { first, second, clue, tags: CATEGORY_TAGS[c.name] || "", ...f });
    }
  }
  const phrases = phraseBank();
  for (const [p1, d1, t1] of phrases) {
    for (const [p2, d2, t2] of phrases) {
      if (p1 === p2) continue;
      const f = fuse(p1, p2, false);
      // Both phrases must stick out past the shared word ("Mickey Mouse" + "Mickey Mouse Club" isn't a puzzle).
      if (!f || !f.pre || !f.post || pool.has(f.answer.toLowerCase())) continue;
      f.answer = f.answer.replace(/ The /g, " the "); f.mid = f.mid.replace(/^The /, "the ");
      const clue = cap(d1) + ", followed by " + d2;
      // Skip any pair whose clue gives away a word of the answer.
      const clueWords = new Set(words(clue));
      if (words(f.answer).some(w => w.length > 2 && clueWords.has(w))) continue;
      pool.set(f.answer.toLowerCase(), { first: p1, second: p2, clue, tags: t1 + " " + t2, ...f });
    }
  }
  return [...pool.values()];
}
const POOL = buildPool();
const byTag = code => POOL.filter(p => p.tags.split(" ").includes(code));

function search(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  for (const [code, names] of Object.entries(TAGS)) {
    if (names.includes(q) || (TAG_NAMES[code] || "").toLowerCase() === q) return byTag(code);
  }
  const terms = words(q).map(w => w.replace(/s$/, "")).filter(w => w.length >= 2);
  if (!terms.length) return [];
  return POOL.filter(p => {
    const hay = words(p.first + " " + p.second + " " + p.clue);
    return terms.every(t => hay.some(w => w === t || w.startsWith(t) || w.replace(/s$/, "") === t));
  });
}

// ---------- answer checking ----------
const clean = s => s.toLowerCase()
  .replace(/^\s*(what|who|where|when)\s+(is|are|was|were)\s+/, "")
  .replace(/[’']/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ")
  .replace(/\b(the|a|an|and|of)\b/g, " ").replace(/\s+/g, " ").trim();
function lev(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[b.length];
}
function isRight(guess, answer) {
  const g = clean(guess), a = clean(answer);
  if (!g) return false;
  if (g === a || g.replace(/ /g, "") === a.replace(/ /g, "")) return true;
  return 1 - lev(g, a) / Math.max(g.length, a.length) >= 0.8;
}

// ---------- choosing a round ----------
// One history shared by every mode: answers already played, plus the phrases
// shown recently, so "Stephen King" doesn't turn up in three rounds in a row.
function pickFive(cat) {
  const seenSet = new Set(history.answers);
  let fresh = cat.puzzles.filter(p => !seenSet.has(p.answer));
  if (fresh.length < Math.min(5, cat.puzzles.length)) {
    // This mode is used up: forget its puzzles and start it over.
    const mine = new Set(cat.puzzles.map(p => p.answer));
    history.answers = history.answers.filter(a => !mine.has(a));
    fresh = cat.puzzles.slice();
  }
  const recent = new Set(history.phrases);
  const stale = p => (recent.has(p.first) ? 1 : 0) + (recent.has(p.second) ? 1 : 0);
  const shuffled = fresh.map(p => [stale(p) + Math.random() * 0.9, p]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  // Five puzzles with no phrase or linking word in common, if possible.
  const pick = [], used = new Set();
  const keys = p => [p.first, p.second, "mid:" + norm(p.mid)];
  for (const p of shuffled) if (pick.length < 5 && !keys(p).some(k => used.has(k))) { pick.push(p); keys(p).forEach(k => used.add(k)); }
  for (const p of shuffled) if (pick.length < 5 && !pick.includes(p)) pick.push(p);
  history.answers.push(...pick.map(p => p.answer));
  history.phrases.push(...pick.flatMap(p => [p.first, p.second]));
  history.answers = history.answers.slice(-8000);
  history.phrases = history.phrases.slice(-300);
  store.set("ba.history", history);
  return pick;
}

// ---------- the Daily round ----------
// Five puzzles chosen the first time you open the game each day, kept until midnight.
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
let streak = store.get("ba.streak", { count: 0, best: 0, last: null });
function todaysDaily() {
  let daily = store.get("ba.daily", null);
  if (!daily || daily.date !== dayKey()) {
    daily = { date: dayKey(), answers: pickFive({ puzzles: POOL }).map(p => p.answer), results: [], earned: 0, done: false };
    store.set("ba.daily", daily);
  }
  return daily;
}
function currentStreak() {
  // A streak survives until you miss a whole day.
  return streak.last === dayKey() || streak.last === yesterdayKey() ? streak.count : 0;
}
function finishDaily(daily) {
  daily.done = true; store.set("ba.daily", daily);
  if (streak.last !== dayKey()) {
    streak.count = streak.last === yesterdayKey() ? streak.count + 1 : 1;
    streak.last = dayKey();
    streak.best = Math.max(streak.best, streak.count);
    store.set("ba.streak", streak);
  }
}

// ---------- UI ----------
if (typeof document !== "undefined") {
const $ = id => document.getElementById(id);
const money = n => (n < 0 ? "−$" : "$") + Math.abs(n).toLocaleString("en-US");
const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = n => n.toLocaleString("en-US");
function showBank() { $("bank").textContent = money(bank); $("bank").classList.toggle("neg", bank < 0); }
function screen(name) { for (const s of ["home", "play", "done"]) $(s).hidden = s !== name; window.scrollTo(0, 0); }

function tile(label, sub, cls, onclick) {
  const b = document.createElement("button");
  b.className = "tile " + (cls || ""); b.type = "button";
  b.innerHTML = `${esc(label)}<span class="n">${esc(sub)}</span>`;
  b.onclick = onclick;
  return b;
}
function topicTiles(el, codes) {
  el.innerHTML = "";
  const played = new Set(history.answers);
  for (const code of codes) {
    const puzzles = byTag(code);
    if (puzzles.length < 10) continue;
    const left = puzzles.filter(p => !played.has(p.answer)).length;
    el.append(tile(TAG_NAMES[code], `${fmt(left)} of ${fmt(puzzles.length)} left`, "", () => startRound({ name: TAG_NAMES[code], key: code, puzzles })));
  }
}
function renderBoard() {
  const daily = todaysDaily(), s = currentStreak();
  const when = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const streakText = s ? `Streak: ${s} day${s === 1 ? "" : "s"}` : "Start a streak today";
  $("dailyWrap").innerHTML = "";
  $("dailyWrap").append(daily.done
    ? tile("Daily done", `${money(daily.earned)} today · ${streakText} · Back tomorrow`, "daily done", () => showDailyResult(daily))
    : tile(`Daily · ${when}`, daily.results.length ? `Resume: clue ${daily.results.length + 1} of 5 · ${streakText}` : `Five fresh clues · ${streakText}`, "daily", startDaily));
  topicTiles($("board"), YOUR_TOPICS);
  topicTiles($("classics"), CLASSIC_TOPICS);
  const played = new Set(history.answers);
  const unseen = POOL.filter(p => !played.has(p.answer)).length;
  $("mixWrap").innerHTML = "";
  $("mixWrap").append(tile("Mixed Bag", `${fmt(unseen)} of ${fmt(POOL.length)} puzzles left to see`, "mix", () => startRound({ name: "Mixed Bag", key: "mix", puzzles: POOL })));
}

function updateCount() {
  const q = $("topic").value.trim();
  if (!q) { $("count").textContent = ""; $("buildBtn").disabled = false; return; }
  const n = search(q).length;
  $("count").innerHTML = n ? `<b>${fmt(n)}</b> puzzle${n === 1 ? "" : "s"} match “${esc(q)}”` : `Nothing matches “${esc(q)}” yet. Try a single word like King, Love or Star.`;
  $("buildBtn").disabled = n === 0;
}
$("topic").addEventListener("input", updateCount);
$("buildForm").addEventListener("submit", e => {
  e.preventDefault();
  const q = $("topic").value.trim();
  if (!q) { startRound({ name: "Surprise Me", key: "mix", puzzles: POOL }); return; }
  const found = search(q);
  if (found.length) startRound({ name: q.replace(/\b\w/g, c => c.toUpperCase()), key: "q:" + q.toLowerCase(), puzzles: found });
});

// ---------- round flow ----------
let round = null;
function startRound(cat) {
  round = { cat, clues: pickFive(cat), i: 0, results: [], earned: 0 };
  $("playCat").textContent = cat.name;
  screen("play"); showClue();
}
function startDaily() {
  const daily = todaysDaily();
  const byAnswer = new Map(POOL.map(p => [p.answer, p]));
  const clues = daily.answers.map(a => byAnswer.get(a)).filter(Boolean);
  if (clues.length < daily.answers.length) { store.set("ba.daily", null); return startDaily(); } // puzzle list changed since this morning
  round = { cat: { name: "Daily" }, daily, clues, i: daily.results.length, results: daily.results.slice(), earned: daily.earned };
  $("playCat").textContent = "Daily · " + new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  screen("play"); showClue();
}
function renderLadder() {
  $("ladder").innerHTML = round.clues.map((_, i) => {
    const r = round.results[i];
    const cls = r === true ? "got" : r === false ? "miss" : i === round.i ? "now" : "";
    return `<div class="rung ${cls}">${VALUES[i]}</div>`;
  }).join("");
}
function showClue() {
  const p = round.clues[round.i];
  renderLadder();
  $("clueVal").textContent = money(VALUES[round.i]);
  $("clueTxt").textContent = p.clue;
  const c = $("clue"); c.classList.remove("enter"); void c.offsetWidth; c.classList.add("enter");
  $("guess").value = ""; $("guessBtn").textContent = "Reveal";
  $("guessForm").hidden = false; $("answer").hidden = true;
}
$("guess").addEventListener("input", e => { $("guessBtn").textContent = e.target.value.trim() ? "Check" : "Reveal"; });
$("guessForm").addEventListener("submit", e => {
  e.preventDefault();
  const p = round.clues[round.i], g = $("guess").value.trim();
  const v = $("verdict");
  const ok = g && isRight(g, p.answer);
  if (g) {
    v.textContent = ok ? "Correct!" : "Not quite";
    v.className = "verdict " + (ok ? "ok" : "no");
    $("yours").textContent = "You said: " + g;
  } else {
    v.textContent = "The response was"; v.className = "verdict";
    $("yours").textContent = "";
  }
  $("response").innerHTML = "What is " + [esc(p.pre), `<mark>${esc(p.mid)}</mark>`, esc(p.post)].filter(Boolean).join(" ") + "?";
  $("parts").innerHTML = `<b>${esc(p.first)}</b> + <b>${esc(p.second)}</b>`;
  $("guessForm").hidden = true; $("answer").hidden = false;
  (ok ? $("gotIt") : $("missed")).focus({ preventScroll: true });
  $("answer").scrollIntoView({ behavior: "smooth", block: "nearest" });
});
function judge(ok) {
  const val = VALUES[round.i];
  round.results[round.i] = ok;
  round.earned += ok ? val : -val;
  bank += ok ? val : -val; store.set("ba.bank", bank); showBank();
  if (round.daily) {
    round.daily.results = round.results.slice(); round.daily.earned = round.earned;
    store.set("ba.daily", round.daily);
  }
  round.i++;
  if (round.i < round.clues.length) showClue(); else finish();
}
$("gotIt").onclick = () => judge(true);
$("missed").onclick = () => judge(false);
function finish() {
  if (round.daily) finishDaily(round.daily);
  const right = round.results.filter(Boolean).length;
  $("doneCat").textContent = round.cat.name;
  $("doneScore").textContent = money(round.earned);
  $("doneScore").classList.toggle("neg", round.earned < 0);
  let line = `${right} of ${round.clues.length} right. ` +
    (right === round.clues.length ? "A clean sweep." : right >= 3 ? "Strong round." : "The board will be kinder next time.");
  if (round.daily) line += ` Streak: ${currentStreak()} day${currentStreak() === 1 ? "" : "s"} (best ${streak.best}). New clues tomorrow.`;
  $("doneLine").textContent = line;
  $("again").hidden = !!round.daily;
  screen("done");
}
function showDailyResult(daily) {
  const right = daily.results.filter(Boolean).length;
  $("doneCat").textContent = "Daily · " + new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  $("doneScore").textContent = money(daily.earned);
  $("doneScore").classList.toggle("neg", daily.earned < 0);
  $("doneLine").textContent = `${right} of 5 right. Streak: ${currentStreak()} day${currentStreak() === 1 ? "" : "s"} (best ${streak.best}). New clues tomorrow.`;
  $("again").hidden = true;
  screen("done");
}
$("again").onclick = () => startRound(round.cat);
$("toBoard").onclick = () => { renderBoard(); screen("home"); };
$("quit").onclick = () => { renderBoard(); screen("home"); };
$("resetBank").onclick = () => { bank = 0; store.set("ba.bank", 0); showBank(); };

showBank();
renderBoard();

// Offline support once the app is hosted (service workers don't run from file://)
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
}
