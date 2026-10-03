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

```bash
npm run build:static   # dist/ with puzzles exported as static JSON shards (needs data/puzzles.db)
```

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
- The **Coach** tab explains why each mistake happened using the clock data from the PGN (premoves, rushed critical moves, time trouble, long thinks that still went wrong) and the engine's lines (hung pieces, forks and other tactics you allowed, wins you missed).

## Training to 1500

- **Home: today's plan and streak.** A daily checklist that ticks itself off (10 puzzles, due reviews, a lesson or drill, a reviewed game), a streak with a 14-day activity strip, and a three-stage road to 1500 that highlights your stage from your chess.com rating.
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
npm run build     # type-check + production build
npm run validate  # replays every opening line, classic game and lesson position with chess.js
```
