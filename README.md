# Before & After

A Jeopardy!-style Before & After game. It's plain HTML, CSS and JavaScript with no accounts, no AI calls and no costs. Once it's on your phone, it works offline.

## What's in the folder

| File | What it is |
|---|---|
| `index.html` | The page |
| `style.css` | The look |
| `app.js` | Game logic and the clue builder |
| `data.js` | Hand-written puzzles and the original phrase bank. **Edit this to add your own.** |
| `more-phrases.js` | About 700 more phrases for the clue builder |
| `topics-1.js` – `topics-6.js` | Phrases for your categories, focus picks (Naruto, Pixar, Dog Breeds…) and new channels |
| `alt-clues.js` | Second descriptions for the most-used phrases, so repeats read differently |
| `sw.js`, `manifest.webmanifest`, `icons/` | Let the game install on your home screen and run offline |

## Play on your computer

Double-click `index.html`. It opens in your browser and plays right away. Offline install only works once the game is hosted (see below).

## Put it on your phone (free)

Your phone needs a web address to load the game from. You can host these files for free in either of these ways:

**Option A: Netlify Drop (easiest, about 2 minutes)**
1. Go to https://app.netlify.com/drop and sign up for a free account.
2. Drag this whole `before-and-after` folder onto the page.
3. Netlify gives you a link like `https://something-random.netlify.app`. Open it on your phone.

**Option B: GitHub Pages**
1. Create a free GitHub account, then make a new public repository.
2. Upload every file in this folder, including the `icons` folder.
3. In the repository, go to **Settings → Pages**, choose the `main` branch, and save. Your link appears there after a minute.

**Then add it to your home screen**
- **iPhone (Safari):** Share button → **Add to Home Screen**.
- **Android (Chrome):** ⋮ menu → **Add to Home screen** or **Install app**.

Open it once while you have signal. After that it runs offline, like an app.

## Daily round

The gold tile at the top gives you the same five puzzles all day. Finish it on back-to-back days to build a streak; miss a whole day and the streak resets. Your streak, bank and history are saved on the device you play on.

## Triples and focus picks

The $1,000 clue in most rounds is a **Triple Before & After** (three phrases chained together), marked ×3. The **Triple Threat** tile plays five in a row. Categories with a "focus picks" note open a menu: play the whole category, or narrow it to one show or topic.

## Adding your own puzzles

Open `data.js` in any text editor.

- **A whole puzzle you wrote yourself:** add a line to one of the `CATEGORIES` lists:
  `["Hotel California", "California Raisins", "Eagles classic, followed by claymation singers of ..."],`
- **A phrase for the clue builder:** add a line to `PHRASES`:
  `["Space Needle", "Seattle's 605-foot observation tower", "p"],`
  The game automatically pairs it with any phrase that starts or ends with the same word. To put it in a focus pick, use that pick's tag, like `anime.naruto` or `vet.dogs` (listed at the top of `topics-5.js`). Keep the description free of the phrase's own words, or that pairing gets skipped. The tag letters are listed at the top of the file.

If the game is hosted, upload the changed file again. Then change `VERSION` in `sw.js` (for example to `ba-v2`) so phones download the update instead of using the old saved copy.
