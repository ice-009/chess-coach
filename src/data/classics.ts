// Famous master games. Moves use the same "SAN {comment}" format as openings.ts.

export interface ClassicGame {
  id: string;
  white: string;
  black: string;
  event: string;
  year: number;
  result: '1-0' | '0-1' | '1/2-1/2';
  title: string;
  lesson: string; // what to learn from it
  theme: string[];
  moves: string;
}

export const CLASSICS: ClassicGame[] = [
  {
    id: 'opera',
    white: 'Paul Morphy',
    black: 'Duke Karl / Count Isouard',
    event: 'Paris Opera',
    year: 1858,
    result: '1-0',
    title: 'The Opera Game',
    lesson: 'The perfect lesson in development: Morphy brings every piece into play while his opponents waste time, then finishes with a queen sacrifice.',
    theme: ['Development', 'Open lines', 'Sacrifice'],
    moves:
      'e4 e5 Nf3 d6 d4 Bg4 {Pinning the knight, but this bishop will soon be traded, giving White the bishop pair.} dxe5 Bxf3 Qxf3 dxe5 Bc4 {Threatens Qxf7#.} Nf6 Qb3 {Double attack on f7 and b7.} Qe7 Nc3 {Morphy prefers development over grabbing b7.} c6 Bg5 {Pins the f6 knight. Black has only the queen and one knight developed.} b5 Nxb5 {A sacrifice to rip open the lines to Black’s king.} cxb5 Bxb5+ Nbd7 O-O-O {Every white piece joins the attack. The d7 knight is pinned twice.} Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ {The famous queen sacrifice!} Nxb8 Rd8# {Mate with the last two pieces. Count the tempi: development wins.}',
  },
  {
    id: 'immortal',
    white: 'Adolf Anderssen',
    black: 'Lionel Kieseritzky',
    event: 'London (casual)',
    year: 1851,
    result: '1-0',
    title: 'The Immortal Game',
    lesson: 'Material is not everything. Anderssen gives up both rooks, a bishop and his queen, but his remaining minor pieces mate a king with no defenders.',
    theme: ['King’s Gambit', 'Sacrifice', 'Activity over material'],
    moves:
      'e4 e5 f4 exf4 Bc4 Qh4+ Kf1 b5 Bxb5 Nf6 Nf3 Qh6 d3 Nh5 Nh4 Qg5 Nf5 c6 g4 Nf6 Rg1 cxb5 h4 Qg6 h5 Qg5 Qf3 Ng8 Bxf4 Qf6 Nc3 Bc5 Nd5 {Ignoring the threat to b2 and the rook.} Qxb2 Bd6 {Offering both rooks!} Bxg1 e5 {Cuts the queen off from the defence.} Qxa1+ Ke2 Na6 Nxg7+ Kd8 Qf6+ {The final queen sacrifice.} Nxf6 Be7# {Three minor pieces deliver mate.}',
  },
  {
    id: 'evergreen',
    white: 'Adolf Anderssen',
    black: 'Jean Dufresne',
    event: 'Berlin (casual)',
    year: 1852,
    result: '1-0',
    title: 'The Evergreen Game',
    lesson: 'Open files toward the enemy king are worth more than material. Watch how the e-file and d-file decide the game.',
    theme: ['Evans Gambit', 'Open files', 'King in the centre'],
    moves:
      'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 {The Evans Gambit: a pawn for fast development.} Bxb4 c3 Ba5 d4 exd4 O-O d3 Qb3 Qf6 e5 Qg6 Re1 Nge7 Ba3 b5 Qxb5 Rb8 Qa4 Bb6 Nbd2 Bb7 Ne4 Qf5 Bxd3 Qh5 Nf6+ {A knight sacrifice to rip open the e-file against the e7 knight.} gxf6 exf6 Rg8 Rad1 {Quiet move setting up the finish.} Qxf3 Rxe7+ Nxe7 Qxd7+ {Queen sacrifice!} Kxd7 Bf5+ {Double check.} Ke8 Bd7+ Kf8 Bxe7# {Mate.}',
  },
  {
    id: 'reti-tartakower',
    white: 'Richard Réti',
    black: 'Savielly Tartakower',
    event: 'Vienna',
    year: 1910,
    result: '1-0',
    title: 'Réti’s Queen Sacrifice',
    lesson: 'A Caro-Kann gone wrong in 11 moves. Black grabs pawns with the queen, White castles long, and a queen sacrifice leads to mate. Never fall behind in development!',
    theme: ['Caro-Kann', 'Queen sacrifice', 'Development'],
    moves:
      'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Qd3 e5 {Too ambitious.} dxe5 Qa5+ Bd2 Qxe5 O-O-O {White gives a pawn to get the rook to the d-file.} Nxe4 {Greedy.} Qd8+ {Shock!} Kxd8 Bg5+ {Double check from bishop and rook.} Kc7 Bd8# {Mate.}',
  },
  {
    id: 'lasker-thomas',
    white: 'Edward Lasker',
    black: 'George Alan Thomas',
    event: 'London',
    year: 1912,
    result: '1-0',
    title: 'The Great King Hunt',
    lesson: 'A queen sacrifice on h7 drags the black king all the way to White’s first rank. When the king is exposed, checks are your best friend.',
    theme: ['King hunt', 'Queen sacrifice', 'Checks'],
    moves:
      'd4 e6 Nf3 f5 Nc3 Nf6 Bg5 Be7 Bxf6 Bxf6 e4 fxe4 Nxe4 b6 Ne5 O-O Bd3 Bb7 Qh5 Qe7 Qxh7+ {The queen sacrifice!} Kxh7 Nxf6+ {Double check.} Kh6 Neg4+ Kg5 h4+ Kf4 g3+ Kf3 Be2+ Kg2 Rh2+ Kg1 Kd2# {The king walked from g8 to g1 to be mated.}',
  },
  {
    id: 'byrne-fischer',
    white: 'Donald Byrne',
    black: 'Bobby Fischer',
    event: 'Rosenwald Memorial, New York',
    year: 1956,
    result: '0-1',
    title: 'The Game of the Century',
    lesson: '13-year-old Fischer sacrifices his queen to get a rook, two bishops and a knight working together. Shows the power of coordinated pieces versus a lone queen.',
    theme: ['Grünfeld', 'Queen sacrifice', 'Piece coordination'],
    moves:
      'Nf3 Nf6 c4 g6 Nc3 Bg7 d4 O-O Bf4 d5 Qb3 dxc4 Qxc4 c6 e4 Nbd7 Rd1 Nb6 Qc5 Bg4 Bg5 {Natural, but White’s king is still in the centre.} Na4 {A brilliant shot: if Nxa4 then Nxe4 with threats.} Qa3 Nxc3 bxc3 Nxe4 Bxe7 Qb6 Bc4 Nxc3 Bc5 Rfe8+ Kf1 Be6 {The famous queen sacrifice.} Bxb6 Bxc4+ Kg1 Ne2+ Kf1 Nxd4+ {A windmill of discovered checks.} Kg1 Ne2+ Kf1 Nc3+ Kg1 axb6 {Black has a rook, two bishops and a knight for the queen.} Qb4 Ra4 Qxb6 Nxd1 h3 Rxa2 Kh2 Nxf2 Re1 Rxe1 Qd8+ Bf8 Nxe1 Bd5 Nf3 Ne4 Qb8 b5 h4 h5 Ne5 Kg7 Kg1 Bc5+ Kf1 Ng3+ Ke1 Bb4+ Kd1 Bb3+ Kc1 Ne2+ Kb1 Nc3+ Kc1 Rc2# {Mate by coordinated minor pieces and rook.}',
  },
  {
    id: 'kasparov-topalov',
    white: 'Garry Kasparov',
    black: 'Veselin Topalov',
    event: 'Wijk aan Zee',
    year: 1999,
    result: '1-0',
    title: 'Kasparov’s Immortal',
    lesson: 'A rook sacrifice on d4 starts a king hunt across the whole board. Shows how calculation and initiative work in modern chess.',
    theme: ['Pirc', 'Rook sacrifice', 'King hunt'],
    moves:
      'e4 d6 d4 Nf6 Nc3 g6 Be3 Bg7 Qd2 c6 f3 b5 Nge2 Nbd7 Bh6 Bxh6 Qxh6 Bb7 a3 e5 O-O-O Qe7 Kb1 a6 Nc1 O-O-O Nb3 exd4 Rxd4 c5 Rd1 Nb6 g3 Kb8 Na5 Ba8 Bh3 d5 Qf4+ Ka7 Rhe1 d4 Nd5 Nbxd5 exd5 Qd6 Rxd4 {The legendary rook sacrifice.} cxd4 Re7+ Kb6 Qxd4+ Kxa5 b4+ Ka4 Qc3 Qxd5 Ra7 Bb7 Rxb7 Qc4 Qxf6 Kxa3 Qxa6+ Kxb4 c3+ Kxc3 Qa1+ Kd2 Qb2+ Kd1 Bf1 {A quiet move in the middle of a king hunt.} Rd2 Rd7 Rxd7 Bxc4 bxc4 Qxh8 Rd3 Qa8 c3 Qa4+ Ke1 f4 f5 Kc1 Rd2 Qa7 {Black resigned.}',
  },
];

export function findClassic(id: string) {
  return CLASSICS.find((g) => g.id === id);
}
