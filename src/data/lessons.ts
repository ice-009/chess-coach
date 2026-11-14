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
          { kind: 'exercise', fen: '6k1/5ppp/8/3q4/8/1B6/5PPP/6K1 w - - 0 1', prompt: 'White to move. The black queen on d5 has no defender, and your bishop on b3 attacks it. Take it.', solutions: ['Bxd5'], explain: '**Bxd5**. Read it as **B** (bishop), **x** (captures), **d5** (the square). You have won 9 points for nothing. Every capture in a game score looks like this: piece letter, x, square.' },
          { kind: 'exercise', fen: '4k3/ppp2ppp/8/3n4/4P3/8/PPP2PPP/4K3 w - - 0 1', prompt: 'White to move. Capture the knight with a pawn.', solutions: ['exd5'], explain: '**exd5**. Pawns have no letter, so a pawn capture starts with the **file the pawn came from**: the e-pawn captures on d5. Remember that pawns move straight ahead but capture diagonally.' },
          { kind: 'exercise', fen: '8/1P6/3k4/8/8/8/8/6K1 w - - 0 1', prompt: 'White to move. Your pawn is one step from the last rank, and the black king is coming to stop it. Make a new queen.', solutions: ['b8=Q+'], explain: '**b8=Q+**. A promotion is written with **=** and the new piece, and here the new queen even gives check on the b8–h2 diagonal. If you wait one move, ...Kc7 attacks the pawn and the chance is gone.' },
          { kind: 'exercise', fen: '5rk1/5pp1/8/8/8/3Q4/2B2PPP/6K1 w - - 0 1', prompt: 'White to move. Give checkmate in one move.', solutions: ['Qh7#'], explain: '**Qh7#**. The **#** means checkmate. The queen on h7 is protected by the bishop on c2 behind it, so the king can’t take it, and its own rook on f8 and pawns on f7 and g7 take away every other square.' },
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
          { kind: 'exercise', fen: '6k1/3n1pp1/7p/8/r2R4/8/5PPP/6K1 w - - 0 1', prompt: 'White to move. Your rook can take the rook on a4 or the knight on d7. Which capture is worth more?', solutions: ['Rxa4'], explain: '**Rxa4** wins a rook, worth 5 points. **Rxd7** would only take a knight (3), and Black would keep the rook. When you have a choice of captures, count first and take the bigger piece.' },
          { kind: 'exercise', fen: '3r2k1/pp3p1p/2n2p2/8/4r1b1/5N2/PP3PPP/R3R1K1 w - - 0 17', prompt: 'White to move. Count the points: which capture wins the most material?', solutions: ['Rxe4'], explain: '**Rxe4** takes an undefended rook (+5). Black can take your knight with **...Bxf3** (−3), but **gxf3** takes the bishop back (+3). In total you are 5 points better off. When pieces are traded, add up everything that leaves the board, not just the first capture.' },
          { kind: 'exercise', fen: 'r5k1/ppp2ppp/2n1n3/8/3P4/8/PPP2PPP/R1B2BK1 w - - 0 1', prompt: 'White to move. Material is equal. Use your cheapest piece to win one of the knights.', solutions: ['d5'], explain: '**d5!** A pawn (1 point) attacks both knights (3 points each). Only one of them can escape, so after **...Ncd4 dxe6 Nxe6** White has won a knight for a pawn. The pawn is the least valuable piece, which makes it the best attacker.' },
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
          { kind: 'exercise', fen: '6k1/5ppp/8/8/2B5/8/5PPP/3Rq1K1 w - - 0 1', prompt: 'White to move. Your king is in check from the queen on e1. Choose the best of the three ways out.', solutions: ['Rxe1'], explain: 'The three ways out of check: **move** the king (impossible here: f1 and h1 are both on the queen’s line), **block** (Bf1, but then ...Qxd1 wins your rook), or **capture**. **Rxe1** captures the checking queen and wins 9 points. Always look at all three.' },
          { kind: 'exercise', fen: '4R1R1/3r1k2/5p1p/5Pp1/1p6/6PK/pr6/8 w - g6 0 51', prompt: 'White to move. Black has just played ...g7-g5, two squares past your f5 pawn. Use the special pawn capture to give mate.', solutions: ['fxg6#'], explain: '**fxg6#** is **en passant**: the f5 pawn captures the g-pawn as if it had moved only one square, and lands on g6 with check. The king on f7 has no square left: e7 and f8 are covered by your rooks, e6 and g7 by the new pawn and the rook on g8. En passant is only allowed on the very next move.' },
          { kind: 'exercise', fen: '7k/4Q3/6K1/8/8/8/8/8 w - - 0 1', prompt: 'White to move. Checkmate in one, but careful: one natural queen move is stalemate.', solutions: ['Qe8#', 'Qf8#', 'Qd8#', 'Qg7#', 'Qh7#'], explain: 'Five moves mate: **Qd8#**, **Qe8#** and **Qf8#** along the back rank, and **Qg7#** or **Qh7#** protected by your king. But **Qf7??** takes every square from the king without giving check: stalemate, and the game is drawn. Before every quiet move, make sure the enemy king still has a move.' },
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
          { kind: 'exercise', setup: 'f3 e5 g4', prompt: 'Black to move. White has pushed the f- and g-pawns in the opening. Punish it.', solutions: ['Qh4#'], explain: '**Qh4#** is the Fool’s Mate, the fastest checkmate in chess. The f- and g-pawns shield the king; moving them opened the h4–e1 diagonal, and nothing can block on g3 or f2.' },
          { kind: 'exercise', setup: 'e4 f6 d4 g5', prompt: 'White to move. Black has made the same mistake. Find the mate.', solutions: ['Qh5#'], explain: '**Qh5#**, the same pattern from the other side: ...f6 and ...g5 opened the h5–e8 diagonal, and no black piece can block on g6 or f7. Never weaken the pawns in front of your king in the opening.' },
          { kind: 'exercise', setup: 'e4 e5 Bc4 Nc6 Qh5 Nf6', prompt: 'White to move. Black attacked your queen with ...Nf6 but forgot about f7. Punish it.', solutions: ['Qxf7#'], explain: '**Qxf7#**, Scholar’s Mate. The bishop on c4 protects the queen, so the king can’t take it. That is why, in the exercise above, the right defence was ...g6 (blocking the queen), not ...Nf6.' },
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
          { kind: 'exercise', setup: 'e4 e5 Nf3 Nc6 Bc4 Nd4 Nxe5', prompt: 'Black to move. White has just grabbed the e5 pawn and left the book. Find the move that punishes it (the Blackburne Shilling trap from the Traps section).', solutions: ['Qg5'], explain: '**...Qg5!** attacks the knight on e5 and the pawn on g2 at once. After the greedy **Nxf7?** comes **...Qxg2 Rf1 Qxe4+ Be2 Nf3#**. White’s best is **Bxf7+ Kd8 O-O Qxe5**, and Black has a knight for two pawns. Knowing the traps in your openings pays off as soon as the opponent leaves the book.' },
          { kind: 'exercise', setup: 'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1', prompt: 'White to move. Black has just taken your queen. Show why that was a mistake.', solutions: ['Bxf7+'], explain: '**Bxf7+! Ke7 Nd5#**: Légal’s Mate. Black won the queen and lost the game to three minor pieces. The pin on the f3-knight was only a relative pin, so the knight was allowed to jump away.' },
          { kind: 'exercise', setup: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Nbd7 cxd5 exd5 Nxd5', prompt: 'Black to move in the Queen’s Gambit Declined. White has taken on d5, counting on the pin of your f6-knight. Is it really pinned?', solutions: ['Nxd5'], explain: '**...Nxd5!** If **Bxd8**, then **...Bb4+** forces **Qd2**, and after **...Kxd8** (and ...Bxd2+ next) Black has won a piece. This is the **Elephant Trap**, and every QGD player should know it.' },
          { kind: 'exercise', setup: 'd4 e5 dxe5 Nc6 Nf3 Qe7 Bf4 Qb4+ Bd2 Qxb2 Bc3', prompt: 'Black to move in the Englund Gambit. White’s bishop has just attacked your queen. Find the pin that wins.', solutions: ['Bb4'], explain: '**...Bb4!** pins the bishop on c3 to the king on e1, while your queen keeps attacking it and the rook on a1. If **Qd2**, then **...Bxc3 Qxc3 Qc1#** is a back-rank mate; White’s best is to give up the rook. This is the trap from the Traps section: know your opponent’s tricks as well as your own.' },
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
          { kind: 'exercise', fen: '5N2/pp6/1k3r2/8/5P1P/4P3/3PK3/8 w - - 1 44', prompt: 'White to move. Find the knight fork.', solutions: ['Nd7+'], explain: '**Nd7+** checks the king on b6 and attacks the rook on f6 at the same time. The king has to move, and **Nxf6** wins the rook.' },
          { kind: 'exercise', fen: '2r2rk1/pp1q1p1p/2np1b1p/3Np3/2P1P3/8/PP2BPPP/R3K2R w KQ - 0 16', prompt: 'White to move. Black’s queen on d7 and king on g8 are both a knight’s jump from the same square. Win the queen.', solutions: ['Nxf6+'], explain: '**Nxf6+!** captures the bishop with check and forks the king and the queen on d7. After **...Kg7 Nxd7** White has won a bishop and the queen for the knight.' },
          { kind: 'exercise', fen: '2r3k1/6pp/p4p2/3N4/4P3/4bPB1/6PP/7K w - - 4 27', prompt: 'White to move. Find the fork that wins the rook.', solutions: ['Ne7+'], explain: '**Ne7+** checks the king and attacks the rook on c8. After **...Kf7 Nxc8** White is a whole piece ahead. Look for the king and a loose piece a knight’s jump apart.' },
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
          { kind: 'exercise', fen: '5rk1/2r2p2/6pp/8/3Q4/b1p5/2B3PP/4R1K1 b - - 2 39', prompt: 'Black to move. White’s queen and king stand on the same diagonal. Pin the queen.', solutions: ['Bc5'], explain: '**...Bc5!** attacks the queen, which can’t leave the c5–g1 diagonal because the king is behind it: an **absolute pin**. Moving along the diagonal doesn’t help either, so White has to give the queen for the bishop: **Qxc5 Rxc5**.' },
          { kind: 'exercise', fen: '4q1k1/1Q3pp1/2p4p/3p4/1P6/1r4P1/5P1P/R5K1 w - - 2 31', prompt: 'White to move. Black’s queen on e8 stands on the same rank as its king. Use it.', solutions: ['Ra8'], explain: '**Ra8!** pins the queen to the king along the 8th rank. It can’t step off the rank, so after **...Qxa8 Qxa8+** White has won the queen for a rook.' },
          { kind: 'exercise', fen: '8/8/8/p1P2rp1/R2K2k1/8/P7/8 b - - 0 41', prompt: 'Black to move. White’s king and rook are on the same rank. Skewer them.', solutions: ['Rf4+'], explain: '**...Rf4+!** checks the king along the 4th rank. The king must step off the rank, and **...Rxa4** wins the rook behind it. In a skewer the more valuable piece is in front and is forced to move.' },
          { kind: 'exercise', fen: '8/8/8/4k2b/R4p2/4p3/8/4K3 w - - 1 69', prompt: 'White to move. The black king and bishop share the 5th rank. Win the bishop.', solutions: ['Ra5+'], explain: '**Ra5+!** The king has to leave the 5th rank, and **Rxh5** picks up the bishop. A rook skewers along ranks and files, a bishop along diagonals, a queen along both.' },
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
          { kind: 'exercise', fen: '4r1k1/5p2/pq4bp/6p1/3pN3/1P4P1/PQ3P1P/4R1K1 w - - 2 32', prompt: 'White to move. Your rook on e1 is hidden behind your own knight. Win material.', solutions: ['Nf6+'], explain: '**Nf6+!** The knight gives check and uncovers the rook on e1 against the rook on e8. Black must answer the check, so the rook can’t be saved: after **...Qxf6 Rxe8+** White has won a rook for the knight.' },
          { kind: 'exercise', fen: '8/4k1pp/3bP3/2p2p2/4R2P/4B1P1/6K1/4r3 w - - 0 38', prompt: 'White to move. Your bishop stands between your rook and Black’s rook on e1. Move it with a threat.', solutions: ['Bg5+'], explain: '**Bg5+!** checks the king, and the bishop’s move opens the e-file: now the rook on e4 attacks the rook on e1. Black has to deal with the check first, and **Rxe1** wins a whole rook.' },
          { kind: 'exercise', fen: '5r1k/pp4r1/2p5/3pq1p1/1P1R4/P6P/1Q3PP1/5RK1 w - - 6 29', prompt: 'White to move. Your queen on b2 and Black’s queen on e5 are on the same diagonal, with your rook in between. Find the best way to move it.', solutions: ['Rh4+'], explain: '**Rh4+!** checks the king down the h-file and opens the b2–e5 diagonal at the same time. Black must answer the check (**...gxh4**), and **Qxe5** wins the queen.' },
          { kind: 'exercise', fen: '5rk1/5R1p/5Kp1/4P3/2Q2P2/8/5q2/1q6 w - - 0 39', prompt: 'White to move. Black has two queens, but you have a mate in two. Start with a double check.', solutions: ['Rxf8+'], explain: '**Rxf8+!** takes the rook with check and uncovers the queen on c4 against the king: a **double check**. The king must move, and its only move is **...Kxf8**. Then **Qf7#**, protected by your king.' },
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
          { kind: 'exercise', fen: '4rrk1/1p3Npp/p1b1Q3/8/1b6/q3B3/5PPP/2R2RK1 w - - 5 23', prompt: 'White to move. Mate in three with the most famous knight mate.', solutions: ['Nh6+'], explain: '**Nh6+** is a double check (knight and queen), so the king must go to **h8**. Then **Qg8+!!** sacrifices the queen, **...Rxg8** is forced (the knight guards g8), and **Nf7#** is a **smothered mate**: the king is buried by its own rook and pawns.' },
          { kind: 'exercise', fen: '6k1/rR3ppp/8/2p5/8/1P4P1/1r3P1P/6K1 w - - 0 22', prompt: 'White to move. Black has just taken a pawn on a7. Find the mate.', solutions: ['Rb8#'], explain: '**Rb8#**, a back-rank mate. The king is shut in by its own pawns on f7, g7 and h7, and neither black rook can get back to block. Taking back with Rxa7 would only be equal.' },
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
          { kind: 'exercise', fen: 'rn1qk1nr/ppp1bBp1/3p3p/4p3/4P1b1/3P1N2/PPP2PPP/RNBQ1RK1 b kq - 0 6', prompt: 'Black to move. White has just sacrificed a bishop on f7 with check. Do the blunder check: is it safe to take it?', solutions: ['Kxf7'], explain: 'Yes: **...Kxf7!** Now look at White’s checks, captures and threats. The only real try is **Nxe5+**, which uncovers the queen on d1 against your bishop on g4, but **...dxe5 Qxg4** leaves Black a knight for two pawns ahead. Moving the king instead (...Kf8) just leaves White a pawn up with an attack.' },
          { kind: 'exercise', fen: 'r7/1p1Q2kp/pqnp1rp1/1Np1p3/P3P3/3P4/1PP2PPP/R4RK1 b - - 1 18', prompt: 'Black to move and in check. Which of the three ways out of check is best?', solutions: ['Rf7'], explain: '**...Rf7!** blocks the check and attacks the queen on d7 at the same time. The queen has to run (**Qxd6**), **...Rd8** chases it again, and Black wins the knight on b5. Moving the king instead lets White play **Nxd6** and keep the queen deep in your camp.' },
          { kind: 'exercise', fen: 'r2qkb1r/ppp2pp1/7p/1QnpP3/8/4B2P/PPP1NPP1/R3K2R b KQkq - 4 13', prompt: 'Black to move and in check from the queen on b5. Find the block that wins material.', solutions: ['c6'], explain: '**...c6!** blocks the check with tempo. The queen is attacked and almost trapped: the knight on c5 covers a4, b3 and d3 (where ...Nd3+ would fork king and queen). White’s best is **Qxc5 Bxc5**, giving up the queen for a knight.' },
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
          { kind: 'exercise', fen: 'r4rk1/ppp2ppp/3b4/3Pn3/Q6q/2N5/PPP2PPP/R1B2RK1 b - - 4 14', prompt: 'From a real game: White has just played Qa4, chasing a pawn on the other side of the board. Black to move. What was missed?', solutions: ['Nf3+'], explain: '**...Nf3+!** forces **gxf3** (after Kh1, ...Qxh2# right away), and then **...Qxh2#**. When you review a game, look for moves like Qa4 that take a defender away from the king, and ask what they allowed.' },
          { kind: 'exercise', fen: 'r2qkbnr/pp2pppp/2np4/1Bp5/Q3P3/2P2b2/PP1P1PPP/RNB1K2R w KQkq - 0 6', prompt: 'White to move. Black has just taken your knight on f3. Before you recapture automatically, look for something better.', solutions: ['Bxc6+'], explain: '**Bxc6+! bxc6 Qxc6+** forks the king and the rook on a8: after **...Qd7 Qxa8+** White wins the rook and still takes the bishop on f3 later. Automatic recaptures are a classic thing to find when you review your games: always check for a stronger in-between move first.' },
          { kind: 'exercise', fen: 'rnbq1rk1/p4ppp/3b4/2pQ4/8/2P2N2/PP3PPP/RNB2RK1 b - - 0 11', prompt: 'From a real game: White’s queen has just captured on d5. Black to move. Find the shot that wins it.', solutions: ['Bxh2+'], explain: '**...Bxh2+!** takes a pawn with check, and the d-file opens: Black’s queen on d8 now attacks White’s queen on d5. After **Nxh2** (or Kxh2) **...Qxd5**, Black has won the queen for a bishop. Before you put your queen on a line with the enemy queen, check what stands between them.' },
          { kind: 'exercise', fen: 'r5k1/3p2rp/p7/1p1pPpb1/8/P4B1Q/1q3BPP/5RK1 w - - 0 26', prompt: 'White to move. Black’s queen has just grabbed the pawn on b2. What did Black overlook?', solutions: ['Bxd5+'], explain: '**Bxd5+!** takes a pawn with check, and on d5 the bishop also hits the rook on a8 along the long diagonal. After **...Kh8 Bxa8** White has won a rook. The queen went pawn-hunting and left the a8-rook loose.' },
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
          { kind: 'exercise', fen: '5R2/3r1p1k/6p1/1p2Bp1p/p1r5/6PK/6P1/8 w - - 0 38', prompt: 'You have five seconds left. White to move: play the obvious move, fast.', solutions: ['Rh8#'], explain: '**Rh8#**. The bishop on e5 covers g7, and the rook covers g8 and the whole h-file. Mates, forced recaptures and only-moves can be played quickly; save your time for positions where you have a real choice.' },
          { kind: 'exercise', fen: '4Q3/8/kp1q4/p2Pn3/2P4p/7P/P4PP1/6K1 w - - 3 37', prompt: 'White to move, short of time. Finish the game.', solutions: ['Qa8#'], explain: '**Qa8#**. The queen covers a7 and b7, your pawn on c4 covers b5, and the king’s own pawns on a5 and b6 do the rest.' },
          { kind: 'exercise', fen: '6k1/8/p5q1/8/6Q1/6K1/5P2/8 b - - 1 50', prompt: 'Black to move, with little time left. Find the simplest way to win.', solutions: ['Qxg4+'], explain: '**...Qxg4+! Kxg4 a5** trades queens into a pawn race White can’t win: the a-pawn runs to a1, and the white king is outside its square. When you are short of time, trading into a pawn ending you can count is often the safest way to win.' },
          { kind: 'exercise', fen: '8/8/8/8/8/6p1/5KPk/8 w - - 0 56', prompt: 'White to move. Black has just checked with ...g3+. Only one move wins: this is a critical moment, so take your time.', solutions: ['Kf3'], explain: '**Kf3!** The black king on h2 only has g1 and h1 left (your g2 pawn covers h3), and as soon as it steps away, **Kxg3** wins the pawn and the game. The natural **Kf1??** loses: after **...Kh1** White must move the king again, and **...Kxg2** wins for Black. In pawn endings one move decides everything: this is where your clock time should go.' },
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
          { kind: 'exercise', fen: '8/8/8/6pp/PK4k1/1P6/8/8 w - - 0 53', prompt: 'White to move. Your a-pawn is a passed pawn: no black pawn can ever stop it. Push it or bring the king?', solutions: ['a5'], explain: '**a5!** Passed pawns must be pushed. The black king is far away, so the pawn simply runs: **...h4 a6 h3 a7** and White queens first, in time to stop Black’s pawns. A king move like Kc5 gives Black’s two connected passed pawns the time they need, and then Black wins the race.' },
          { kind: 'exercise', fen: '8/8/8/1p1p3p/PP1P2k1/2P1K3/8/8 b - - 0 45', prompt: 'Black to move. White’s a4 pawn attacks your b5 pawn. How do you make a passed pawn of your own?', solutions: ['bxa4'], explain: '**...bxa4!** The new a-pawn is passed, and it is a step ahead of White’s b-pawn in the race: after **b5 a3 b6 a2 b7 a1=Q b8=Q** Black takes on c3 with check and wins. Any other move loses: White plays a5 and gets a passed pawn of his own first.' },
          { kind: 'exercise', fen: '8/8/1p5p/2k2pP1/2P5/P2K2P1/8/8 b - - 0 45', prompt: 'Black to move. White has doubled g-pawns. Which capture makes the most of it?', solutions: ['hxg5'], explain: '**...hxg5!** Now Black has two connected pawns (f5 and g5) against a lone g3 pawn: a healthy majority that will produce a passed pawn with ...f4, while White’s doubled pawn is worth almost nothing. Leaving the g5 pawn alive is fatal: it would soon become a dangerous passed pawn of its own.' },
          { kind: 'exercise', fen: '8/8/3k4/p2p1p1p/Pp3P1P/1P1KP3/8/8 w - - 1 35', prompt: 'White to move. Count the pawn islands: White has three, Black has four, and three of Black’s pawns are isolated. Which king move starts to win them?', solutions: ['Kd4'], explain: '**Kd4!** The king steps onto the square in front of the isolated d5 pawn, where no black pawn can ever chase it away, and heads for e5. After **...Kc6 Ke5 Kc5 Kxf5** the weak pawns start to fall. Only Kd4 wins: it takes the key central square before the black king can.' },
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
          { kind: 'exercise', fen: '8/8/8/p1k4p/P4K1P/8/8/8 w - - 2 48', prompt: 'White to move. Both h-pawns are weak, but whose king gets there first?', solutions: ['Kg5'], explain: '**Kg5!** goes straight for the h5 pawn, which no other pawn can ever protect. After **...Kd6 Kxh5 Ke7 Kg6** the white king escorts its own h-pawn home. Any other move gives Black time to bring the king back (or attack a4), and the game is drawn.' },
          { kind: 'exercise', fen: '8/8/p7/2K5/1P2k3/8/8/8 w - - 1 60', prompt: 'White to move. Black’s a6 pawn is isolated and far from its king. Win it.', solutions: ['Kb6'], explain: '**Kb6!** attacks the a6 pawn, which no black pawn can defend. After **...Kd4 Kxa6** White’s king clears the way for the b-pawn and it promotes. Pushing **b5?** instead allows **...axb5**, and with no pawns left it’s a draw.' },
          { kind: 'exercise', fen: '8/p7/6Kp/1k4p1/1P4P1/7P/5P2/8 b - - 2 43', prompt: 'Black to move. White’s b4 pawn is alone on the queenside. Take it or defend your kingside?', solutions: ['Kxb4'], explain: '**...Kxb4!** The lonely b4 pawn falls, and then the a-pawn runs: after **Kxh6 a5 Kxg5 a4** Black queens long before White’s kingside pawns get anywhere. An isolated pawn far from its king is often simply lost.' },
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
          { kind: 'exercise', fen: 'R7/1k6/1p1P3r/4K1p1/6pp/8/5P2/8 w - - 3 43', prompt: 'White to move. Your rook on a8 is attacked by the king. Save the rook, or push the passed pawn?', solutions: ['d7'], explain: '**d7!** The passed pawn is worth more than the rook here. After **...Kxa8 d8=Q+** White has a queen against a rook, and if **...Rh8**, then **Rxh8** and the pawn still queens. Saving the rook (Re8, Rf8) gives Black time to stop the pawn, and it’s only a draw. Passed pawns must be pushed.' },
          { kind: 'exercise', fen: '8/8/1p2pk1P/p2n1p2/P4b2/5K2/2P4R/8 w - - 0 39', prompt: 'White to move. The bishop on f4 attacks your rook. What is more important?', solutions: ['h7'], explain: '**h7!** The pawn is one step from queening. If **...Bxh2**, then **h8=Q+** and **Qxh2** wins the bishop back: White ends up with a queen against a knight. Saving the rook first lets the black king or bishop stop the pawn.' },
          { kind: 'exercise', fen: '8/k7/7p/1p3K2/4P3/7P/8/8 b - - 0 48', prompt: 'Black to move. Both sides have a passed pawn. Count the race.', solutions: ['b4'], explain: '**...b4!** Both pawns need four moves to queen, but Black moves first and promotes with check: **e5 b3 Kg6 b2 e6 b1=Q+**, and the new queen stops the e-pawn. A waiting move like ...Kb6 lets White join the race, both sides queen, and it’s a draw. In a race, count the moves and look for promotion with check.' },
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
          { kind: 'exercise', fen: '2r3k1/5p2/2b1p1p1/3pP3/1R6/rP3P2/2PK2P1/7R w - - 0 30', prompt: 'White to move. The h-file is open and leads straight to Black’s king. Use it.', solutions: ['Rbh4'], explain: '**Rbh4!** doubles the rooks on the open h-file. The threat is **Rh8+**, and after **...Kg7 Rh7+ Kf8 Rh8+ Ke7 Rxc8** White wins the rook on c8 along the back rank. Doubled rooks on an open file in front of the king are deadly.' },
          { kind: 'exercise', fen: '6R1/kp6/1p3rp1/8/8/4R2P/r5P1/6K1 w - - 2 41', prompt: 'White to move. One rook is already on the 8th rank. Bring the other one.', solutions: ['Ree8'], explain: '**Ree8!** With both rooks on the 8th rank the threat is **Ra8#**: the king on a7 is shut in by its own b-pawns. Black can only delay it by giving up a rook (**...Rxg2+ Kxg2**) and then making room with ...b5. Two rooks on the 7th or 8th rank are often decisive.' },
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
          { kind: 'exercise', fen: '8/5B2/P4p2/2k2Kp1/3b4/2p4P/8/8 w - - 1 45', prompt: 'White to move. Black’s bishop seems to control a7. Does it really?', solutions: ['a7'], explain: '**a7!** The d4-bishop would cover a7 along the a7–g1 diagonal, but its own king on c5 is in the way. The pawn queens next move, and after **...c2 a8=Q** the new queen is in time to deal with Black’s c-pawn. A bishop only stops a passed pawn if its diagonal is open.' },
          { kind: 'exercise', fen: '8/8/4B3/6P1/4k3/p1p5/1bK5/8 w - - 2 55', prompt: 'White to move. Black’s bishop is on the long diagonal that leads to g7. Can it stop your g-pawn?', solutions: ['g6'], explain: '**g6!** The b2-bishop should guard g7 and h8, but its own pawn on c3 blocks the long diagonal: a bishop shut in by its own pawns. After **...Ke5 g7 Kxe6 g8=Q+** White has a new queen. Remember the rule: put your pawns on the opposite colour to your bishop.' },
          { kind: 'exercise', fen: '3b4/2k5/4p3/1K2P1p1/6P1/8/3B4/8 w - - 3 40', prompt: 'White to move. Bishops can skewer too. Win Black’s bishop.', solutions: ['Ba5+'], explain: '**Ba5+!** checks the king along the a5–d8 diagonal, with the bishop on d8 behind it. After **...Kc8 Bxd8 Kxd8 Kc6** White wins the pawn ending easily: the white king walks in and takes the e6 pawn.' },
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
          { kind: 'exercise', fen: '7n/7P/4K1p1/8/6k1/8/8/8 w - - 2 56', prompt: 'White to move. Black’s knight is stuck in the corner. Win it.', solutions: ['Kf6'], explain: '**Kf6!** heads for g7. The knight on h8 has no squares at all: your king covers f7, and Black’s own pawn stands on g6. After **...g5 Kg7** and **Kxh8**, White wins. A knight in the corner controls only two squares; here it controls nothing useful.' },
          { kind: 'exercise', fen: '8/Nk1n1pp1/4p2p/2P5/3K3P/6P1/5P2/8 w - - 9 40', prompt: 'White to move. Your knight on a7 is on the rim and the black king attacks it. Don’t just save it: find something better.', solutions: ['c6+'], explain: '**c6+!** forks the king and the knight on d7, and it also takes the c6 square, so the a7-knight can get out later. After **...Kc7 cxd7 Kxd7** White is a knight up. Simply saving the knight with Nb5 keeps the material level.' },
          { kind: 'exercise', fen: 'r1b4r/ppp1b1kp/2np3n/4P2Q/3PN3/2P3B1/PP4PP/R5K1 b - - 1 16', prompt: 'Black to move. White’s queen on h5 has gone far forward. Can you trap it?', solutions: ['Bg4'], explain: '**...Bg4!** attacks the queen, and it has no square left: g5 and h4 are covered by the e7-bishop, f5 by the h6-knight, g6 by the h7 pawn, and h3 by the bishop itself. White loses the queen for a bishop. An active piece that goes too far can become a trapped piece.' },
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
          { kind: 'exercise', fen: 'r2q1rk1/4ppbp/2p3p1/p2pP3/5P2/2N1Q3/PPP1R1PP/5RK1 b - - 0 17', prompt: 'Black to move. Find the pawn break that attacks two pieces at once.', solutions: ['d4'], explain: '**...d4!** The pawn attacks the queen on e3 and the knight on c3. After **Qf3 dxc3** Black has won a piece. A pawn is the cheapest attacker, so a pawn break that comes with a threat is doubly strong.' },
          { kind: 'exercise', fen: 'r1b2rk1/1p2qppp/p1n5/1Nn2P2/2Bpp3/6Q1/PP4PP/2R2RK1 w - - 0 19', prompt: 'White to move. Your f-pawn can break open the black king’s position. How?', solutions: ['f6'], explain: '**f6!** attacks the queen and threatens to open the long diagonal and the f-file with fxg7. The queen has no good square, and Black’s best is to give it up: **...Qxf6 Rxf6**. Pawn breaks near the enemy king open lines for your rooks and bishops.' },
          { kind: 'exercise', fen: 'r1b2rk1/pppp1ppp/7q/8/2BpP1Q1/3P4/PPP2PPP/R3R1K1 b - - 1 12', prompt: 'Black to move. Your d-pawn can make two threats at once. Find the break.', solutions: ['d5'], explain: '**...d5!** The pawn attacks the bishop on c4, and moving it opens the c8–g4 diagonal, so the bishop on c8 now attacks White’s queen. White saves the queen (**Qg3**) and **...dxc4** wins a piece.' },
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
          { kind: 'exercise', fen: 'r2qk2r/1b1n2p1/p2pBb1p/1pp5/4P3/P1NP4/1PP2PPP/R2QK2R w KQkq - 0 13', prompt: 'White to move. Black’s king is still on e8 and f7 is weak. Find the mate.', solutions: ['Qh5+'], explain: '**Qh5+!** After **...g6 Qxg6+ Ke7 Qf7#** the queen mates with the help of the e6-bishop, and **...Kf8** allows **Qf7#** at once. Black kept the king in the centre with the f-pawn gone: that is what open lines toward the king look like.' },
          { kind: 'exercise', fen: 'rnbq1rk1/pp3ppp/2p1p3/3pP3/3PnP1N/2NB3P/PPP3P1/R1BQK2R b KQ - 0 9', prompt: 'Black to move. White’s king never castled, and the kingside pawns have moved. Punish it.', solutions: ['Qxh4+'], explain: '**...Qxh4+!** After **g3 Qxg3+ Kf1 Qf2#** it is mate: the knight on e4 protects the queen on f2. White pushed f4 and h3 instead of castling, and the e1–h4 diagonal became a highway to the king.' },
          { kind: 'exercise', fen: 'r2qk2r/p2pbppp/b3p3/2p5/4PPn1/2N2N1P/PPPQ2P1/R1B1K2R b KQkq - 0 11', prompt: 'Black to move. White’s king is on e1 with the f-pawn gone. Find the check that wins material.', solutions: ['Bh4+'], explain: '**...Bh4+!** The king can’t castle out of check, and after the best defence **Kd1**, **...Nf2+** forks the king and the rook on h1. White has to give up the queen: **Qxf2 Bxf2**. Castle early: an uncastled king walks into checks, pins and forks.' },
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
          { kind: 'exercise', fen: '8/8/8/5p1p/7P/3k2P1/R5K1/4r3 b - - 0 57', prompt: 'Black to move. Both sides have two pawns, but your king is far more active. Which move wins?', solutions: ['Re2+'], explain: '**...Re2+!** forces the rooks off: **Rxe2 Kxe2**. In the pawn ending White is in **zugzwang**: the white king has to give way, and the black king walks in to f2 or f3 and wins the g3 pawn. With the rooks on, White’s rook could keep checking and the game would be drawn.' },
          { kind: 'exercise', fen: '2Q5/4K3/1k6/6p1/6P1/8/4q3/8 w - - 3 66', prompt: 'White to move. You are in check. Block it in the way that wins the game.', solutions: ['Qe6+'], explain: '**Qe6+!** blocks the check with a check of your own and forces the queens off: **...Qxe6+ Kxe6**. In the pawn ending your king is much closer to the g5 pawn: Kf5 and Kxg5 wins. A queen ending with checks everywhere is hard; a pawn ending you can count is easy.' },
          { kind: 'exercise', fen: '8/1p6/p1pp1k2/6n1/PPPP1pP1/5N2/5K2/8 w - - 1 39', prompt: 'White to move. Black’s f4 pawn is cut off from its friends, but the knight on g5 protects the position. What do you do?', solutions: ['Nxg5'], explain: '**Nxg5!** Trade the knights. After **...Kxg5 Kf3** the f4 pawn has no defender left and falls to the king, while White also has more space on the queenside. With the knights on, Black’s knight would keep everything defended.' },
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
          { kind: 'exercise', fen: '6k1/5p1p/2P5/4r2p/pP6/P7/2K5/8 w - - 1 48', prompt: 'White to move. You are a rook down but have two connected passed pawns. What is the plan?', solutions: ['c7'], explain: '**c7!** The plan is simple: push the passed pawns. The c7 pawn ties Black’s rook to the back rank (**...Re8**), and then **b5–b6** brings the second pawn up. Two connected passed pawns on the 6th and 7th rank beat a rook. Anything slower gives the rook time to stop your pawns while Black’s h-pawn runs, and then Black wins.' },
          { kind: 'exercise', fen: 'b3q1k1/P4pp1/6p1/6N1/8/4P2P/5PP1/R5K1 w - - 1 31', prompt: 'White to move. Your a7 pawn is blockaded by the bishop on a8. Make a plan to break the blockade.', solutions: ['Rb1'], explain: '**Rb1!** The rook heads for b8, where it attacks the queen and the a8-bishop at once and supports the pawn. Black’s best is to give up the queen: after **...Kf8 Rb8 Ke7 Rxe8+ Kxe8** White is two pawns up in a minor-piece ending, and the a7 pawn still ties Black’s bishop down.' },
          { kind: 'exercise', fen: 'r4rk1/pb3pp1/1p2pb2/2n4Q/2Pq4/4R3/PP3PPP/R1B3K1 w - - 0 17', prompt: 'White to move. Your queen is already on h5. Which piece should join the attack, and how?', solutions: ['Rh3'], explain: '**Rh3!** A **rook lift**: the rook swings to the h-file and threatens mate on h7 and h8. Black’s best is to block with **...Bh4**, and after **Rxh4 Qxh4 Qxh4** White has won the queen and a bishop for a rook. When you attack the king, bring one more piece than the defender can handle.' },
          { kind: 'exercise', fen: '8/4k3/4PpK1/p4Pp1/P3B3/2p5/8/8 b - - 0 46', prompt: 'Black to move. White’s bishop is holding back your c-pawn. What is your plan?', solutions: ['g4'], explain: '**...g4!** Create a second passed pawn on the other side of the board. White’s light-squared bishop can never control c1 or g1, so it has to watch both pawns at once: after **Kh5 g3 Kh4 c2 Bxc2 g2** one of them queens. One piece can’t stop two passed pawns far apart.' },
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
          { kind: 'exercise', fen: '8/8/8/4k3/8/3K4/4P3/8 w - - 0 1', prompt: 'White to move. Take the opposition.', solutions: ['Ke3'], explain: '**Ke3!** The kings face each other with one square between them, and now Black has to give way. After **...Kd5 Kf4** the white king walks round to the squares in front of the pawn, and the pawn promotes. Moving the pawn (e3 or e4) throws away the spare tempo and only draws.' },
          { kind: 'exercise', fen: '8/8/8/3k4/8/4K3/4P3/8 b - - 0 1', prompt: 'Black to move. Defend: keep the white king out.', solutions: ['Ke5'], explain: '**...Ke5!** Black takes the opposition. Whenever the white king steps sideways, mirror it (**Kd3 Kd5**, **Kf3 Kf5**), and when the pawn advances, stay in front of it. With your king in front of the pawn and the opposition at the right moment, it’s a draw. Any other move lets the white king get in front of its pawn.' },
          { kind: 'exercise', fen: '8/4k3/8/8/2K5/4P3/8/8 w - - 0 1', prompt: 'White to move. Your pawn is on e3. Where does your king belong?', solutions: ['Kd5'], explain: '**Kd5!** For a pawn on e3, the **key squares** are d5, e5 and f5: once your king reaches one of them, White wins whoever is to move. Kd5 gets there at once. **Kd4?** lets **...Kd6** take the opposition, and Black draws.' },
          { kind: 'exercise', fen: '7K/8/k1P5/7p/8/8/8/8 w - - 0 1', prompt: 'White to move. The h-pawn looks unstoppable and your c-pawn looks lost. Save the game.', solutions: ['Kg7'], explain: '**Kg7!!** The famous **Réti manoeuvre**. Walking along the diagonal, the king approaches both pawns at once. If **...h4**, then **Kf6** and **Ke7** support the c-pawn, and both sides queen. If Black goes after the c-pawn instead (**...Kb6**), the white king is in time to catch the h-pawn: **Kf6, Ke5, Kf4**. A king on a diagonal covers as much ground as on a straight line.' },
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
          { kind: 'exercise', fen: 'R7/5p2/4p1pk/4P3/5P1r/8/6K1/8 w - - 0 59', prompt: 'White to move. The black king and rook stand on the same file. Use it.', solutions: ['Rh8+'], explain: '**Rh8+!** The rook goes behind the king and checks along the h-file. After **...Kg7 Rxh4** the black rook is gone. In rook endings always look for a check along the line where the enemy king and rook stand.' },
          { kind: 'exercise', fen: '8/8/8/7p/3K4/R5k1/5p2/8 b - - 1 59', prompt: 'Black to move and in check. Where should the king go so that the f-pawn queens?', solutions: ['Kg2'], explain: '**...Kg2!** The king covers both f1 and h1, so the pawn is ready to queen, and White’s rook will have to give itself up for it. After that the h-pawn is too fast for the white king. **...Kh2?** wastes a tempo: after **Ra1!** Black still needs ...Kg2, White plays Ke3, and the h-pawn is caught.' },
          { kind: 'exercise', fen: '4r3/8/2P5/1P3p1p/P7/2K1k3/7P/8 w - - 1 48', prompt: 'White to move. You have three connected passed pawns against a rook. Push the right one.', solutions: ['c7'], explain: '**c7!** The most advanced pawn goes first: the rook has to stop it with **...Rc8**, and then **b6** brings the next pawn up. Connected passed pawns on the 6th and 7th rank are stronger than a rook. **b6?** first lets the rook attack the c6 pawn from the side (...Re6), and it’s only a draw.' },
          { kind: 'exercise', fen: '5r2/8/8/8/8/2KR4/4k3/8 b - - 14 54', prompt: 'Black to move. Your king already attacks the rook on d3. How do you win it?', solutions: ['Rc8+'], explain: '**...Rc8+!** Only the white king defends the rook on d3. The check drives it away: if it goes to the b-file, **...Kxd3** takes the rook; and after **Kd4**, **...Rd8+** skewers king and rook. Either way the rook is lost.' },
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
          { kind: 'exercise', fen: '7k/R7/8/8/8/8/1R6/6K1 w - - 0 1', prompt: 'White to move. Mate in one with the two rooks.', solutions: ['Rb8#'], explain: '**Rb8#**, the **ladder mate**. The rook on a7 cuts the king off from the 7th rank, and the other rook gives mate on the 8th. To get here, the rooks take turns checking, pushing the king back one rank at a time.' },
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
          { kind: 'exercise', fen: '8/8/p2k3p/1p3p1P/1P3P2/P2K4/8/8 w - - 4 43', prompt: 'White to move. Every pawn is blocked, so only the kings can move. Who wins the standoff?', solutions: ['Kd4'], explain: '**Kd4!** takes the opposition. With no pawn moves left, Black is in **zugzwang** and must let the white king through, either to c5 and the queenside pawns or to e5 and the f5 pawn. After **...Ke6 Kc5** the b5 and a6 pawns fall. Any other king move hands the opposition to Black, and it’s a draw.' },
          { kind: 'exercise', fen: '8/8/5k2/p2p3p/P1pP3P/2P2K2/8/8 b - - 1 42', prompt: 'Black to move. The pawns are locked. Find the king move that wins.', solutions: ['Kf5'], explain: '**...Kf5!** takes the opposition, and White has no spare pawn moves. The white king has to give way: after **Ke3 Kg4** the h4 pawn falls, and after **Kg3 Ke4** the black king walks into White’s queenside pawns. Retreating moves give the opposition back, and it’s a draw.' },
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
          { kind: 'exercise', fen: '8/4kP2/6Kp/6b1/8/8/8/8 w - - 1 66', prompt: 'White to move. Black’s bishop wants to stop your pawn on f8. Don’t let it.', solutions: ['Kg7'], explain: '**Kg7!** Your king guards f8, and the bishop can’t fight for it: its own king on e7 and its own pawn on h6 block both diagonals that lead to f8. After **...Ke6 f8=Q** White wins. **f8=Q+?** at once just loses the pawn to ...Kxf8.' },
          { kind: 'exercise', fen: '8/8/8/1p4P1/5p2/1k6/2n5/2K5 w - - 0 49', prompt: 'White to move. Knights are slow. Can the knight on c2 stop your g-pawn?', solutions: ['g6'], explain: '**g6!** The knight needs three jumps to reach a square that covers g8 (e7, f6 or h6), and the pawn needs only two more moves: **...Kc3 g7** and **g8=Q** next. Knights are bad at catching passed pawns far away. Moving the king instead loses: Black’s own pawns run, and Kb1?? even walks into a mate.' },
          { kind: 'exercise', fen: '8/2p5/1p1k2p1/1Kn1p3/P1P1p3/2N2P2/6P1/8 w - - 0 38', prompt: 'White to move. Your king is far more active than Black’s. How do you make that count?', solutions: ['Nxe4+'], explain: '**Nxe4+!** Trade the knights: after **...Nxe4 fxe4** the pawn ending is easily won, because the white king on b5 eats the queenside pawns. Taking with the pawn (fxe4) keeps the knights on, and Black’s knight holds everything. Knight endings play like pawn endings, so go into the pawn ending when your king is the active one.' },
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
          { kind: 'exercise', fen: 'Q7/8/8/K6p/1P4kP/1P6/8/5q2 b - - 1 47', prompt: 'Black to move. The white king and queen stand on the same file. Find the check that wins.', solutions: ['Qa1+'], explain: '**...Qa1+!** checks along the a-file, and the white queen on a8 is behind the king: a **skewer**. After the king steps off the file, **...Qxa8** wins the queen. Queen endings are full of checks; look for the one that hits something behind the king.' },
          { kind: 'exercise', fen: '8/6p1/5p2/6p1/1P6/K3qk2/8/2Q5 w - - 1 53', prompt: 'White to move and in check. Black has three pawns to your one. Find the only way to win.', solutions: ['Qxe3+'], explain: '**Qxe3+!** answers the check by trading queens. In the pawn ending your b-pawn is far away from the black king and runs: **...Kxe3 b5** and it queens first. A king move keeps the queens on, and Black’s three extra pawns win.' },
          { kind: 'exercise', fen: '8/8/4kpQ1/8/8/3p2PP/4q3/6K1 w - - 0 58', prompt: 'White to move. Black’s d-pawn is dangerous. Find the check that wins the black queen.', solutions: ['Qe8+'], explain: '**Qe8+!** The black king must leave the e-file, and **Qxe2** takes the queen behind it. After **...dxe2 Kf2** your king stops the e-pawn and your two kingside pawns win. Skewers are the most common winning trick in queen endings.' },
          { kind: 'exercise', fen: '8/8/7K/8/2Q5/1p6/2p5/1k6 b - - 3 59', prompt: 'Black to move. You have two pawns against a queen. Find the winning promotion.', solutions: ['c1=Q+'], explain: '**...c1=Q+!** Promote with check, and after **Qxc1+ Kxc1** the b-pawn queens: the white king on h6 is far too slow. Any other move lets the white queen keep both pawns blocked, and it’s a draw.' },
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
          { kind: 'exercise', fen: '5r1k/6pp/p1Q1B3/2p5/Pp1p1q2/1P1P4/2P2PPP/R5K1 b - - 2 33', prompt: 'Black to move. Checks first: find the forced mate in three.', solutions: ['Qxf2+'], explain: '**...Qxf2+ Kh1 Qf1+!! Rxf1 Rxf1#**. Every move is forcing: a check, then a queen sacrifice that drags the a1-rook away, then a back-rank mate. Because each move leaves only one reply, you can calculate the line to the very end.' },
          { kind: 'exercise', fen: '5r1k/ppb2qp1/4pp1p/5r2/7R/P3Q3/1PP2PP1/2K4R w - - 2 31', prompt: 'White to move. You have two rooks and a queen near the h-file. Calculate the mate.', solutions: ['Rxh6+'], explain: '**Rxh6+! gxh6 Qxh6+** and mate next: **...Kg8 Qh8#** (the h1-rook protects h8), or **...Qh7 Qxh7#**. The sacrifice removes the only pawn shielding the king. Check the final position too: every reply leads to mate.' },
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
          { kind: 'exercise', fen: '3r1rk1/5pp1/pq5p/1p1b4/3bNP2/P2Q4/1PB3PP/R4R1K w - - 0 22', prompt: 'White to move. Your queen and bishop aim at h7, but your own knight is in the way. Clear the line with a check.', solutions: ['Nf6+'], explain: '**Nf6+!** The knight gives check and opens the b1–h7 diagonal for the queen and bishop battery. Whether Black takes it (**...gxf6** or ...Qxf6) or runs with **...Kh8**, **Qh7#** follows.' },
          { kind: 'exercise', fen: 'r2q1r1k/1pp3pp/p4p2/2p2P2/3n1P2/1B2R2Q/P5PP/5RK1 w - - 2 25', prompt: 'White to move. Your queen and rook are both on the h-file side. Mate in two.', solutions: ['Qxh7+'], explain: '**Qxh7+!! Kxh7 Rh3#**. The queen sacrifice opens the h-file for the rook on e3. The king can’t escape: the b3-bishop covers g8, the f5 pawn covers g6, and its own pawn sits on g7.' },
          { kind: 'exercise', fen: 'r1b2r1k/p1p2Bpp/1p6/2bP4/2P1p3/6Pq/PBP2Q1P/R4R1K w - - 1 20', prompt: 'White to move. Your queen on f2 is attacked by the c5-bishop, but it’s your move. Mate in two.', solutions: ['Bxg7+'], explain: '**Bxg7+!** rips open the long diagonal. After **...Kxg7 Qf6#** the queen mates: the rook on f1 protects it, and the bishop on f7 covers g8. When both kings are under attack, the side with the forcing moves wins.' },
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
          { kind: 'exercise', fen: '8/8/8/7p/5P2/p2k4/P1r3RK/8 w - - 3 40', prompt: 'White to move. Black offers a rook trade. Should you take it?', solutions: ['Rxc2'], explain: '**Rxc2!** Yes: in the pawn ending your f-pawn is passed and the black king is far away. After **...Kxc2 f5** it runs straight to f8 while Black is busy with the a2 pawn. With the rooks on, Black’s rook would stop the pawn and it would be a draw. Trade pieces when the ending that’s left is won.' },
          { kind: 'exercise', fen: '7k/1q4b1/7p/8/3P4/pQ2B1PP/P4P1K/8 b - - 13 47', prompt: 'Black to move. Your a3 pawn is far advanced. How do you turn it into a queen?', solutions: ['Qxb3'], explain: '**...Qxb3! axb3 a2** and the pawn can’t be stopped: the e3-bishop would need the long diagonal to cover a1, but White’s own pawn on d4 blocks it. Trading queens turned the a3 pawn into a winner; with the queens on, White would round it up.' },
          { kind: 'exercise', fen: '6r1/8/1PK2k2/3B4/8/7p/8/8 w - - 1 52', prompt: 'White to move. You can take the rook, but Black’s h-pawn is running. Calculate it.', solutions: ['Bxg8'], explain: '**Bxg8!** Take the rook: the bishop can still stop the h-pawn from the long diagonal (Bd5 covers h1), and your b-pawn promotes. **b7?** lets the rook stop the pawn and the game is drawn. When you are winning, count the race to the end before you grab, and grab when it works.' },
        ],
      },
    ],
  },
  {
    id: 'structures',
    title: '8. Middlegame pawn structures',
    goal: 'Recognise the three most common central pawn structures and know the plans for both sides: the isolated queen’s pawn, the Carlsbad and hanging pawns.',
    lessons: [
      {
        id: 'iqp',
        title: 'The isolated queen’s pawn (IQP)',
        minutes: 9,
        sections: [
          {
            kind: 'text',
            md: `An **isolated queen’s pawn** (IQP) is a pawn on d4 (d5 for Black) with no friendly pawns on the c- or e-file. It comes from many openings: the Queen’s Gambit Tarrasch, the Caro-Kann Panov, the Nimzo-Indian, and the **Alapin Sicilian** from your repertoire.

The IQP is a trade-off: **dynamic now, weak later**.

### Playing with the IQP
- The pawn controls **e5 and c5**: perfect squares for a knight (Ne5).
- You get **open files** (c and e) and free diagonals, so your pieces are more active than your opponent’s.
- **Attack the king**: a queen and bishop battery on the b1–h7 diagonal (Bd3 or Bc2 with Qd3), a knight on e5, a rook lift Re1–e3–h3.
- The **d4–d5 break**: when your pieces are ready, the pawn advances, opens lines for the pieces behind it and often gets rid of your weakness at the same time.
- **Keep the pieces on.** Every trade brings you closer to an endgame where the pawn is just weak.

### Playing against the IQP
- **Blockade** the square in front of it (d5) with a piece, ideally a knight: no pawn can ever chase it away.
- **Trade pieces**, especially the attackers: the light-squared bishop and the knight that wants to go to e5.
- **Pile up** on the pawn: rooks on the d-file, a bishop on f6, knights on c6 and f5.
- In the endgame the isolated pawn is a lasting target, and the square in front of it is a hole.`,
          },
          { kind: 'board', setup: 'e4 c5 c3 d5 exd5 Qxd5 d4 Nf6 Nf3 e6 Bd3 Nc6 O-O cxd4 cxd4', caption: 'An IQP from your repertoire: the Alapin Sicilian. White’s d4 pawn has no neighbours, but White’s pieces will be very active: Nc3, Re1, the bishop on d3 aiming at h7, and a knight jumping into e5.', arrows: ['d3h7'], squares: ['d4', 'e5'] },
          { kind: 'board', setup: 'd4 d5 c4 e6 Nc3 c5 cxd5 exd5 Nf3 Nc6 g3 Nf6 Bg2 Be7 O-O O-O dxc5 Bxc5', caption: 'The Tarrasch Defence: here Black has the IQP on d5. White plays against it: a piece goes to d4, the blockade square, the bishop on g2 already presses on d5, and every trade makes the pawn weaker.', squares: ['d5', 'd4'] },
          { kind: 'exercise', fen: 'r4rk1/1b1q1ppp/p7/1p6/2pPQ3/P1n2PB1/2B3PP/1R2R1K1 w - - 4 28', prompt: 'White to move. You have the isolated pawn on d4, and Black’s knight has just forked your queen and rook. Ignore it.', solutions: ['Qxh7#'], explain: '**Qxh7#**. This is the attack the IQP gives you: the queen and the bishop on c2 line up on the b1–h7 diagonal, and h7 falls. With the isolated pawn your pieces are more active, so use them against the king before the endgame comes.' },
          { kind: 'exercise', fen: '3r2rk/pp5p/3b4/5p2/3PpP2/2B4q/PP2Q2P/R4R1K w - - 0 23', prompt: 'White to move. Your bishop on c3 is aimed at h8, but your own d4 pawn blocks it. Play the IQP break.', solutions: ['d5+'], explain: '**d5+!** The isolated pawn steps forward and uncovers the bishop on c3 against the king: a discovered check. Black has to block with **...Rg7** (or ...Be5), and after **Rg1** the pinned rook and the black queen are both in trouble (Rg3 is next), so White wins material. The d4–d5 push opens lines for the pieces behind it.' },
          { kind: 'exercise', fen: '5rk1/5ppp/pnq1p3/1p2R3/3P4/5rP1/PB3P1P/R2Q2K1 w - - 8 23', prompt: 'White to move. Black’s rook on f3 is defended only by the queen on c6. Find the IQP break that cuts the defence.', solutions: ['d5'], explain: '**d5!** The pawn attacks the queen on c6 and blocks the c6–f3 diagonal, so the rook on f3 loses its defender. Taking the pawn doesn’t help (**...Nxd5 Qxf3**, and ...Qxd5 runs into Rxd5), and Black’s best, **...Rxg3+ hxg3 Nxd5**, still leaves White a rook for two pawns ahead.' },
          { kind: 'exercise', fen: '3r1rk1/pp2bpp1/7p/3p4/2P1nq2/1Q2N3/PB2RPPP/R5K1 w - - 0 22', prompt: 'White to move. Black’s d5 pawn is isolated. Count the attackers and defenders, then take it.', solutions: ['Nxd5'], explain: '**Nxd5!** The isolated pawn is attacked twice (c4 pawn and knight) and defended once, and the knight takes it with a threat to the queen on f4 and the bishop on e7. After **...Rxd5 cxd5** White has won the exchange and a pawn. Pile up on the IQP and it falls.' },
          { kind: 'exercise', fen: 'r1b1r1k1/ppq1b1pn/5pN1/3p4/3Q1P2/8/PP4PP/RNB2R1K w - - 0 15', prompt: 'White to move. Black’s isolated d5 pawn has no pawn to protect it. Take it, with style.', solutions: ['Qxd5+'], explain: '**Qxd5+!** wins the isolated pawn with check, and the knight on g6 takes away f8 and h8. Black can only block on e6 or f7, and **...Be6 Qxe6#** is mate. An isolated pawn needs pieces to defend it; when they are away, it drops.' },
        ],
      },
      {
        id: 'carlsbad',
        title: 'The Carlsbad structure and the minority attack',
        minutes: 9,
        sections: [
          {
            kind: 'text',
            md: `The **Carlsbad structure** comes from the Exchange Variation of the Queen’s Gambit Declined (1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.cxd5 exd5), and from some Caro-Kann lines with the colours reversed. White has pawns on d4 and e3 and no c-pawn; Black has c6 and d5 and no e-pawn.

The centre is fixed, and **each side has a half-open file**: White the c-file, Black the e-file. That tells you where each side plays.

### White’s plans
- **The minority attack**: two pawns (a and b) attack three (a, b and c). White plays b4–b5 and exchanges on c6, leaving Black with a **weak c-pawn** (isolated or backward on a half-open file) or a hole on c6. Rooks on the b- and c-files then go after it.
- **The central break**: with Nge2 and f3, White can play e4 instead and use the extra central pawn. This works best when Black’s pieces have left the centre.
- In both plans the **Bd3 + Qc2 battery** against h7 keeps Black busy.

### Black’s plans
- **Use the e-file and the e4 square**: a knight on e4, supported by ...f5, is the classic outpost.
- **Attack on the kingside**: ...Nf8–g6, ...Bd6, ...Qf6 or ...Qh4, a rook lift ...Re6–h6. Black’s counterplay must come before the minority attack hurts.
- Meet b4–b5 at the right moment with ...cxb5 or ...c5, or prepare ...a6 and ...b5 to put a knight on c4.

Your repertoire’s **Queen’s Gambit Declined** (Openings tab) includes the Exchange Variation: this is the structure you will get.`,
          },
          { kind: 'board', setup: 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 c6 e3 Be7 Bd3 Nbd7 Qc2 O-O Nf3 Re8 O-O Nf8 Rab1 Ne4 Bxe7 Qxe7 b4', caption: 'The minority attack has started: b4, then b5 to make a weakness on c6. Black’s knight on e4 is the classic Carlsbad outpost, and Black’s play will come on the kingside.', arrows: ['b4b5'], squares: ['c6', 'e4'] },
          { kind: 'board', setup: 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 c6 Qc2 Be7 e3 Nbd7 Bd3 O-O Nge2 Re8 O-O Nf8 f3', caption: 'The other plan: Nge2 and f3 prepare the central break e3–e4. Same structure, different plan; choose by where Black’s pieces are.', arrows: ['e3e4'], squares: ['e4'] },
          { kind: 'exercise', fen: '1r3rk1/ppbn1ppp/2pq4/3p2N1/1P1P4/P3P2P/1BQ1bPP1/R3K2R w KQ - 0 17', prompt: 'White to move in a Carlsbad. You have started the minority attack with b4, and Black has just taken your bishop on e2. Is there anything better than taking back?', solutions: ['Qxh7#'], explain: '**Qxh7#**. The queen on c2 and the knight on g5 both hit h7, and the rook on f8 blocks the king’s escape. In the Carlsbad, White’s Qc2 and kingside pieces aim at h7 as much as at the queenside.' },
          { kind: 'exercise', fen: 'r1bqrnk1/pp3ppp/2p5/3p2N1/3P2n1/3BP3/PPQN1PPP/R4RK1 w - - 8 13', prompt: 'White to move. The Bd3 + Qc2 battery is aimed at h7. Fire it.', solutions: ['Bxh7+'], explain: '**Bxh7+!** After **...Nxh7 Qxh7+ Kf8 Qh8+ Ke7 Qxg7** White has two pawns for the piece, the black king is stuck in the centre and the attack goes on: Black is lost. The battery on the b1–h7 diagonal is White’s main kingside weapon in this structure.' },
          { kind: 'exercise', fen: '4r2k/1pq1rpp1/1Np2b1p/p2p4/3P2Q1/1P2PP2/P4P1P/2R1R1K1 w - - 4 26', prompt: 'White to move. Your rook is on the half-open c-file, facing Black’s queen. Use it.', solutions: ['Nxd5'], explain: '**Nxd5!** The knight takes the d5 pawn and attacks the queen, the rook on e7 and the bishop on f6. If **...cxd5**, the c-file opens and **Rxc7** wins the queen. The half-open c-file is exactly where White plays in the Carlsbad.' },
          { kind: 'exercise', fen: 'r3k2r/p3bp2/1npqb2p/1B1p2p1/3P4/1Q2P1P1/PP1N1PP1/2R1K2R w Kkq - 0 17', prompt: 'White to move. The minority attack has left Black with a weak pawn on c6. Win it the best way.', solutions: ['Rxc6'], explain: '**Rxc6!** The weak c-pawn falls, and with gain of time: the rook hits the queen on d6. After **...Qd8 Rc8+!** (a discovered check from the b5-bishop, with the rook attacking the queen) **...Kf8 Rxd8+** White wins the queen for a rook. This is what the minority attack is for: a weak pawn on a half-open file.' },
          { kind: 'exercise', fen: '2r1kb1r/pp1n1ppp/4p1b1/1B1p4/3P1BP1/2P4P/PP1N1P2/2KR3R b k - 0 16', prompt: 'Black to move. Here the colours are reversed: you have the half-open c-file, and White has castled long. Mate in two.', solutions: ['Rxc3+'], explain: '**...Rxc3+!** opens the b2 square, and after **bxc3 Ba3#** the two bishops mate: the one on a3 checks, the one on g6 covers b1 and c2. This is **Boden’s Mate**, and the half-open c-file made it possible.' },
        ],
      },
      {
        id: 'hanging-pawns',
        title: 'Hanging pawns',
        minutes: 8,
        sections: [
          {
            kind: 'text',
            md: `**Hanging pawns** are two pawns side by side on the c- and d-files (c4 and d4 for White, c5 and d5 for Black) with no friendly pawns on the b- or e-file. They usually come from the Queen’s Gambit Declined and the Queen’s Indian.

Together they are strong: Black’s pawns on c5 and d5 control b4, c4, d4 and e4, and they can advance. But no pawn can protect them, so they need pieces, and **once one of them advances, the other can become backward or isolated**.

### Playing with hanging pawns
- Keep them side by side as long as you can, and use the space and the open files they give your pieces.
- **Advance with a purpose**: ...d4 or ...c4 should gain a tempo, open a line for your pieces or create a passed pawn. A push that attacks something, or uncovers an attack, is ideal.
- Keep your pieces active and the queens on: like the IQP, hanging pawns are a dynamic trump.

### Playing against hanging pawns
- **Attack them with pieces** (rooks on the c- and d-files, a bishop on the long diagonal, a knight hitting d5) to **force one of them to advance**. Then blockade the square in front of the one that moved and attack the one left behind.
- **Undermine** them with a pawn: e4 against d5, b4 against c5.
- **Trade pieces**: in the endgame two pawns that can’t protect each other are a weakness.

A famous example is game 6 of the 1972 World Championship: Fischer piled up on Spassky’s hanging pawns on c5 and d5, and later broke them up with the pawn push e3–e4.`,
          },
          { kind: 'board', setup: 'c4 e6 Nf3 d5 d4 Nf6 Nc3 Be7 Bg5 O-O e3 h6 Bh4 b6 cxd5 Nxd5 Bxe7 Qxe7 Nxd5 exd5 Rc1 Be6 Qa4 c5 Qa3 Rc8 Bb5 a6 dxc5 bxc5', caption: 'Fischer–Spassky, game 6, 1972: Black’s hanging pawns on c5 and d5. White’s queen on a3 and rook on c1 already press on c5; the plan is to tie Black’s pieces to the pawns and then break them up.', squares: ['c5', 'd5'] },
          { kind: 'exercise', fen: 'r4rk1/pbb3pp/npn2q2/4p1N1/1pPP1p2/P3BNP1/2Q2P1P/R3RBK1 w - - 0 19', prompt: 'White to move. Your hanging pawns on c4 and d4 give your pieces room. Black has just pushed ...f4. Find the mate.', solutions: ['Qxh7#'], explain: '**Qxh7#**. The queen on c2 and the knight on g5 meet on h7, and the knight also covers f7. Hanging pawns give your pieces space and open lines: use them for an attack before the pawns become targets.' },
          { kind: 'exercise', fen: 'r2q1rk1/p2nbpp1/1pb1pn1p/8/2PP4/2N2N1P/PB2BPP1/1R1Q1RK1 w - - 0 14', prompt: 'White to move. Your pawns on c4 and d4 are hanging pawns. Find the typical break.', solutions: ['d5'], explain: '**d5!** The break attacks the bishop on c6 and opens lines for the bishop on b2 and the rooks. After **...exd5 cxd5** the bishop has to retreat (**...Bb7**), and **d6** wins the bishop on e7 (if ...Bxd6, then Qxd6). Hanging pawns are strongest when they advance at the right moment.' },
          { kind: 'exercise', fen: '4r1k1/q4pbp/6p1/2ppP3/P4P2/1P1Q4/6PP/1R3RK1 b - - 2 27', prompt: 'Black to move. You have hanging pawns on c5 and d5, and your queen on a7 is behind them. Advance with tempo.', solutions: ['c4+'], explain: '**...c4+!** The pawn advances with a discovered check from the queen on a7, and it attacks the queen on d3 at the same time. After **Kh1 cxd3** Black has won the queen. This is the dream for hanging pawns: an advance that gains time.' },
          { kind: 'exercise', fen: '7k/4r2p/1n6/2pp1b2/5P2/2Q5/PP1NrP2/2K3R1 b - - 5 34', prompt: 'Black to move and in check on the long diagonal. Block it with your hanging pawns.', solutions: ['d4'], explain: '**...d4!** blocks the check with a pawn that attacks the queen. The queen has to leave (**Qf3**), and then **...Re1+** wins it: **Qd1 Rxd1+**. Blocking with a rook (...R2e5 or ...R7e5) loses, and ...Rg7 walks into mate.' },
          { kind: 'exercise', fen: '2rr2k1/1bq1bppp/ppn1pn2/8/2PPN3/5N1P/PBQ1BPP1/3RR1K1 b - - 1 16', prompt: 'Black to move. Now you play against hanging pawns on c4 and d4. Find the way to win one of them.', solutions: ['Nxe4'], explain: '**...Nxe4! Qxe4 Nxd4!** The knight takes d4, and by leaving c6 it uncovers the b7-bishop against the queen on e4, so White has no time to take back. After **Qe3 Nxe2+ Qxe2 Qxc4** both hanging pawns are gone. Pressure from the pieces makes hanging pawns fall.' },
        ],
      },
    ],
  },
  {
    id: 'career',
    title: '9. Your road to a FIDE rating',
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
          { kind: 'exercise', fen: '6k1/p1Q2ppp/8/p4n2/8/P7/1q3PPP/4N1K1 w - - 0 26', prompt: 'From a game between grandmasters. Black’s queen has just taken on b2. White to move.', solutions: ['Qc8#', 'Qd8#'], explain: '**Qc8#** (or **Qd8#**). Black’s queen went pawn-grabbing and left the back rank, and the king has no escape square. Even grandmasters lose rated games to back-rank mates: every point you save with a blunder check counts.' },
          { kind: 'exercise', fen: '8/8/7R/1p1kr3/1Bb5/P4K2/8/8 w - - 41 81', prompt: 'From a game between grandmasters, after 80 moves. White to move: finish it.', solutions: ['Rd6#'], explain: '**Rd6#**. The rook covers the 6th rank and the d-file, the bishop on b4 protects it and covers c5, and your king covers e4. Long games are won by players who stay sharp until the very last move.' },
          { kind: 'exercise', fen: '1k6/8/6PN/7P/8/pr6/6K1/8 w - - 0 48', prompt: 'From a game between grandmasters. Black’s a-pawn is two steps from queening. Find the winning race.', solutions: ['g7'], explain: '**g7!** Your pawn queens first and with check: **...a2 g8=Q+**, and the new queen hunts down the king and the a-pawn with checks. Knight moves like Nf5 only draw. In rated games, count races exactly: half a point is often decided by one tempo.' },
          { kind: 'exercise', fen: '1r6/4k3/4p3/P3Pp2/1nN2R1p/1P5P/5K2/8 b - - 2 39', prompt: 'From a game by a titled player. Black to move. Find the fork.', solutions: ['Nd3+'], explain: '**...Nd3+!** forks the king and the rook on f4. After **Kf3 Nxf4 Kxf4 Rxb3** Black has won the exchange and a pawn. Titled players win most of their games with simple tactics like this one.' },
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
          { kind: 'exercise', setup: 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7', prompt: 'Guess the move, the way you will study master games: Morphy’s Opera Game, Paris 1858. White to move and mate in two.', solutions: ['Qb8+'], explain: '**Qb8+!! Nxb8 Rd8#**. Morphy sacrifices the queen to drag the knight away from d7, and the last rook mates, supported by the bishop on g5. Play through the whole game in the **Masters** tab: it is the perfect lesson in fast development.' },
          { kind: 'exercise', setup: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Qd3 e5 dxe5 Qa5+ Bd2 Qxe5 O-O-O Nxe4', prompt: 'Réti against Tartakower, Vienna 1910. Black has just grabbed a knight on e4. White to move and mate in three.', solutions: ['Qd8+'], explain: '**Qd8+!! Kxd8 Bg5+** (a double check from bishop and rook) **...Kc7 Bd8#**. Black grabbed material with the king still in the centre, and White’s rook on the open d-file decided it.' },
          { kind: 'exercise', setup: 'd4 e6 Nf3 f5 Nc3 Nf6 Bg5 Be7 Bxf6 Bxf6 e4 fxe4 Nxe4 b6 Ne5 O-O Bd3 Bb7 Qh5 Qe7', prompt: 'Edward Lasker against Thomas, London 1912. White to move: the start of the most famous king hunt.', solutions: ['Qxh7+'], explain: '**Qxh7+!! Kxh7 Nxf6+** (double check) **...Kh6 Neg4+ Kg5 h4+ Kf4 g3+ Kf3 Be2+ Kg2 Rh2+ Kg1 Kd2#**. The black king is chased from g8 all the way to g1. When you study a game like this, try to guess each move before you look.' },
          { kind: 'exercise', setup: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O d3 Qb3 Qf6 e5 Qg6 Re1 Nge7 Ba3 b5 Qxb5 Rb8 Qa4 Bb6 Nbd2 Bb7 Ne4 Qf5 Bxd3 Qh5 Nf6+ gxf6 exf6 Rg8 Rad1 Qxf3 Rxe7+ Nxe7', prompt: 'Anderssen against Dufresne, the Evergreen Game, Berlin 1852. White to move and mate in four.', solutions: ['Qxd7+'], explain: '**Qxd7+!! Kxd7 Bf5+** (double check) **...Ke8 Bd7+ Kf8 Bxe7#**. The open d- and e-files and the two bishops do the rest. Any other move loses, because Black threatens mate on g2.' },
          { kind: 'exercise', setup: 'e4 e5 f4 exf4 Bc4 Qh4+ Kf1 b5 Bxb5 Nf6 Nf3 Qh6 d3 Nh5 Nh4 Qg5 Nf5 c6 g4 Nf6 Rg1 cxb5 h4 Qg6 h5 Qg5 Qf3 Ng8 Bxf4 Qf6 Nc3 Bc5 Nd5 Qxb2 Bd6 Bxg1 e5 Qxa1+ Ke2 Na6 Nxg7+ Kd8', prompt: 'Anderssen against Kieseritzky, the Immortal Game, London 1851. White has given away both rooks. Mate in two.', solutions: ['Qf6+'], explain: '**Qf6+!! Nxf6 Be7#**. With a queen sacrifice, the last three minor pieces mate the king. Material counts for nothing when the enemy king has no defenders.' },
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
