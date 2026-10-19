// Before & After: game logic. Puzzle data lives in data.js.
const VALUES = [200, 400, 600, 800, 1000];
const CATEGORY_TAGS = { "Grocery List": "f", "Silver Screen": "m t", "Top of the Charts": "u", "On the Map": "p", "Famous Folks": "n", "Bookshelf": "b" };

// ---------- storage (this device only) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
let bank = store.get("ba.bank", 0);
let seen = store.get("ba.seen", {});

// ---------- fusing two phrases ----------
const norm = w => w.toLowerCase().replace(/[’']s$/, "").replace(/[^a-z0-9]/g, "");
function fuse(first, second) {
  const a = first.trim().split(/\s+/), b = second.trim().split(/\s+/);
  for (let k = Math.min(a.length, b.length - 1); k >= 1; k--) {
    if (a.slice(-k).map(norm).join(" ") === b.slice(0, k).map(norm).join(" ")) {
      return { answer: [...a.slice(0, -k), ...b].join(" "), pre: a.slice(0, -k).join(" "), mid: b.slice(0, k).join(" "), post: b.slice(k).join(" ") };
    }
  }
  // Second phrase starts with a compound word, e.g. "Sea" + "Seabiscuit"
  const last = norm(a[a.length - 1]), b0 = norm(b[0]);
  if (a.length > 1 && b0.startsWith(last) && b0.length > last.length) {
    return { answer: [...a.slice(0, -1), ...b].join(" "), pre: a.slice(0, -1).join(" "), mid: b[0], post: b.slice(1).join(" ") };
  }
  return null;
}

// ---------- building the puzzle pool ----------
const STOP = new Set(["the", "and", "of", "in", "a", "an", "to", "on", "with", "for", "by", "it", "my"]);
const words = s => s.toLowerCase().split(/[^a-z0-9']+/).map(norm).filter(w => w && !STOP.has(w));
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

function buildPool() {
  const pool = new Map(); // answer -> puzzle
  for (const c of CATEGORIES) {
    for (const [first, second, clue] of c.items) {
      const f = fuse(first, second);
      if (f) pool.set(f.answer.toLowerCase(), { first, second, clue, tags: CATEGORY_TAGS[c.name] || "", ...f });
    }
  }
  const bank = [...new Map(PHRASES.map(p => [p[0].toLowerCase(), p])).values()];
  for (const [p1, d1, t1] of bank) {
    for (const [p2, d2, t2] of bank) {
      if (p1 === p2) continue;
      const f = fuse(p1, p2);
      if (!f || pool.has(f.answer.toLowerCase())) continue;
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

function search(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  for (const [code, names] of Object.entries(TAGS)) {
    if (names.includes(q) || TAG_NAMES[code].toLowerCase() === q) return POOL.filter(p => p.tags.split(" ").includes(code));
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

// ---------- UI ----------
if (typeof document !== "undefined") {
const $ = id => document.getElementById(id);
const money = n => (n < 0 ? "−$" : "$") + Math.abs(n).toLocaleString("en-US");
const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function showBank() { $("bank").textContent = money(bank); $("bank").classList.toggle("neg", bank < 0); }
function screen(name) { for (const s of ["home", "play", "done"]) $(s).hidden = s !== name; window.scrollTo(0, 0); }

function renderBoard() {
  const board = $("board"); board.innerHTML = "";
  CATEGORIES.forEach((c, i) => {
    const b = document.createElement("button");
    b.className = "tile"; b.type = "button";
    b.innerHTML = `${esc(c.name)}<span class="n">${c.items.length} clues</span>`;
    b.onclick = () => startRound({ name: c.name, key: "c" + i, puzzles: c.items.map(([f, s, clue]) => ({ first: f, second: s, clue, ...fuse(f, s) })) });
    board.append(b);
  });
  const mix = document.createElement("button");
  mix.className = "tile mix"; mix.type = "button";
  mix.innerHTML = `Mixed Bag<span class="n">${POOL.length} puzzles from everywhere</span>`;
  mix.onclick = () => startRound({ name: "Mixed Bag", key: "mix", puzzles: POOL });
  board.append(mix);
}

// Topic chips + live match count
Object.entries(TAG_NAMES).forEach(([code, label]) => {
  const n = POOL.filter(p => p.tags.split(" ").includes(code)).length;
  if (n < 5) return;
  const b = document.createElement("button"); b.type = "button"; b.className = "idea"; b.textContent = label;
  b.onclick = () => { $("topic").value = label; updateCount(); };
  $("ideas").append(b);
});
function updateCount() {
  const q = $("topic").value.trim();
  for (const b of $("ideas").children) b.classList.toggle("on", b.textContent.toLowerCase() === q.toLowerCase());
  if (!q) { $("count").textContent = ""; $("buildBtn").disabled = false; return; }
  const n = search(q).length;
  $("count").innerHTML = n ? `<b>${n}</b> puzzle${n === 1 ? "" : "s"} match “${esc(q)}”` : `Nothing matches “${esc(q)}” yet. Try a topic chip or a single word like King, Red or Park.`;
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
function pickFive(cat) {
  const used = new Set(seen[cat.key] || []);
  let fresh = cat.puzzles.filter(p => !used.has(p.answer));
  if (fresh.length < Math.min(5, cat.puzzles.length)) { used.clear(); fresh = cat.puzzles.slice(); }
  for (let i = fresh.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [fresh[i], fresh[j]] = [fresh[j], fresh[i]]; }
  // Prefer five different shared words, so a round isn't all "King" clues.
  const pick = [], mids = new Set();
  for (const p of fresh) if (pick.length < 5 && !mids.has(norm(p.mid))) { pick.push(p); mids.add(norm(p.mid)); }
  for (const p of fresh) if (pick.length < 5 && !pick.includes(p)) pick.push(p);
  pick.forEach(p => used.add(p.answer));
  seen[cat.key] = [...used].slice(-400); store.set("ba.seen", seen);
  return pick;
}
function startRound(cat) {
  round = { cat, clues: pickFive(cat), i: 0, results: [], earned: 0 };
  $("playCat").textContent = cat.name;
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
  round.i++;
  if (round.i < round.clues.length) showClue(); else finish();
}
$("gotIt").onclick = () => judge(true);
$("missed").onclick = () => judge(false);
function finish() {
  const right = round.results.filter(Boolean).length;
  $("doneCat").textContent = round.cat.name;
  $("doneScore").textContent = money(round.earned);
  $("doneScore").classList.toggle("neg", round.earned < 0);
  $("doneLine").textContent = `${right} of ${round.clues.length} right. ` +
    (right === round.clues.length ? "A clean sweep." : right >= 3 ? "Strong round." : "The board will be kinder next time.");
  screen("done");
}
$("again").onclick = () => startRound(round.cat);
$("toBoard").onclick = () => screen("home");
$("quit").onclick = () => screen("home");
$("resetBank").onclick = () => { bank = 0; store.set("ba.bank", 0); showBank(); };

showBank();
renderBoard();

// Offline support once the app is hosted (service workers don't run from file://)
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
}
