// Before & After: game logic.
// Puzzle data lives in data.js, more-phrases.js, topics-*.js and alt-clues.js.
const VALUES = [200, 400, 600, 800, 1000];
const CATEGORY_TAGS = { "Grocery List": "f", "Silver Screen": "m t", "Top of the Charts": "u", "On the Map": "p", "Famous Folks": "n", "Bookshelf": "b" };
// Board order: your categories first, then the general topics.
const YOUR_TOPICS = ["anime", "disney", "mu00", "mu10", "bfilm", "bmusic", "hiphop", "vg", "fg", "a", "vet", "cn", "as", "nick", "nan", "pbs", "gs", "mo00", "mo10", "marvel", "dc", "sw", "bway", "soul", "k90"];
const CLASSIC_TOPICS = ["m", "t", "u", "f", "s", "p", "n", "b", "h", "g", "x"];
const MIN_TILE = 10, MIN_SUB = 5;

// ---------- storage (this device only) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
let bank = store.get("ba.bank", 0);
let history = Object.assign({ answers: [], phrases: [], desc: {} }, store.get("ba.history", null) || {});

// ---------- fusing two phrases ----------
const norm = w => w.toLowerCase().replace(/[’']s?$/, "").replace(/[^a-z0-9]/g, "");
function fuse(first, second, allowCompound = true) {
  const a = first.trim().split(/\s+/), b = second.trim().split(/\s+/);
  for (let k = Math.min(a.length, b.length - 1); k >= 1; k--) {
    if (a.slice(-k).map(norm).join(" ") === b.slice(0, k).map(norm).join(" ")) {
      return { answer: [...a.slice(0, -k), ...b].join(" "), pre: a.slice(0, -k).join(" "), mid: b.slice(0, k).join(" "), post: b.slice(k).join(" "), k };
    }
  }
  // Second phrase starts with a compound word, e.g. "Sea" + "Seabiscuit"
  const last = norm(a[a.length - 1]), b0 = norm(b[0]);
  if (allowCompound && a.length > 1 && b0.startsWith(last) && b0.length > last.length) {
    return { answer: [...a.slice(0, -1), ...b].join(" "), pre: a.slice(0, -1).join(" "), mid: b[0], post: b.slice(1).join(" "), k: 1 };
  }
  return null;
}

// ---------- building the puzzle pool ----------
const STOP = new Set(["the", "and", "of", "in", "a", "an", "to", "on", "with", "for", "by", "it", "my"]);
const words = s => s.toLowerCase().split(/[^a-z0-9']+/).map(norm).filter(w => w && !STOP.has(w));
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const fixThe = s => s.replace(/ The /g, " the ");

function phraseBank() {
  // A phrase listed more than once keeps its last description and all of its tags.
  const byName = new Map();
  for (const [name, desc, tags] of PHRASES) {
    const key = name.toLowerCase(), prev = byName.get(key);
    const all = new Set(prev ? prev.tags : []);
    for (const t of tags.split(" ")) { if (!t) continue; all.add(t); if (t.includes(".")) all.add(t.split(".")[0]); }
    byName.set(key, { name, opts: [desc], tags: all });
  }
  if (typeof EXTRA_TAGS !== "undefined") {
    for (const [code, names] of Object.entries(EXTRA_TAGS)) {
      for (const n of names) { const p = byName.get(n.toLowerCase()); if (p) { p.tags.add(code); if (code.includes(".")) p.tags.add(code.split(".")[0]); } }
    }
  }
  if (typeof ALT_CLUES !== "undefined") {
    for (const [n, alt] of Object.entries(ALT_CLUES)) { const p = byName.get(n.toLowerCase()); if (p) p.opts.push(alt); }
  }
  return [...byName.values()].filter(p => p.name.trim().split(/\s+/).length > 1);
}

// Keep only the descriptions that don't give away a word of the answer.
function safeOpts(phrase, answer) {
  const ans = words(answer).filter(w => w.length > 2);
  return phrase.opts.filter(d => { const dw = new Set(words(d)); return !ans.some(w => dw.has(w)); });
}

function buildPools() {
  const pairs = new Map(); // answer -> puzzle
  for (const c of CATEGORIES) {
    for (const [first, second, clue] of c.items) {
      const f = fuse(first, second);
      if (f) pairs.set(f.answer.toLowerCase(), {
        kind: "fixed", answer: f.answer, names: [first, second], fixedClue: clue, tags: CATEGORY_TAGS[c.name] || "",
        segs: [[f.pre, 0], [f.mid, 1], [f.post, 0]],
      });
    }
  }
  const phrases = phraseBank();
  // Only compare phrases that could overlap: B's first word must be one of A's last few words.
  const byStart = new Map();
  for (const B of phrases) {
    const w = norm(B.name.trim().split(/\s+/)[0]);
    if (!byStart.has(w)) byStart.set(w, []);
    byStart.get(w).push(B);
  }
  const byFirst = new Map();
  for (const A of phrases) {
    const aw = A.name.trim().split(/\s+/);
    const candidates = new Set(aw.slice(-3).flatMap(w => byStart.get(norm(w)) || []));
    for (const B of candidates) {
      if (A === B) continue;
      const f = fuse(A.name, B.name, false);
      // Both phrases must stick out past the shared word ("Mickey Mouse" + "Mickey Mouse Club" isn't a puzzle).
      if (!f || !f.pre || !f.post || pairs.has(f.answer.toLowerCase())) continue;
      const answer = fixThe(f.answer);
      const o1 = safeOpts(A, answer), o2 = safeOpts(B, answer);
      if (!o1.length || !o2.length) continue;
      const p = {
        kind: "pair", answer, names: [A.name, B.name], parts: [A, B], opts: [o1, o2], k: f.k,
        tags: [...new Set([...A.tags, ...B.tags])].join(" "),
        segs: [[f.pre, 0], [f.mid.replace(/^The /, "the "), 1], [f.post, 0]],
      };
      pairs.set(answer.toLowerCase(), p);
      if (!byFirst.has(A.name)) byFirst.set(A.name, []);
      byFirst.get(A.name).push(p);
    }
  }
  // Triples: A + B + C, where A→B and B→C are both pairs and the two shared words don't overlap inside B.
  const triples = new Map();
  for (const P of pairs.values()) {
    if (P.kind !== "pair") continue;
    const [A, B] = P.parts, bWords = B.name.trim().split(/\s+/);
    for (const Q of byFirst.get(B.name) || []) {
      const C = Q.parts[1];
      if (C === A || P.k + Q.k > bWords.length) continue;
      const pre = P.segs[0][0], post = Q.segs[2][0];
      const m1 = bWords.slice(0, P.k).join(" "), mid = bWords.slice(P.k, bWords.length - Q.k).join(" "), m2 = bWords.slice(bWords.length - Q.k).join(" ");
      const answer = fixThe([pre, ...bWords, post].filter(Boolean).join(" "));
      if (triples.has(answer.toLowerCase()) || pairs.has(answer.toLowerCase())) continue;
      const o = [A, B, C].map(x => safeOpts(x, answer));
      if (o.some(x => !x.length)) continue;
      triples.set(answer.toLowerCase(), {
        kind: "triple", answer, names: [A.name, B.name, C.name], parts: [A, B, C], opts: o,
        tags: [...new Set([...A.tags, ...B.tags, ...C.tags])].join(" "),
        segs: [[pre, 0], [m1, 1], [mid, 0], [m2, 1], [post, 0]],
      });
    }
  }
  return { pairs: [...pairs.values()], triples: [...triples.values()] };
}
const { pairs: POOL, triples: TRIPLES } = buildPools();
const hasTag = (p, code) => (" " + p.tags + " ").includes(" " + code + " ");
const byTag = code => POOL.filter(p => hasTag(p, code));
const triplesByTag = code => TRIPLES.filter(p => hasTag(p, code));
const ALL = new Map([...POOL, ...TRIPLES].map(p => [p.answer, p]));

function search(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  for (const [code, names] of Object.entries(TAGS)) {
    if (names.includes(q) || (TAG_NAMES[code] || "").toLowerCase() === q) return byTag(code);
  }
  const terms = words(q).map(w => w.replace(/s$/, "")).filter(w => w.length >= 2);
  if (!terms.length) return [];
  return POOL.filter(p => {
    const hay = words(p.names.join(" ") + " " + (p.fixedClue || p.opts.map(o => o[0]).join(" ")));
    return terms.every(t => hay.some(w => w === t || w.startsWith(t) || w.replace(/s$/, "") === t));
  });
}

// ---------- clue text ----------
// Each phrase can have two descriptions; show the one you didn't see last time.
function clueFor(p) {
  if (p.kind === "fixed") return p.fixedClue;
  const bits = p.parts.map((ph, i) => {
    const opts = p.opts[i], last = history.desc[ph.name];
    let idx = opts.length > 1 ? (last === undefined ? Math.floor(Math.random() * opts.length) : (last + 1) % opts.length) : 0;
    history.desc[ph.name] = idx;
    return opts[idx];
  });
  store.set("ba.history", history);
  return cap(bits.join(", followed by "));
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
function pickFrom(puzzles, n, used = new Set()) {
  if (!puzzles.length || n <= 0) return [];
  const seenSet = new Set(history.answers);
  let fresh = puzzles.filter(p => !seenSet.has(p.answer));
  if (fresh.length < Math.min(n, puzzles.length)) {
    // This mode is used up: forget its puzzles and start it over.
    const mine = new Set(puzzles.map(p => p.answer));
    history.answers = history.answers.filter(a => !mine.has(a));
    fresh = puzzles.slice();
  }
  const recent = new Set(history.phrases);
  const stale = p => p.names.filter(x => recent.has(x)).length;
  const shuffled = fresh.map(p => [stale(p) + Math.random() * 0.9, p]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  const keys = p => p.names.concat(p.segs.filter(s => s[1]).map(s => "mid:" + norm(s[0])));
  const pick = [];
  for (const p of shuffled) if (pick.length < n && !keys(p).some(k => used.has(k))) { pick.push(p); keys(p).forEach(k => used.add(k)); }
  for (const p of shuffled) if (pick.length < n && !pick.includes(p)) pick.push(p);
  history.answers.push(...pick.map(p => p.answer));
  history.phrases.push(...pick.flatMap(p => p.names));
  history.answers = history.answers.slice(-9000);
  history.phrases = history.phrases.slice(-300);
  store.set("ba.history", history);
  return pick;
}
// Four regular clues plus a Triple Before & After for $1,000 when the topic has one.
function pickRound(cat) {
  if (cat.triplesOnly) return pickFrom(cat.triples, 5);
  const used = new Set();
  const four = pickFrom(cat.puzzles, 4, used);
  const triple = pickFrom(cat.triples || [], 1, used);
  return triple.length ? four.concat(triple) : four.concat(pickFrom(cat.puzzles, 1, used));
}

// ---------- the Daily round ----------
// Five puzzles chosen the first time you open the game each day, kept until midnight.
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
let streak = store.get("ba.streak", { count: 0, best: 0, last: null });
function todaysDaily() {
  let daily = store.get("ba.daily", null);
  if (!daily || daily.date !== dayKey()) {
    daily = { date: dayKey(), answers: pickRound({ puzzles: POOL, triples: TRIPLES }).map(p => p.answer), results: [], earned: 0, done: false };
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
function screen(name) { for (const s of ["home", "pick", "play", "done"]) $(s).hidden = s !== name; window.scrollTo(0, 0); }

function tile(label, sub, cls, onclick) {
  const b = document.createElement("button");
  b.className = "tile " + (cls || ""); b.type = "button";
  b.innerHTML = `${esc(label)}<span class="n">${esc(sub)}</span>`;
  b.onclick = onclick;
  return b;
}
const leftOf = puzzles => { const played = new Set(history.answers); return puzzles.filter(p => !played.has(p.answer)).length; };
const subsOf = code => (SUBTOPICS[code] || []).filter(s => byTag(s).length >= MIN_SUB);
const catFor = code => ({ name: TAG_NAMES[code], puzzles: byTag(code), triples: triplesByTag(code) });

function topicTiles(el, codes) {
  el.innerHTML = "";
  for (const code of codes) {
    const puzzles = byTag(code);
    if (puzzles.length < MIN_TILE) continue;
    const subs = subsOf(code);
    const sub = `${fmt(leftOf(puzzles))} of ${fmt(puzzles.length)} left` + (subs.length ? ` · ${subs.length} focus picks` : "");
    el.append(tile(TAG_NAMES[code], sub, "", () => subs.length ? openPicker(code) : startRound(catFor(code))));
  }
}
function openPicker(code) {
  $("pickName").textContent = TAG_NAMES[code];
  const all = byTag(code);
  $("pickAll").innerHTML = "";
  $("pickAll").append(tile(`All ${TAG_NAMES[code]}`, `Broad · ${fmt(leftOf(all))} of ${fmt(all.length)} left`, "mix", () => startRound(catFor(code))));
  $("pickSubs").innerHTML = "";
  for (const s of subsOf(code)) {
    const ps = byTag(s);
    $("pickSubs").append(tile(TAG_NAMES[s], `${fmt(leftOf(ps))} of ${fmt(ps.length)} left`, "", () => startRound(catFor(s))));
  }
  screen("pick");
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
  $("mixWrap").innerHTML = "";
  $("mixWrap").append(
    tile("Mixed Bag", `${fmt(leftOf(POOL))} of ${fmt(POOL.length)} left`, "mix", () => startRound({ name: "Mixed Bag", puzzles: POOL, triples: TRIPLES })),
    tile("Triple Threat", `Five three-way clues · ${fmt(leftOf(TRIPLES))} left`, "triple", () => startRound({ name: "Triple Threat", triples: TRIPLES, triplesOnly: true })),
  );
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
  if (!q) { startRound({ name: "Surprise Me", puzzles: POOL, triples: TRIPLES }); return; }
  const found = search(q);
  if (found.length) startRound({ name: q.replace(/\b\w/g, c => c.toUpperCase()), puzzles: found });
});

// ---------- round flow ----------
let round = null;
function startRound(cat) {
  round = { cat, clues: pickRound(cat), i: 0, results: [], earned: 0 };
  $("playCat").textContent = cat.name;
  screen("play"); showClue();
}
function startDaily() {
  const daily = todaysDaily();
  const clues = daily.answers.map(a => ALL.get(a)).filter(Boolean);
  if (clues.length < daily.answers.length) { store.set("ba.daily", null); return startDaily(); } // puzzle list changed since this morning
  round = { cat: { name: "Daily" }, daily, clues, i: daily.results.length, results: daily.results.slice(), earned: daily.earned };
  $("playCat").textContent = "Daily · " + new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  screen("play"); showClue();
}
function renderLadder() {
  $("ladder").innerHTML = round.clues.map((p, i) => {
    const r = round.results[i];
    const cls = (r === true ? "got" : r === false ? "miss" : i === round.i ? "now" : "") + (p.kind === "triple" ? " x3" : "");
    return `<div class="rung ${cls}">${VALUES[i]}</div>`;
  }).join("");
}
function showClue() {
  const p = round.clues[round.i];
  renderLadder();
  $("clueVal").innerHTML = (p.kind === "triple" ? `<span class="tag">Triple Before &amp; After</span>` : "") + money(VALUES[round.i]);
  $("clueTxt").textContent = clueFor(p);
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
  $("response").innerHTML = "What is " + p.segs.filter(s => s[0]).map(([t, m]) => m ? `<mark>${esc(t)}</mark>` : esc(t)).join(" ") + "?";
  $("parts").innerHTML = p.names.map(n => `<b>${esc(n)}</b>`).join(" + ");
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
const home = () => { renderBoard(); screen("home"); };
$("again").onclick = () => startRound(round.cat);
$("toBoard").onclick = home;
$("quit").onclick = home;
$("pickBack").onclick = home;
$("resetBank").onclick = () => { bank = 0; store.set("ba.bank", 0); showBank(); };

showBank();
renderBoard();

// Offline support once the app is hosted (service workers don't run from file://)
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
}
