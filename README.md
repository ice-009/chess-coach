# ChessCoach

A local chess training app: review your chess.com games with Stockfish, learn openings and fundamentals, study master games, and solve puzzles made from your own mistakes.

## Run it

```bash
npm install
npm run dev      # development server (hot reload) at http://localhost:5173
npm start        # optimized build, faster, opens http://localhost:5173
```

## Hosted version

A static build runs at https://chess-coach-psi-tawny.vercel.app: game review, puzzles, lessons, openings, practice and insights all work in the browser. Two things only run on your own computer: the master database (built from TWIC, which is free for personal use only, so it is not published) and the Claude AI review (it needs your API key, which must never sit on a public site).

Every push to `main` on GitHub deploys it: Vercel runs `npm run build:static` (see `vercel.json`) and publishes `dist/`, plus the accounts function in `api/`.

```bash
npm run build:static   # the hosted build in dist/ (puzzles come from public/puzzles)
npm run deploy         # publish this Mac's build (e.g. uncommitted changes) without pushing
```

The puzzles are static JSON files in `public/puzzles/` (Lichess puzzles are CC0, so they may be published). To refresh them: `npm run puzzles:update`, then `npm run puzzles:export`, and commit `public/puzzles`.

## Offline on your iPad or Android phone (e.g. on a flight)

No app store needed: the hosted site installs as an app (iPad/iPhone: Safari → Share → Add to Home Screen; Android: Chrome → ⋮ → Install app, or the Install button on the Offline page) and can save everything on the device, so it works with no internet at all:

1. On the Mac: `npm run db:export` writes `ChessCoach-masters.db` (about 0.75 GB) to your Desktop. `--otb` makes an over-the-board-only copy, about half the size.
2. AirDrop it to the iPad and choose **Save to Files** (Android: Quick Share, Google Drive or USB, saved in Downloads). For a phone, `npm run db:export -- --otb` makes a 0.38 GB copy.
3. On the iPad, open the site in Safari, **Share → Add to Home Screen**, open it from the Home Screen, go to **Offline**:
   - the app (pages, Stockfish, SQLite) is saved automatically,
   - **Save all puzzles** keeps all 280,000 puzzles (48 MB),
   - **Choose the database file** copies the master database into the iPad's private browser storage (it is never uploaded; the licence is personal use only).
4. Open your chess.com games once while online: game lists and games you opened stay available.
5. Turn on Airplane Mode and check.

The database runs on the iPad with SQLite compiled to WebAssembly (`src/lib/localDb.worker.ts`), using the same queries as the Mac's server (`src/lib/dbQueries.ts`). It needs Safari on iPadOS/iOS 17 or newer (outside Private Browsing) or Chrome on Android.

## Use it on your iPad (with the master database)

The hosted site has no master database (its licence is personal use only) and no AI coach. To get everything on your iPad, let your Mac serve the app over your home Wi-Fi:

```bash
npm run ipad
```

It builds the app, starts it on port 5173, keeps the Mac awake, and prints the address to open in Safari on the iPad, e.g. `http://Your-Mac.local:5173/?t=abc123`. Other devices on the network need the six-letter access code (stored in `.ipad-code.local`, git-ignored); each device asks for it once. Add it to the Home Screen for a full-screen app. The first time, macOS may ask whether Node can accept incoming connections: allow it. The Mac has to be on and on the same Wi-Fi; to use it away from home, install Tailscale on both devices and use the Mac's Tailscale address instead.

## iPad and phones

The layout is tuned for the iPad Air 11" in both orientations (and works on other tablets and phones):

- **Sidebar**: full width on desktops, an icon rail with labels on tablets (761–1199 px), a bottom tab bar with a "More" sheet on phones.
- **Boards fit the screen**: in landscape the puzzle, drill, play and review boards shrink just enough to show all eight ranks without scrolling. In portrait the review move buttons stay pinned to the bottom of the screen.
- **Touch**: drag pieces or tap a piece and then its square; controls are at least 40–44 px; double-tapping ◀ ▶ never zooms the page; inputs use 16 px text so Safari doesn't zoom in when you type; puzzle themes are one row you swipe through; charts show the value under your finger (drag sideways to scrub).
- **Home Screen app**: in Safari, Share → Add to Home Screen opens ChessCoach full screen with its own icon.

## Game review

- Stockfish 19 (NNUE, WebAssembly) runs in several web workers in parallel.
- Three passes: a quick shallow pass (under a second), then a full-depth pass, then a two-line search to find "only moves".
- Every move is classified: Brilliant, Great, Book, Best, Excellent, Good, Inaccuracy, Mistake, Miss, Blunder.
- Accuracy per player and an estimated **Game Rating** (the strength you played at in that game, from average centipawn loss). It is an estimate, not an official rating.
- **Best move and why**: for every move the review shows Stockfish's best move and the reasons it works (wins material, forks, saves an attacked piece, stops a mate threat, develops, castles, takes the centre, rook on an open file or the 7th rank, knight outpost, better bishop, passed pawn, pawn break, active king, good trade), each with a link to the lesson that teaches the idea. Good moves get the same "why it's good" explanation.
- **Show the line** plays Stockfish's line on the board (◀ ▶ or the arrow keys step through it). **Retry** puts you back before a mistake to find the better move yourself; Stockfish checks any move you try.
- The **Coach** tab explains why each mistake happened using the clock data from the PGN (premoves, rushed critical moves, time trouble, long thinks that still went wrong) and the engine's lines (hung pieces, forks and other tactics you allowed, wins you missed).

## Training to 1500

- **Home: today's plan and streak.** A daily checklist that ticks itself off (10 puzzles, due reviews, a lesson or drill, a reviewed game), a streak with a 14-day activity strip, and a three-stage road to 1500 that highlights your stage from your chess.com rating.
- **Opening encyclopedia.** The main lines of 31 major openings (51 lines: Ruy Lopez, Italian, Scotch, Sicilian Najdorf/Dragon/Sveshnikov, French, Caro-Kann, Queen's Gambit, Slav, King's Indian, Nimzo-Indian, Grünfeld, Dutch, English and more), explained move by move with the plans for both sides; Study, Drill, or jump to the master games from any move. Every move is master practice (checked against the master database) and sound (checked by Stockfish). Next to it, *My repertoire* is a complete beginner repertoire to drill.
- **Opening quiz.** After studying, test yourself: the computer picks a different line each round (from one opening, a section, your whole repertoire or the encyclopedia) and plays its book moves; you play yours from memory as White, as Black, both colours, or your own side of each line. Two wrong tries show the move and its explanation; lines with mistakes come back first, and openings you pass get a ✓ White / ✓ Black badge.
- **Endgames.** Lessons on the basic checkmates, pawn-endgame technique, bishop and knight endgames and queen vs pawn; drills against the computer for every basic mate (queen, rook, two rooks, two bishops, bishop and knight) and the key pawn, rook and queen endgames; and endgame and checkmate-pattern puzzles (pawn, rook, bishop, knight, queen endgames, zugzwang; smothered, Arabian, Anastasia, Boden's and more).
- **Strategy course.** Ten lessons on pawn structure, weak pawns, passed pawns, rooks on open files and the 7th rank, good and bad bishops, knights and outposts, pawn breaks, the centre and king safety, when to trade, and making a plan. Every exercise answer is Stockfish's best move.
- **Puzzles.** About 280,000 rated puzzles from the Lichess puzzle database (CC0), from beginner to master, tagged by theme. Modes:
  - *Rated*: puzzles near your puzzle rating, which adapts as you solve (a hint, a wrong move or "show solution" counts as a miss).
  - *Themes*: hanging pieces, forks, pins, skewers, mates in 1/2/3, back-rank mates, discovered attacks, endgames and more.
  - *Puzzle Rush*: 3 minutes, 3 strikes, rising difficulty.
  - *Review*: every missed puzzle comes back after 1, 3, 7 and 21 days until you solve it cleanly.
  - *My mistakes*: puzzles made from your own analysed games.
- **Practice.**
  - *Play the computer* at seven levels (Beginner to Master), from the start or any position, then review the game.
  - *Endgame drills*: 12 must-know endgames (queen/rook/two-rook mates, opposition, key squares, the square rule, Lucena, Philidor, rook-pawn draw). Win the wins against best defence; hold the draws. Each position was checked with Stockfish.
  - *Board vision*: name-the-square against the clock, as White or Black.
- **Insights (weakness report).** From your last three months of chess.com games: results by color, how your games end (checkmated, resigned, on time), your best and worst openings, your rating trend. One click analyses your last 10 or 25 games and breaks your mistakes down by cause (hung pieces, allowed tactics, missed wins, premoves/rushing, time trouble) and phase, then recommends the training that fixes your biggest leaks.

Set up the puzzles once from the app (Puzzles tab) or with `npm run puzzles:update` (downloads ~300 MB, builds in seconds).

## Master database

A ChessBase-style library of over-the-board master games, built locally on your machine:

- **Opening explorer**: for any position, the moves masters played with game counts, White/Draw/Black results, average rating and last year played, plus the top games that reached it. Filter by rating (2200+, 2400+, 2600+). Also shown inside the Analysis board.
- **Game search** by player, color, opponent, result, ECO, opening, event, years and minimum rating.
- **Player dossiers**: record with each color, peak rating by year, repertoire with scores, best wins, latest games.
- **Game viewer** with a full Stockfish review of any master game.

Build it from the app (Database → Build database) or from the terminal:

```bash
npm run db:update                    # last year of games (about 52 weekly issues)
npm run db:update -- --issues 156    # last 3 years
```

Sources (downloaded for personal use, never redistributed):
- [The Week in Chess](https://theweekinchess.com): weekly top-tournament games since 1994, "free for personal use only". Games where both players are rated 2000+ are kept.
- [pgnmentor.com](https://www.pgnmentor.com/files.html) player collections: world champions and elite players, free downloads.
- [lichess chess-openings](https://github.com/lichess-org/chess-openings) (CC0) for opening names.
- Your own PGN files: put them in `data/sources/custom/` and rebuild.

Positions are indexed up to move 20. Everything lives in `data/` (git-ignored).

## Optional: AI coach (Claude)

The Coach tab can also ask Claude for a written review of the game. It uses your own Anthropic API key:

1. Create a key at https://console.anthropic.com/settings/keys
2. Copy `.env.example` to `.env.local` and paste the key after `ANTHROPIC_API_KEY=`
3. Restart `npm run dev` / `npm start`

The key is read only by the local server (`server/coachApi.ts`) and is never sent to the browser. `.env.local` is git-ignored. Each review is one Claude API request and is billed to your Anthropic account.

## Checks

```bash
npm run build        # type-check + production build
npm run validate     # replays every opening line, classic game and lesson position with chess.js
npm run test:smoke   # main flows in a real browser (app must be running; pass its URL after --)
npm run test:layout  # laptop, iPad (landscape/portrait) and phone sizes: no sideways scrolling, boards fit
npm run test:quiz    # plays opening quizzes as White, Black and both colours, with and without mistakes
```
