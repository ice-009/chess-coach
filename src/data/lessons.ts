// The course. Text uses a tiny markdown subset: blank-line paragraphs, "- " bullets, "### " headings, **bold**.
// Boards and exercises take either a FEN or `setup` (SAN moves from the start position).
// Exercise solutions are checked against Stockfish by scripts/validate-data.ts + the browser test.

export type Section =
  | { kind: 'text'; md: string }
  | { kind: 'board'; fen?: string; setup?: string; caption: string; arrows?: string[]; squares?: string[]; flip?: boolean }
  | { kind: 'exercise'; fen?: string; setup?: string; prompt: string; solutions: string[]; explain: string };

export interface Lesson {
  id: string;
  title: string;
  minutes: number;
  sections: Section[];
}

export interface Chapter {
  id: string;
  title: string;
  goal: string;
  lessons: Lesson[];
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'foundations',
    title: '1. Foundations',
    goal: 'Know exactly what chess is, how every piece moves, what pieces are worth, and how to read chess notation.',
    lessons: [
      {
        id: 'what-is-chess',
        title: 'What chess is (and how to read it)',
        minutes: 6,
        sections: [
          {
            kind: 'text',
            md: `Chess is a two-player game of **perfect information**: nothing is hidden and there is no luck. Every game you lose is lost through a decision you made, which is exactly why you can get better at it with the right training.

### The goal
You win by **checkmate**: attacking the enemy king so that it cannot escape. You never actually capture the king. You can also win when your opponent **resigns** or **runs out of time**.

### The board
- 64 squares, 8×8. The bottom-right square from White’s side is always **light** ("light on the right").
- **Files** are the columns, named **a–h** from White’s left.
- **Ranks** are the rows, numbered **1–8** from White’s side.
- So every square has a name: the white king starts on **e1**, the black queen on **d8**.`,
          },
          { kind: 'board', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', caption: 'The starting position. Queens start on their own colour: white queen on d1 (light), black queen on d8 (dark).', squares: ['d1', 'd8', 'e1', 'e8'] },
          {
            kind: 'text',
            md: `### Notation (how games are written)
Every move is written as **piece letter + destination square**. K = king, Q = queen, R = rook, B = bishop, N = knight. Pawns have no letter.
- **e4**: a pawn moves to e4.
- **Nf3**: a knight moves to f3.
- **Bxc6**: a bishop **captures** (x) on c6.
- **+** means check, **#** means checkmate, **O-O** is short castling, **O-O-O** long castling.
- Annotations: **!** good move, **?** mistake, **??** blunder, **?!** dubious.

Reading notation fluently is essential: it is how you study books, master games and your own analysis.`,
          },
        ],
      },
      {
        id: 'pieces',
        title: 'How the pieces move and what they’re worth',
        minutes: 8,
        sections: [
          {
            kind: 'text',
            md: `### Movement
- **King**: one square in any direction. Must never move into check.
- **Queen**: any number of squares in a straight line or diagonal. The strongest piece.
- **Rook**: any number of squares along a rank or file.
- **Bishop**: any number of squares diagonally. Each bishop stays on one colour forever.
- **Knight**: an "L": two squares one way, one square sideways. The only piece that **jumps** over others.
- **Pawn**: forward one square (two from its starting square), but **captures diagonally**. It cannot move backward.

### Point values
These are a guide for trades, not a law:
- Pawn = **1**, Knight = **3**, Bishop = **3** (the pair of bishops ≈ 6.5), Rook = **5**, Queen = **9**.
- The king is priceless.

Trading a knight (3) for a rook (5) is "winning the exchange". Losing a piece for a pawn is a **blunder** that decides most beginner games.`,
          },
          { kind: 'board', fen: '8/8/8/3N4/8/8/8/k6K w - - 0 1', caption: 'A knight on d5 attacks 8 squares. On the rim (a- or h-file) it would attack only 4: "a knight on the rim is dim".', squares: ['b4', 'b6', 'c3', 'c7', 'e3', 'e7', 'f4', 'f6'] },
          { kind: 'exercise', fen: 'q3k3/8/8/3N4/8/8/7P/4K3 w - - 0 1', prompt: 'White to move. Use the knight to win the queen.', solutions: ['Nc7+'], explain: 'Nc7+ attacks the king and the queen at the same time: a **fork**. After the king moves, Nxa8 wins 9 points.' },
        ],
      },
      {
        id: 'special-rules',
        title: 'Check, mate, stalemate and special moves',
        minutes: 7,
        sections: [
          {
            kind: 'text',
            md: `### Getting out of check
When your king is in check you **must** deal with it. There are only three ways:
- **Move** the king to a safe square.
- **Block** the check by putting a piece in between (impossible against knight checks).
- **Capture** the checking piece.

If none of these works, it’s **checkmate**.

### Stalemate = draw
If the side to move is **not** in check but has **no legal moves**, the game is a **draw**. Beginners throw away won games this way, so always make sure your opponent’s king has a square when you’re winning.

### Special moves
- **Castling**: the king moves two squares toward a rook and the rook jumps over. Allowed only if neither piece has moved, the squares between are empty, and the king is not in check, does not pass through check, and doesn’t land in check.
- **Promotion**: a pawn reaching the last rank becomes a queen (or rook, bishop, knight).
- **En passant**: if a pawn moves two squares and lands beside your pawn, you may capture it as if it had moved only one square, but only on the very next move.`,
          },
          { kind: 'board', fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', caption: 'Stalemate! Black to move is not in check but has no legal move. Draw, despite White having a whole queen.', squares: ['h8'] },
          { kind: 'exercise', fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', prompt: 'White to move. Checkmate in one.', solutions: ['Re8#'], explain: 'Re8# is the famous **back-rank mate**: Black’s own pawns trap the king.' },
        ],
      },
    ],
  },
  {
    id: 'openings',
    title: '2. Opening principles',
    goal: 'Start every game with a healthy position using principles instead of memorised moves.',
    lessons: [
      {
        id: 'opening-rules',
        title: 'The golden rules of the opening',
        minutes: 7,
        sections: [
          {
            kind: 'text',
            md: `The opening has three jobs. Do them in roughly this order:

### 1. Fight for the centre
The squares **d4, e4, d5, e5** are the most important on the board. Pieces in the centre control more squares, and pawns there take space from your opponent. Moves like 1.e4 and 1.d4 do this immediately.

### 2. Develop your pieces
Bring **knights and bishops** out, ideally toward the centre. A typical rule: "knights before bishops". Every move in the opening should bring a new piece into play.

### 3. Castle and connect your rooks
Castle within the first ~10 moves. Your king is safe, and your rooks connect.

### Things to avoid
- Moving the **same piece twice** without a reason.
- Bringing the **queen out early**: it gets chased and you lose time.
- Grabbing pawns while you’re undeveloped.
- Moving the **f-pawn** early: it weakens your king.`,
          },
          { kind: 'board', setup: 'e4 e5 Nf3 Nc6 Bc4 Bc5 O-O Nf6 d3 O-O', caption: 'A model opening for both sides: centre pawns, knights and bishops out, kings castled. Ten moves, ten useful moves.', squares: ['d4', 'e4', 'd5', 'e5'] },
          { kind: 'exercise', setup: 'e4 e5 Qh5 Nc6 Bc4', prompt: 'Black to move. White threatens Qxf7#. Stop it!', solutions: ['g6', 'Qe7', 'Qf6'], explain: 'Block or defend f7. **g6** is best: it blocks the queen and prepares ...Nf6 with tempo. (…Nf6?? loses to Qxf7#.)' },
        ],
      },
      {
        id: 'repertoire-intro',
        title: 'Building your first repertoire',
        minutes: 4,
        sections: [
          {
            kind: 'text',
            md: `You don’t need to know every opening. You need **one answer to each common move**:
- As White: one first move (1.e4 or 1.d4) and a plan against each main reply.
- As Black vs 1.e4: one defence (we recommend **1...e5**).
- As Black vs 1.d4: one defence (we recommend the **Queen’s Gambit Declined**).

Go to the **Openings** tab. Study each line once, then use **Drill** mode until you can play it from memory. More importantly, read the **ideas**: when your opponent leaves the book on move 5, the ideas tell you what to do.

Rule of thumb by rating: under 1200, spend at most 10% of your study time on openings. Tactics win your games at this level.`,
          },
        ],
      },
    ],
  },
  {
    id: 'tactics',
    title: '3. Tactics',
    goal: 'Recognise the patterns that win material. Most games below 1800 are decided by tactics.',
    lessons: [
      {
        id: 'forks',
        title: 'Forks: attacking two things at once',
        minutes: 5,
        sections: [
          {
            kind: 'text',
            md: `A **fork** is a single move that attacks two (or more) targets. Your opponent can only save one.

Knights are the best forkers because their attack can’t be blocked, but every piece can fork: pawns fork two pieces, queens fork a king and a loose piece.

**Pattern to look for:** two enemy pieces (or king + piece) that are a knight’s jump apart from the same square, or **loose pieces** (undefended) anywhere. "Loose pieces drop off" (LPDO).`,
          },
          { kind: 'exercise', fen: 'q3k3/8/8/3N4/8/8/7P/4K3 w - - 0 1', prompt: 'White to move. Find the fork.', solutions: ['Nc7+'], explain: 'Nc7+ forks king and queen.' },
        ],
      },
      {
        id: 'pins-skewers',
        title: 'Pins and skewers',
        minutes: 6,
        sections: [
          {
            kind: 'text',
            md: `A **pin**: a piece can’t (or shouldn’t) move because a more valuable piece is behind it on the same line.
- **Absolute pin**: the piece behind is the king, so moving is illegal.
- **Relative pin**: the piece behind is valuable (e.g. the queen), so moving would lose material. (Remember Légal’s Mate: a relative pin can be broken!)

A **skewer** is a pin in reverse: the **more valuable** piece is in front. It must move, and the piece behind it falls.

Only bishops, rooks and queens (line pieces) can pin or skewer.`,
          },
          { kind: 'board', setup: 'e4 e5 Nf3 Nc6 Bb5 Nf6 Nc3 d6', caption: 'After ...d6 opened the diagonal, the b5 bishop pins the c6 knight to the king (b5–c6–d7–e8). It is an absolute pin: the knight cannot legally move.', arrows: ['b5e8'], squares: ['c6'] },
          { kind: 'exercise', fen: '6q1/8/4k3/8/8/8/1P6/3BK3 w - - 0 1', prompt: 'White to move. Win the queen with a skewer.', solutions: ['Bb3+'], explain: 'Bb3+ checks the king along the diagonal; when the king steps aside, Bxg8 wins the queen behind it.' },
        ],
      },
      {
        id: 'discovered',
        title: 'Discovered attacks and double check',
        minutes: 5,
        sections: [
          {
            kind: 'text',
            md: `A **discovered attack**: one piece moves out of the way and **uncovers** an attack by a piece behind it. The moving piece makes its own threat at the same time: two attacks in one move.

If both pieces give check, it’s a **double check**: the king MUST move, because you can’t block or capture two checkers at once. Double checks are the most powerful moves in chess.`,
          },
          { kind: 'exercise', fen: '4k3/1q6/8/8/4N3/8/8/4R1K1 w - - 0 1', prompt: 'White to move. The rook is aiming at the king through your knight. Win the queen.', solutions: ['Nd6+'], explain: '**Nd6+** is a **double check**: the rook and the knight both give check, so Black can’t block and must move the king. Then Nxb7 wins the queen. Compare Nc5+?, which also attacks b7, but Black simply blocks with ...Qe7 and only loses the queen for the rook.' },
        ],
      },
      {
        id: 'mating-patterns',
        title: 'Checkmate patterns',
        minutes: 6,
        sections: [
          {
            kind: 'text',
            md: `Learn these by heart: they appear again and again.
- **Back-rank mate**: a rook or queen mates a king trapped behind its own pawns. Prevent it by making "luft" (a pawn move like h3 or h6).
- **Smothered mate**: a knight mates a king surrounded by its own pieces.
- **Scholar’s mate**: Qxf7# supported by a bishop on c4.
- **Ladder mate**: two rooks (or rook + queen) push the king to the edge rank by rank.
- **Queen + king mate**: the basic endgame mate. Use the queen to restrict the king, then bring your king close.`,
          },
          { kind: 'exercise', fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', prompt: 'White to move. Mate in one with the knight.', solutions: ['Nf7#'], explain: 'Nf7# is a **smothered mate**: Black’s own rook and pawns block every escape square.' },
          { kind: 'exercise', fen: '7k/8/6K1/8/8/8/8/1Q6 w - - 0 1', prompt: 'White to move. Finish the queen + king mate.', solutions: ['Qb8#'], explain: 'Your king covers g7 and h7, so **Qb8#** checks along the back rank and the king has nowhere to go. Careful: a quiet queen move like Qb7?? or Qf5 that doesn’t give check can be **stalemate**.' },
        ],
      },
    ],
  },
  {
    id: 'thinking',
    title: '4. How to think during a game',
    goal: 'Stop blundering. A reliable thinking routine is worth 200–400 rating points on its own.',
    lessons: [
      {
        id: 'blunder-check',
        title: 'The blunder check: Checks, Captures, Threats',
        minutes: 6,
        sections: [
          {
            kind: 'text',
            md: `Before **every** move, ask two questions.

### 1. What does my opponent’s last move want?
Every move has a purpose: a threat, a plan, or a trap. Find it before doing anything else.

### 2. Is my move safe? (CCT)
Imagine you’ve played your candidate move. Now look at the board from your opponent’s side and list all their:
- **C**hecks
- **C**aptures
- **T**hreats

If any of them hurts you, find a different move. This takes 10 seconds and prevents most blunders.

### Then look for your own CCT
Apply the same scan for yourself: forcing moves first. Tactics hide in checks and captures.

### Hanging pieces
Before moving, count: is every one of your pieces defended? Is any enemy piece **loose**?`,
          },
          { kind: 'exercise', setup: 'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5', prompt: 'Black to move. White’s knight just "broke the pin" and took on e5. The queen on d1 is hanging. What should Black do?', solutions: ['dxe5', 'Be6'], explain: '...Bxd1?? loses to Bxf7+ Ke7 Nd5# (Légal’s Mate). CCT shows White’s checks: Bxf7+! Take the knight with **dxe5** instead; Black is only a pawn down.' },
        ],
      },
      {
        id: 'review-games',
        title: 'How to review your own games',
        minutes: 5,
        sections: [
          {
            kind: 'text',
            md: `The fastest way to improve is to learn from **your** mistakes. After every serious game:

1. **First, without an engine**, go through the game and write down where you think it went wrong and what you were thinking.
2. **Then** use the **Games** tab to analyse it. Compare your ideas to the engine.
3. For each **mistake or blunder**, ask: *why* did I miss it? Didn’t look at checks? Time trouble? Didn’t know the plan?
4. Your blunders become puzzles in the **Train** tab automatically. Solve them until they’re easy.

Look for patterns across many games: "I always blunder in time trouble" or "I lose in the endgame" tells you what to study next.`,
          },
        ],
      },
      {
        id: 'time',
        title: 'Time management and which games to play',
        minutes: 4,
        sections: [
          {
            kind: 'text',
            md: `- Play **rapid (15+10) or longer** to improve. Bullet and blitz train speed, not understanding. FIDE classical tournaments use 60–90+ minutes per player, so get used to thinking.
- Spend time on **critical moments**: when the position changes (captures, pawn breaks, opponent leaves the opening). Play obvious recaptures quickly.
- Never let your clock drop below ~10% early. Most club-level blunders happen in time pressure.
- Review every rapid/classical game you play.`,
          },
        ],
      },
    ],
  },
  {
    id: 'structure',
    title: '5. Strategy: pawns, pieces and plans',
    goal: 'Understand the "skeleton" of a position: where your pieces belong, which pawns are weak, which trades help you, and what plan to follow when there are no tactics.',
    lessons: [
      {
        id: 'pawn-structure',
        title: 'Pawn structure 101',
        minutes: 9,
        sections: [
          {
            kind: 'text',
            md: `Pawns are the **skeleton** of the position. They can’t move backward, so every pawn move is permanent. The pawn structure decides where your pieces belong and what plans make sense.

### Key terms
- **Doubled pawns**: two pawns on the same file. They can’t defend each other.
- **Isolated pawn**: no friendly pawns on the neighbouring files. It must be defended by pieces.
- **Passed pawn**: no enemy pawns in front of it on its own or neighbouring files. "Passed pawns must be pushed."
- **Pawn islands**: groups of connected pawns. Fewer islands is generally better.
- **Pawn chain**: pawns defending each other diagonally. Attack the **base** of the chain.
- **Majority**: more pawns than your opponent on one side of the board. A healthy majority can create a passed pawn.

The next lessons take each of these in turn: weak pawns, passed pawns, and the pieces that work best with each structure.`,
          },
          { kind: 'board', fen: '4k3/pp3ppp/8/8/8/2P5/P1P2PPP/4K3 w - - 0 1', caption: 'Doubled pawns: White’s c2 and c3 pawns are on the same file.', squares: ['c2', 'c3'] },
          { kind: 'board', fen: '4k3/pp3ppp/4p3/8/3P4/8/PP3PPP/4K3 w - - 0 1', caption: 'Isolated queen’s pawn (IQP): White’s d4 pawn has no neighbours on c or e. It controls e5 and c5 but can become a target.', squares: ['d4'] },
          { kind: 'board', fen: '4k3/5ppp/8/1P6/8/8/5PPP/4K3 w - - 0 1', caption: 'Passed pawn on b5: no black pawn can ever stop it. In endgames this is often decisive.', squares: ['b5'], arrows: ['b5b8'] },
          { kind: 'board', setup: 'e4 e6 d4 d5 e5 c5 c3 Nc6', caption: 'A pawn chain (French Advance): b2–c3–d4–e5. Black attacks the base with ...c5. White’s chain points at the kingside, so White attacks there.', arrows: ['c5d4'], squares: ['c3', 'd4', 'e5'] },
          { kind: 'board', fen: '4k3/p1p2p1p/8/8/8/8/PP3PPP/4K3 w - - 0 1', caption: 'Pawn islands: White has 2 islands, Black has 4. Black’s pawns are much weaker in an endgame.' },
        ],
      },
      {
        id: 'pawn-weaknesses',
        title: 'Weak pawns: isolated, backward, doubled',
        minutes: 8,
        sections: [
          {
            kind: 'text',
            md: `A pawn is **weak** when no other pawn can defend it, so pieces have to babysit it. A piece that defends a pawn isn’t attacking, so every weak pawn makes your whole army more passive.

### The three classic weaknesses
- **Isolated pawn**: no friendly pawns on the files next to it. The square in front of it is a perfect home for an enemy piece, because no pawn can ever chase that piece away.
- **Backward pawn**: its neighbours have moved ahead, so no pawn can protect it and it can’t advance safely. On a half-open file it becomes a target for rooks, and the square in front of it is a hole.
- **Doubled pawns**: two pawns on one file. They can’t protect each other, and in an endgame they are often worth little more than one pawn.

### How to play against a weak pawn
1. **Fix it**: stop it moving by putting a piece on the square in front of it (a **blockade**). Knights are the best blockaders.
2. **Attack it** more times than it can be defended: rooks down the file, minor pieces from the side.
3. **Trade pieces**: the fewer pieces left, the harder a weak pawn is to defend, and the more it matters in the endgame.

### How to play with a weak pawn
Weaknesses usually come with something in return: open files, active pieces, space. With an isolated d-pawn, keep the pieces on, attack, and look for the d4–d5 break before the position simplifies.`,
          },
          {
            kind: 'board',
            fen: 'r2q1rk1/pp1bbppp/2n1p3/3n4/3P4/2NB1N2/PP3PPP/R1BQR1K1 w - - 0 11',
            caption: 'An isolated queen’s pawn on d4. Black’s knight sits on d5, right in front of it: it blocks the pawn and no white pawn can ever chase it away. White’s compensation is active pieces and the open e-file for an attack.',
            squares: ['d4', 'd5'],
          },
          {
            kind: 'board',
            fen: 'r1bq1rk1/4bppp/pp1p1n2/4p3/P3P3/1NN5/1PP1BPPP/R2Q1RK1 w - - 0 12',
            caption: 'Black’s d6 pawn is backward: there is no black c-pawn and the e-pawn has gone to e5, so no pawn can defend d6, and d5 in front of it is a hole. White’s pieces fight for d5 (Bc4, Qd3, a knight to d5).',
            squares: ['d6', 'd5'],
            arrows: ['c3d5'],
          },
          {
            kind: 'exercise',
            fen: '3r4/pp2k1p1/6p1/8/8/8/PP4PP/3R2K1 w - - 0 1',
            prompt: 'White to move. Pawns are equal (4 each), but Black’s g-pawns are doubled. Which move turns that into a winning endgame?',
            solutions: ['Rxd8'],
            explain: '**1.Rxd8! Kxd8** gives a won king-and-pawn ending. Black’s doubled g-pawns can’t make a passed pawn, while White’s g- and h-pawns can: in effect White is a pawn up on the kingside. White’s king walks to g4 and h5 and wins. With the rooks still on, Black would have counterplay and White would be only slightly better.',
          },
        ],
      },
      {
        id: 'passed-pawns',
        title: 'Passed pawns',
        minutes: 8,
        sections: [
          {
            kind: 'text',
            md: `A **passed pawn** has no enemy pawns in front of it, on its own file or the files next to it. Only pieces can stop it, and each step forward makes it more dangerous: a passed pawn ties down an enemy piece that has to keep watching it.

- **Passed pawns must be pushed.** The further it gets, the more it costs your opponent to stop it.
- **Protected passed pawn**: defended by another pawn, so the enemy king can never take it. A lasting trump.
- **Outside passed pawn**: far away from the other pawns. In a king-and-pawn ending it lures the enemy king to one side while your king eats the pawns on the other.
- **Blockade**: the best way to stop a passed pawn is to put a piece directly in front of it, ideally a knight, which stays active while it blockades.
- **Rooks belong behind passed pawns** (Tarrasch’s rule): your rook behind your own passed pawn pushes it forward; behind the enemy’s passed pawn it chases it.

### How to make one
Use your **majority**: where you have more pawns than your opponent, advance the pawn that has no opponent in front of it first. A pawn breakthrough can even create one out of nothing.`,
          },
          { kind: 'board', fen: '4k3/pp3ppp/8/3P4/4P3/8/PP4PP/4K3 w - - 0 1', caption: 'A protected passed pawn: White’s d5 pawn has no black pawns on the c, d or e files ahead of it, and the e4 pawn defends it. The black king can never take it.', squares: ['d5', 'e4'] },
          { kind: 'board', fen: '1r4k1/5ppp/8/P7/8/8/5PPP/R5K1 w - - 0 1', caption: 'Tarrasch’s rule: White’s rook is behind the passed a-pawn, so it gets more active with every step the pawn takes. Black’s rook must stand in front of the pawn, where it only gets more passive.', arrows: ['a1a5'], squares: ['a5'] },
          { kind: 'board', fen: '8/5kpp/8/8/P7/6P1/5P1P/6K1 w - - 0 1', caption: 'An outside passed pawn on a4. Here Black’s king is even outside the "square" of the pawn (a4–a8–e8–e4), so a5–a6–a7–a8 simply runs. When the king can catch it, the pawn still drags it far away from the kingside.', arrows: ['a4a8'] },
          {
            kind: 'exercise',
            fen: '7k/ppp5/8/PPP5/8/8/8/7K w - - 0 1',
            prompt: 'White to move. Three pawns against three, and the kings are far away. Find the breakthrough that makes a queen by force.',
            solutions: ['b6'],
            explain: '**1.b6!** The middle pawn goes first. After **1...axb6 2.c6! bxc6 3.a6** or **1...cxb6 2.a6! bxa6 3.c6**, one white pawn is passed and Black’s king is too far away to catch it. Remember the pattern: three pawns on the 5th rank against three on the 7th, with the enemy king far away, and this breakthrough wins.',
          },
        ],
      },
      {
        id: 'open-files',
        title: 'Rooks: open files and the 7th rank',
        minutes: 8,
        sections: [
          {
            kind: 'text',
            md: `Rooks are the strongest pieces after the queen, but they need **open lines**. A rook stuck behind its own pawns is hardly better than a pawn.

- **Open file**: a file with no pawns on it. Put a rook there first and your opponent can’t use it without trading.
- **Half-open file**: only enemy pawns on it. Your rook presses against that pawn; rooks love files where the opponent has a weak pawn.
- **Doubling**: two rooks (or rook and queen) on the same file are far stronger than two separate rooks. The front one can invade, backed up by the other.
- **The 7th rank**: a rook on the 7th rank (the 2nd for Black) attacks pawns from the side, where they can’t protect each other, and traps the enemy king on the back rank. Two rooks on the 7th often win everything or give mate.
- **No open file?** Make one: a pawn exchange opens a file, and then your rooks take it.

### Watch your back rank
When the heavy pieces leave the back rank, check whether your king has an escape square. Many games are won by an invasion down an open file onto the back rank, and a single pawn move like h3 (called **luft**, "air") prevents it.`,
          },
          {
            kind: 'board',
            fen: '2r2rk1/pp3ppp/2p1p3/8/8/2P1P3/PP1R1PPP/3R2K1 w - - 0 1',
            caption: 'White’s rooks are doubled on the only open file. The d-file belongs to White: next comes Rd7, invading the 7th rank with the second rook behind it.',
            arrows: ['d2d7'],
          },
          {
            kind: 'exercise',
            fen: '2r3k1/pp3ppp/8/7q/8/8/PP1Q1PPP/3R2K1 w - - 0 1',
            prompt: 'White’s queen and rook are doubled on the open d-file. Use it: find the knockout.',
            solutions: ['Qd8+'],
            explain: '**1.Qd8+! Rxd8 2.Rxd8#**. The open file let both heavy pieces reach the 8th rank, and Black’s king has no escape square: a back-rank mate. If Black had played ...h6 earlier, the king would have had luft on h7.',
          },
          {
            kind: 'exercise',
            fen: 'r5k1/2RR2pp/8/2b5/8/8/5PPP/6K1 w - - 0 1',
            prompt: 'White’s rooks are doubled on the 7th rank. Find the move that wins Black’s rook.',
            solutions: ['Rxg7+'],
            explain: '**1.Rxg7+! Kf8 2.Rcf7+ Ke8 3.Rg8+ Kxf7 4.Rxa8.** The two rooks on the 7th tear away the pawns in front of the king, give a string of checks, and finally pick up the rook on a8. This is why a pair of rooks on the 7th rank is so feared.',
          },
        ],
      },
      {
        id: 'bishops',
        title: 'Good and bad bishops',
        minutes: 8,
        sections: [
          {
            kind: 'text',
            md: `A bishop only ever sees one colour of squares, so **your pawns decide how good it is**.

- **Bad bishop**: most of your pawns, especially your centre pawns, stand on the bishop’s colour. It bites on its own pawns and has few squares.
- **Good bishop**: your pawns stand on the other colour, so its diagonals are open.
- **Rule of thumb**: put your pawns on the opposite colour to your remaining bishop. Then pawns and bishop guard different squares and complement each other.
- **Fixing a bad bishop**: trade it for your opponent’s good bishop, or get it outside the pawn chain before the chain closes, or change the pawn structure with a break.
- **The bishop pair**: two bishops cover both colours and are a real advantage in open positions. If you have them, open the position; if your opponent has them, keep it closed.
- **Bishop or knight?** Bishops love open positions with pawns on both wings; knights love closed positions and outposts.
- **Opposite-coloured bishops**: in the middlegame they help the attacker, because each bishop attacks squares the other can’t defend. In the endgame they are famous for drawing, even a pawn or two down.`,
          },
          {
            kind: 'board',
            setup: 'e4 e6 d4 d5 e5',
            caption: 'French Defence: Black’s c8-bishop is the "bad" one. The pawns on e6 and d5 stand on light squares and shut it in. That is why Black often tries to trade it, for example with ...b6 and ...Ba6.',
            squares: ['c8', 'e6', 'd5'],
          },
          {
            kind: 'board',
            fen: '6k1/3b1pp1/p3p2p/1p1pP3/3N1P2/P5P1/1P4KP/8 w - - 0 1',
            caption: 'Good knight against bad bishop. Black’s a6, b5, d5, e6 and f7 pawns all stand on light squares, the same colour as the d7-bishop, so it has almost nothing to do. White’s knight on d4 eyes e6 and b5, and the dark squares are White’s.',
            squares: ['d7'],
          },
          {
            kind: 'exercise',
            fen: '8/4bk1p/p4pp1/1p2n3/8/P2B1NP1/5P1P/6K1 w - - 0 1',
            prompt: 'White is a pawn down. Find the trade that gives the best chance to save the game.',
            solutions: ['Nxe5+'],
            explain: '**1.Nxe5+! fxe5** leaves bishops of opposite colours: White’s bishop covers the light squares, Black’s the dark ones, and they can never fight each other. Black’s extra pawn is very hard to push through, and White can even win back material with a4. Stockfish rates every other move clearly worse.',
          },
        ],
      },
      {
        id: 'pieces-activity',
        title: 'Knights, outposts and your worst piece',
        minutes: 8,
        sections: [
          {
            kind: 'text',
            md: `Strategy is mostly about **improving your worst piece**. In a quiet position, ask: which of my pieces does the least? Then find it a better square.

### Knights and outposts
- A knight needs a **support point** close to the enemy: a square that no enemy pawn can ever attack. That is an **outpost**. A knight on an outpost on the 5th or 6th rank, protected by a pawn, can be worth more than a rook.
- **A knight on the rim is dim**: on the edge it controls only two to four squares instead of eight. Bring it back toward the centre.
- Knights are best in **closed positions**, where bishops are blocked and the knight hops over the pawns.

### Weak squares
A square your pawns can no longer defend is a **hole**. Every pawn move leaves squares behind it, so think before you push. Holes in the centre or in front of the enemy king are perfect homes for your knights.

### Activity checklist
- **Rooks**: open files, the 7th rank.
- **Bishops**: open diagonals, not blocked by your own pawns.
- **Knights**: outposts, the centre.
- **King**: safe in the middlegame, active in the endgame.
- **Queen**: not out too early, where it gets chased with tempo.`,
          },
          { kind: 'board', setup: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7', caption: 'After Black’s ...e5, the d5 square is a hole: no black pawn can ever attack it. White’s plan is to fight for it with Nc3–d5 and Bg5xf6, and to plant a piece there for good.', arrows: ['c3d5'], squares: ['d5'] },
          {
            kind: 'exercise',
            fen: 'r4rk1/pp3ppp/2p1b3/4p3/N3P3/1P6/P1P2PPP/R4RK1 w - - 0 1',
            prompt: 'White’s knight on a4 is on the rim. Find its best square.',
            solutions: ['Nc5'],
            explain: '**1.Nc5!** From the edge to a square near the centre where it hits the e6-bishop and the b7-pawn. After **1...b6 2.Nxe6 fxe6** Black is left with doubled, isolated e-pawns. A knight on the rim is dim: bring it back into play, ideally with a threat.',
          },
        ],
      },
      {
        id: 'pawn-breaks',
        title: 'Pawn breaks and where to attack',
        minutes: 8,
        sections: [
          {
            kind: 'text',
            md: `A **pawn break** is a pawn move that attacks an enemy pawn to open lines. In closed positions breaks are the only way to create play for your pieces, so choosing the right one is often the whole plan.

### Pawn chains
Pawns that defend each other diagonally form a chain. **Attack the base** of the chain, its rearmost pawn: if the base falls, the whole chain is weak.

### Where to attack
- **Play on the side where your pawn chain points.** In the French Advance (pawns d4 and e5) White’s chain points to the kingside, so White attacks there, while Black breaks on the queenside with ...c5.
- **The side with more space attacks; the cramped side frees itself with breaks.**
- **Kings castled on opposite sides**: both players throw their pawns at the enemy king, a **pawn storm**. Speed decides: open lines toward the king and don’t waste a single move.
- **Minority attack**: two pawns can attack three. In the Carlsbad structure White plays b4–b5 to leave Black with a weak c-pawn.

### Before you break
Get your pieces ready first. The break opens lines, and the side whose pieces are better placed uses them.`,
          },
          { kind: 'board', setup: 'e4 e6 d4 d5 e5', caption: 'Black’s two breaks against White’s chain: ...c5 attacks its base (d4), ...f6 attacks its head (e5).', arrows: ['c7c5', 'f7f6'], squares: ['d4', 'e5'] },
          {
            kind: 'board',
            setup: 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 c6 e3 Be7 Bd3 Nbd7 Qc2 O-O Nf3 Re8 O-O Nf8 Rab1',
            caption: 'The Carlsbad structure. White prepares the minority attack b4–b5: after bxc6 (or ...cxb5) Black is left with a weak pawn on the c-file. Black’s counterplay comes on the kingside.',
            arrows: ['b2b4', 'b4b5'],
          },
          {
            kind: 'exercise',
            fen: '5rk1/pp3ppp/5n2/8/6PQ/3B4/PPP5/2K5 w - - 0 1',
            prompt: 'The kings are on opposite sides. White to move: which pawn move breaks open Black’s king?',
            solutions: ['g5'],
            explain: '**1.g5!** attacks the f6-knight, the only defender of h7. After **1...Rd8 2.gxf6 gxf6 3.Qxh7+** Black’s king is stripped bare. A pawn storm works because a pawn can attack a piece without being afraid of being taken: it’s the cheapest piece on the board.',
          },
        ],
      },
      {
        id: 'center-king',
        title: 'The centre and king safety',
        minutes: 7,
        sections: [
          {
            kind: 'text',
            md: `The centre is the most important part of the board: pieces there reach both wings quickly, and a strong centre cramps your opponent.

- **Control the centre** with pawns (e4, d4) and with pieces aimed at it.
- **Castle early** when the centre is open or about to open. An uncastled king on an open file is a target for checks, pins and discovered attacks.
- **Don’t open the centre while your own king is still there**, but do open it when your opponent’s king is.
- **After castling, leave the pawns in front of your king alone.** Each pawn move there creates weak squares. One luft move (h3 or g3) is fine when you need protection from back-rank mates.
- **When the centre is locked** by pawn chains, the kings are safer and the play moves to the wings: attack where your chain points.
- **In the endgame** the king becomes a fighting piece: bring it to the centre.`,
          },
          {
            kind: 'exercise',
            setup: 'e4 e5 Nf3 Nf6 Nxe5 Nxe4',
            prompt: 'Black has just copied White and taken on e4, with the king still on e8. Find White’s strongest move.',
            solutions: ['Qe2'],
            explain: '**4.Qe2!** pins the knight on the open e-file. If **4...Nf6?? 5.Nc6+** is a discovered check from the queen and the knight takes the black queen next. After **4...Qe7 5.Qxe4 d6 6.d4 dxe5 7.dxe5** White keeps a small, lasting edge, and Black had to be careful just to keep the queen. Kings that stay in the centre get hit on open files.',
          },
          { kind: 'board', fen: '6k1/5pp1/7p/8/8/7P/5PP1/3R2K1 w - - 0 1', caption: 'Luft: both sides have pushed their h-pawn one square, so each king has an escape square and a rook check on the back rank is no longer mate.', squares: ['h3', 'h6'] },
        ],
      },
      {
        id: 'trades',
        title: 'When to trade pieces',
        minutes: 7,
        sections: [
          {
            kind: 'text',
            md: `Every trade changes the position. Don’t just ask whether a trade is equal; ask **what is left after it**.

### Trade when
- You are **ahead in material**: an extra pawn counts for more with fewer pieces on the board. Trade pieces, not pawns.
- You are **defending** an attack: trade off the attacking pieces.
- You are **cramped**: each trade gives your remaining pieces more room.
- It leaves your opponent with a **bad piece** or a weak pawn structure (trade their good bishop, keep your good knight).
- It leads to a **won pawn ending**. Count it out first.

### Avoid trades when
- You are **behind in material** or **attacking**: keep the pieces on and look for chances.
- Your opponent is **cramped**: let them suffocate.

### Pawn endings are the final count
When everything is traded, only kings and pawns are left, and those endings can be calculated to the end. Before you enter one, check: whose king reaches the action first, and who has an outside or protected passed pawn?`,
          },
          {
            kind: 'exercise',
            fen: '3r4/4kp1p/6p1/8/P7/6P1/5P1P/3R2K1 w - - 0 1',
            prompt: 'White is a pawn up. Which move wins the game?',
            solutions: ['Rxd8'],
            explain: '**1.Rxd8! Kxd8** reaches a won pawn ending, because White’s a-pawn is an outside passed pawn. Black’s king has to run to the queenside to stop it, and White’s king then eats Black’s kingside pawns. With the rooks still on (1.Re1+ or 1.Ra1) White is better, but far from winning.',
          },
        ],
      },
      {
        id: 'planning',
        title: 'Making a plan',
        minutes: 6,
        sections: [
          {
            kind: 'text',
            md: `When there are no tactics, ask these questions in order:
1. **King safety**: is either king weak?
2. **Material**: who is ahead?
3. **Pawn structure**: weak pawns (isolated, doubled, backward), holes, passed pawns?
4. **Piece activity**: which is my worst piece? How can I improve it?
5. **Space**: who controls more of the board? The side with more space attacks; the side with less tries to trade pieces and break free.

Then form a simple plan: "put my knight on d5", "double rooks on the c-file", "push my queenside majority". A mediocre plan beats no plan.

**Where to attack:** where your pawn chain points, and on the side of the board where you have more space.`,
          },
          {
            kind: 'board',
            fen: 'r1bq1rk1/4bppp/pp1p1n2/4p3/P3P3/1NN5/1PP1BPPP/R2Q1RK1 w - - 0 12',
            caption: 'A worked example. Kings: both safe. Material: equal. Structure: Black’s d6 pawn is backward and d5 is a hole. Worst piece: the b3-knight. Plan: Bc4, Qd3 and Nd2 bring every white piece to bear on d5; once a white piece lands there for good, Black is passive.',
            squares: ['d5', 'd6'],
            arrows: ['e2c4', 'b3d2'],
          },
        ],
      },
    ],
  },
  {
    id: 'endgames',
    title: '6. Endgames',
    goal: 'Convert winning positions and save bad ones. Endgames are where rating points are quietly won and lost.',
    lessons: [
      {
        id: 'kp-endgames',
        title: 'King and pawn: opposition and the square',
        minutes: 8,
        sections: [
          {
            kind: 'text',
            md: `In the endgame the **king becomes an attacking piece**. Activate it!

### The opposition
When two kings face each other with **one square between them**, the side that does **not** have to move "has the opposition". It’s like a standoff: whoever must move has to give way.

In king + pawn vs king, the attacker wants to get his king **in front of** the pawn and take the opposition. Then the pawn promotes.

### The rule of the square
Can a king catch a passed pawn? Draw a square from the pawn to the promotion rank. If the king can step into that square, it catches the pawn.

### Key rule
King + pawn vs king: if the attacking king reaches the **6th rank in front of its pawn**, it wins (except with a rook pawn on the a- or h-file).`,
          },
          { kind: 'board', fen: '8/8/8/4k3/8/4K3/8/8 w - - 0 1', caption: 'Opposition: the kings face each other with one square between. Neither may step forward. White must move and give way, so Black has the opposition.', squares: ['e3', 'e5', 'e4'] },
          { kind: 'board', fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', caption: 'King on the 6th in front of the pawn: White wins no matter who moves.', squares: ['e6'] },
        ],
      },
      {
        id: 'rook-endgames',
        title: 'Rook endgames: Lucena and Philidor',
        minutes: 8,
        sections: [
          {
            kind: 'text',
            md: `Rook endgames are the **most common** endgames. Two positions are essential:

### Philidor (the defence)
Defender’s king is in front of the pawn. Keep your rook on the **6th rank** (your 3rd rank) so the enemy king can’t advance. When the pawn moves to the 6th, swing your rook to the back and check from behind. Draw.

### Lucena (the win)
Attacker’s king is in front of his own pawn on the 7th, and the defending king is cut off. The winning method is "**building a bridge**": put your rook on the 4th rank so it can block the checks.

"All rook endgames are drawn" is a joke, but it’s close to true. When in doubt, activate your rook.`,
          },
          { kind: 'board', fen: '4k3/R7/1r6/3KP3/8/8/8/8 b - - 0 1', caption: 'Philidor position: Black keeps the rook on b6 (the 6th rank). If e6, the rook goes to b1 and checks from behind.', arrows: ['b6b1'] },
          { kind: 'board', fen: '3K4/3P1k2/8/8/8/8/2r5/4R3 w - - 0 1', caption: 'Lucena position: White plans Rf1+, then Rf4! to build a bridge for the king to escape the checks.', arrows: ['e1f1', 'f1f4'] },
        ],
      },
      {
        id: 'basic-mates',
        title: 'The basic checkmates: queen, rook, two bishops, bishop and knight',
        minutes: 9,
        sections: [
          {
            kind: 'text',
            md: `When you are a piece or more up and the board has emptied, you must be able to finish. These are the mates against a lone king that every player needs, from easiest to hardest:

- **King and queen** (about 10 moves): keep the queen a knight’s jump from the enemy king to shrink its box, push it to the edge, then bring your king next to it and mate.
- **King and rook** (up to about 16 moves): cut the king off with the rook, walk your king up, and when the kings face each other give the check that pushes the king back one rank. Repeat until it reaches the edge.
- **Two bishops** (up to about 19 moves): side by side they form a diagonal wall the king can’t cross. Shrink its area, bring your king, and mate in any corner.
- **Bishop and knight** (up to 33 moves, the hardest): you can only mate in a corner of your **bishop’s colour**. If the king runs to the other corner, drive it along the edge with the knight’s “W manoeuvre”.
- **Two knights**: can’t force mate. With correct defence it is a draw; mates only happen if the defender walks into one.

### The golden rule
Before every move, ask: *does the enemy king still have a legal move?* If you take its last square without giving check, it is **stalemate**: a draw.

Practise each of these against the computer in **Practice → Endgame drills**.`,
          },
          { kind: 'board', fen: 'R5k1/8/6K1/8/8/8/8/8 b - - 0 1', caption: 'Rook mate: the kings face each other, and the rook checks along the edge. The king has nowhere to go.' },
          { kind: 'board', fen: '7k/8/6K1/8/2BB4/8/8/8 b - - 0 1', caption: 'Two-bishop mate: the dark-squared bishop checks on the long diagonal, the light-squared bishop takes g8, and the king covers g7 and h7.' },
          { kind: 'board', fen: '1k6/1B6/1KN5/8/8/8/8/8 b - - 0 1', caption: 'Bishop-and-knight mate in a light corner: the knight gives check, the bishop and king cover every escape square.' },
          { kind: 'board', fen: '7k/8/5NKN/8/8/8/8/8 b - - 0 1', caption: 'Why two knights can’t win: here Black has no legal move but is not in check. That is stalemate, a draw. Every attempt to force mate ends like this or lets the king out.' },
          { kind: 'exercise', fen: '6k1/8/6K1/8/8/8/8/R7 w - - 0 1', prompt: 'White to move. Mate in one with the rook.', solutions: ['Ra8#'], explain: '**Ra8#**. The kings face each other, so the black king can’t step forward, and the rook covers the whole 8th rank.' },
          { kind: 'exercise', fen: '7k/8/6K1/8/2B5/4B3/8/8 w - - 0 1', prompt: 'White to move. Mate in one with the two bishops.', solutions: ['Bd4#'], explain: '**Bd4#**. The dark-squared bishop checks along the long diagonal, the light-squared bishop on c4 already covers g8, and your king covers g7 and h7.' },
          { kind: 'exercise', fen: '1k6/1B6/1K6/N7/8/8/8/8 w - - 0 1', prompt: 'White to move. Mate in one with bishop and knight.', solutions: ['Nc6#'], explain: '**Nc6#**. The knight checks from c6; a8 and c8 are covered by the bishop, a7 and c7 by your king, and the bishop on b7 is protected by the king.' },
        ],
      },
      {
        id: 'pawn-endgame-technique',
        title: 'Pawn endgames: races, outside passed pawns and spare moves',
        minutes: 8,
        sections: [
          {
            kind: 'text',
            md: `In a pawn endgame everything can be calculated, and one tempo decides the game. So count instead of guessing.

### Count the race
When both sides have a passed pawn, count how many moves each needs to promote. The one who gets there first usually wins, and promoting **with check** gains an extra move. Before you start the race, check whether the enemy king can catch your pawn (the rule of the square).

### The outside passed pawn
A passed pawn far from the other pawns is a decoy. The enemy king has to run over to stop it, and while it does, your king walks to the other wing and eats the pawns there.

### Zugzwang and spare moves
Often the side to move loses, because every king move gives way. Then a spare pawn move (a **tempo**) that changes nothing else wins the game: keep such pawn moves in reserve, and don’t waste them early.

### Triangulation
When the kings are locked in a fight for the opposition, the side with more room can walk its king around a triangle of three squares. It arrives back on the same square, but now with the opponent to move, who can’t copy the manoeuvre.`,
          },
          { kind: 'exercise', fen: '8/p7/8/8/8/8/5k1P/1K6 w - - 0 1', prompt: 'White to move. Both sides have a passed pawn. Which move wins?', solutions: ['h4'], explain: '**1.h4!** Push the pawn right away: after 1...Kg3 2.h5 the black king is one step too late, and White queens long before the a-pawn. Any other move gives the black king time to reach the h-pawn, and the game is a draw.' },
          { kind: 'exercise', fen: '8/5kpp/8/8/P7/6P1/5P1P/6K1 w - - 0 1', prompt: 'White to move. White has an outside passed pawn. What is the fastest way to win?', solutions: ['a5'], explain: '**1.a5!** The black king is outside the “square” of the pawn (a5–a8–d8–d5), so the pawn simply runs: a6, a7, a8. When the king is close enough to catch it, the outside pawn still wins by dragging it away from the kingside pawns.' },
        ],
      },
      {
        id: 'minor-endgames',
        title: 'Bishop and knight endgames',
        minutes: 8,
        sections: [
          {
            kind: 'text',
            md: `### The wrong rook pawn
A bishop and a rook pawn can’t win if the bishop doesn’t control the promotion square (here: a light-squared bishop and an h-pawn, which promotes on the dark h8 square). If the defending king reaches that corner, it can never be driven out: a draw, even with the extra bishop.

### Opposite-coloured bishops
When each side has one bishop and they run on different colours, the defender blockades the pawns on the squares its own bishop controls, and the attacker’s bishop can never challenge it. Such endgames are often drawn even two pawns down. In the middlegame it’s the opposite: they help the attacker.

### Bishop against knight
- The **bishop** is better with pawns on both wings and an open position: it switches sides in one move.
- The **knight** is better when all the pawns are on one side, or the position is closed, especially when the bishop is “bad”.
- **Knights struggle against rook pawns**: on the edge of the board they have few ways to reach the pawn.

### Knight endgames
They play like pawn endgames: an active king and a passed pawn decide. Knights are slow, so count the jumps before you go after a pawn.`,
          },
          { kind: 'board', fen: '7k/8/6K1/7P/8/3B4/8/8 b - - 0 1', caption: 'The wrong rook pawn: White is a bishop and a pawn up, but the bishop is light-squared and h8 is dark. The black king shuffles between h8 and g8, and the game is a draw.', squares: ['h8'] },
          { kind: 'exercise', fen: '8/4k3/8/7P/5K2/3B4/8/8 b - - 0 1', prompt: 'Black to move. You are a bishop and a pawn down. Save the game.', solutions: ['Kf7', 'Kf8'], explain: 'Head for the corner: **1...Kf7** (or 1...Kf8) and then g8–h8. White’s bishop is light-squared and can never drive your king out of the dark h8 corner, so it’s a draw. Wandering to the centre with 1...Ke6? or 1...Kf6? loses: the pawn runs before you arrive.' },
        ],
      },
      {
        id: 'queen-endgames',
        title: 'Queen endgames: queen against a pawn',
        minutes: 6,
        sections: [
          {
            kind: 'text',
            md: `A queen usually beats a pawn on the 7th rank, even when your king is far away. The method:

1. **Check, or pin, until the enemy king has to stand in front of its own pawn.** For one move the pawn can’t advance.
2. **Use that move to bring your king one step closer.**
3. **Repeat** until your king helps win the pawn. Then queen against a lone king is an easy mate.

### The two exceptions
With the pawn on the **c- or f-file**, the defending king hides in the corner instead of blocking: if the queen takes the pawn, it is stalemate. With a **rook pawn** (a- or h-file) the king hides in front of its pawn, and every attempt also ends in stalemate. Both are draws unless the stronger side’s king is already close.

Practise both in **Practice → Endgame drills**: “Queen vs pawn on the 7th” (win it) and “Hold the draw: queen vs bishop pawn”.`,
          },
          { kind: 'board', fen: '7K/8/8/8/8/8/3pk3/Q7 w - - 0 1', caption: 'A d-pawn on the 7th: White wins with the check-and-approach method, even with the king on h8.', squares: ['d2'] },
          { kind: 'board', fen: '6K1/8/8/8/8/1Q6/2p5/k7 w - - 0 1', caption: 'The stalemate trick with a c-pawn: 1.Qxc2 is stalemate, and anything else lets the pawn queen or allows more checks to be met the same way. With the white king this far away, it’s a draw.', squares: ['a1', 'c2'] },
        ],
      },
    ],
  },
  {
    id: 'club',
    title: '7. Club skills (1000–1500)',
    goal: 'Calculate forcing lines, attack a castled king soundly, and turn winning positions into wins.',
    lessons: [
      {
        id: 'calculation',
        title: 'How to calculate',
        minutes: 8,
        sections: [
          {
            kind: 'text',
            md: `Calculation is not "seeing far". It is a routine you can learn.

### 1. List candidate moves
Start with the **forcing moves**: checks, then captures, then threats. Forcing moves limit your opponent’s replies, so you can actually calculate them to the end. Quiet moves come after.

### 2. Calculate one line at a time
For each candidate, play it out in your head: your move, the opponent’s **best** reply (not the one you hope for), your next move. Keep going until the position is quiet or clearly winning or losing.

### 3. Check the final position
At the end of the line, do a blunder check *in that position*: does the opponent have a check, a capture or a threat you missed? Many lost games come from a line that was calculated correctly up to its last move.

### 4. Compare and choose
Only now pick the best line. If nothing forcing works, play a good quiet move instead of a hopeful sacrifice.

**Tip:** in puzzles, always ask "what is my most forcing move?" first. That habit carries straight into your games.`,
          },
          {
            kind: 'exercise',
            fen: 'r2r1bk1/R6p/5pp1/1p1Np3/1P1nP1B1/8/5PPP/6K1 w - - 2 35',
            prompt: 'White to move. Find the forcing move that leads to mate in 2.',
            solutions: ['Nxf6+'],
            explain: '**Nxf6+** is a check, so Black has only one reply: **Kh8**. Then **Rxh7#**: the rook on h7 is protected by the knight on f6 and the king has no squares. This pattern is called the **Arabian mate**.',
          },
          {
            kind: 'exercise',
            fen: '2r3k1/pbqn1Npn/1p5p/2ppN3/3P4/2P3P1/PPQ2PP1/4R1K1 w - - 0 22',
            prompt: 'White to move. Checks first: find the sacrifice that mates in 3.',
            solutions: ['Nxh6+'],
            explain: '**Nxh6+ gxh6 Qg6+ Kh8 Nf7#**. The knight sacrifice tears open the king’s pawn shield, the queen checks from g6, and the other knight mates on f7. Every move is a check, which is why it can be calculated to the end.',
          },
        ],
      },
      {
        id: 'king-attack',
        title: 'Attacking the castled king',
        minutes: 8,
        sections: [
          {
            kind: 'text',
            md: `Before you attack the king, count: **how many of your pieces can reach the king’s side, and how many defenders does it have?** An attack with more attackers than defenders usually works; one with fewer usually fails.

### Ways to break the king’s shelter
- **Open lines** toward the king: pawn breaks like f4–f5 or h4–h5, and rooks on open files.
- **Remove the defenders**: trade or deflect the knight on f6, the most important defender of a castled king.
- **Sacrifice on h7, g7 or h6** when your pieces are ready to pour in afterwards.

### The Greek gift (Bxh7+)
A famous sacrifice: the bishop takes on h7 with check, the knight jumps to g5 with check, and the queen comes to h5 threatening mate on h7. It only works when the conditions are right:
- your bishop can take on h7 **with check**,
- your knight can reach **g5** and nothing can simply take it there,
- your queen can reach **h5** (or the h-file) quickly,
- there is **no black knight on f6** (often a pawn on e5 keeps it away).

If one condition is missing, calculate very carefully: an unsound sacrifice just loses a piece.

### Checks that uncover attacks
Even when no mate is possible, a check on the king can unleash another piece. The bishop takes on h7 with check, and the rook behind it suddenly attacks the queen.`,
          },
          {
            kind: 'exercise',
            fen: 'r3r1k1/pb3ppp/1p6/2bpP3/3q2Q1/3B4/PPP3PP/3RR2K w - - 2 18',
            prompt: 'White to move. Black’s queen just came to d4. Win it.',
            solutions: ['Bxh7+'],
            explain: '**Bxh7+!** gives check, and the bishop’s move uncovers the rook on d1. After **Kxh7 Rxd4** White wins the queen for a bishop: a **discovered attack**.',
          },
        ],
      },
      {
        id: 'converting',
        title: 'Converting a won game',
        minutes: 6,
        sections: [
          {
            kind: 'text',
            md: `Being ahead is not the same as winning. At club level many winning positions are thrown away by relaxing. When you are ahead:

- **Trade pieces, not pawns.** Every piece trade makes your extra material count for more, and the endgame becomes easy.
- **Kill counterplay first.** Before you go for more, ask what your opponent’s best try is (an attack on your king, a passed pawn, a back-rank trick) and stop it.
- **Push passed pawns** with support: the king and rooks behind or beside them.
- **Don’t rush.** A safe, slow move beats a "fast" move that allows a trick. Keep doing the blunder check every move.
- **Know your basic endgames.** If you can mate with king and queen or king and rook, and win king-and-pawn endings, you can trade down without fear. The **Practice → Endgame drills** train exactly this.`,
          },
          {
            kind: 'exercise',
            fen: '3r2k1/p2P1pp1/1p5p/2p5/5r2/1R6/6PP/3R2K1 w - - 0 31',
            prompt: 'White to move. The pawn on d7 is your trump. Find the quiet move that makes it decisive.',
            solutions: ['Re3'],
            explain: '**Re3!** heads for e8 to support the pawn’s promotion. After **…Kh7 Re8** Black has to give up a rook: **…Rxd7 Rxd7**, and White is a full rook up. No check, no capture, just the right square for the rook.',
          },
        ],
      },
    ],
  },
  {
    id: 'career',
    title: '8. Your road to a FIDE rating',
    goal: 'Understand how ratings work, how to get an official FIDE rating, and how to train like someone who wants a chess career.',
    lessons: [
      {
        id: 'fide-rating',
        title: 'How to get a FIDE rating',
        minutes: 7,
        sections: [
          {
            kind: 'text',
            md: `Online ratings (chess.com, lichess) are not official. The official, worldwide rating is the **FIDE rating**, run by FIDE, the international chess federation.

### Steps
1. **Register with your national chess federation** (for example AICF in India, US Chess in the USA, ECF in England). Through them you get a **FIDE ID**.
2. **Play FIDE-rated tournaments.** Check the tournament announcement for "FIDE rated". Classical, rapid and blitz have **separate** FIDE ratings; classical is the most important.
3. **Play enough games against rated opponents.** Under the current rules (since 2024) you need games against at least **5 FIDE-rated opponents** before your first rating is published, and the lowest rating is **1400**. Rules do change, so check the current FIDE Rating Regulations or ask your federation.
4. Your rating then goes up or down after every rated tournament.

### How ratings move
Elo ratings compare your result to the expected result. Beating a higher-rated player gives many points; losing to a lower-rated player costs many. New players have a high **K-factor**, so their rating moves fast.

### Titles
- **CM** (Candidate Master): reach 2200.
- **FM** (FIDE Master): reach 2300.
- **IM** (International Master): 3 IM norms + 2400.
- **GM** (Grandmaster): 3 GM norms + 2500.

A **norm** is a strong performance in a qualifying tournament against titled players.`,
          },
        ],
      },
      {
        id: 'training-plan',
        title: 'A training plan that actually works',
        minutes: 6,
        sections: [
          {
            kind: 'text',
            md: `Serious players train every day, not only play. A simple weekly structure:

### Every day (45–90 minutes)
- **Tactics: 20–30 min.** Puzzles, including the ones made from your own mistakes in the **Train** tab.
- **Play or study: 30–60 min.** One rapid game (15+10 or longer), then review it.

### Every week
- 2–3 rapid/classical games, **all reviewed**.
- One classic master game played through slowly (**Masters** tab). Guess each move before looking.
- One endgame lesson.
- Drill your openings once.

### By rating (online rapid)
- **< 1000**: blunder check, basic tactics (forks, pins), basic mates. Don’t hang pieces.
- **1000–1400**: tactics every day, opening principles, a simple repertoire, K+P endgames.
- **1400–1800**: deeper calculation, pawn structure, rook endgames, review every game.
- **1800+**: annotated master games, opening files, a coach and over-the-board tournaments.

### Over-the-board play
Start playing **local FIDE-rated tournaments** as soon as you can. Classical games against real opponents are the fastest way to grow, and that’s how your FIDE rating is born.`,
          },
        ],
      },
    ],
  },
];

export const ALL_LESSONS: Lesson[] = CHAPTERS.flatMap((c) => c.lessons);

export function findLesson(id: string) {
  for (const c of CHAPTERS) {
    const l = c.lessons.find((x) => x.id === id);
    if (l) return { chapter: c, lesson: l };
  }
  return undefined;
}
