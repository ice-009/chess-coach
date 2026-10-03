// Opening repertoire. Lines are SAN separated by spaces; {braces} attach a comment to the move before them.
// Every line is validated with chess.js by scripts/validate-data.ts.
import { ENCYCLOPEDIA, ENC_GROUPS } from './encyclopedia.ts';

export type Side = 'white' | 'black';

export interface OpeningLine {
  id: string;
  name: string;
  moves: string;
}

export interface Opening {
  id: string;
  name: string;
  group: string; // a GROUPS id (repertoire) or an ENC_GROUPS id (encyclopedia)
  side: Side; // the side YOU play in this opening
  eco: string;
  summary: string;
  ideas: string[];
  lines: OpeningLine[];
}

export const GROUPS: { id: string; title: string; blurb: string }[] = [
  { id: 'white', title: 'Your repertoire as White', blurb: 'Open with 1.e4 and know an answer to every common reply. (1.d4 players: see the London.)' },
  { id: 'vs-e4', title: 'As Black against 1.e4', blurb: 'Answer 1.e4 with 1...e5, the most classical and instructive defence, and learn the main ways White continues.' },
  { id: 'vs-d4', title: 'As Black against 1.d4', blurb: 'Answer 1.d4 with 1...d5 and the solid Queen’s Gambit Declined set-up.' },
  { id: 'traps', title: 'Traps every player must know', blurb: 'These win games at every level below 1600. Learn them so you never fall for them, and punish people who do.' },
];

export const OPENINGS: Opening[] = [
  // ───────────── WHITE ─────────────
  {
    id: 'italian',
    name: 'Italian Game',
    group: 'white',
    side: 'white',
    eco: 'C50–C54',
    summary: 'After 1.e4 e5 2.Nf3 Nc6, the bishop goes to c4 to aim at f7, Black’s weakest square. White builds slowly with c3 and d3 (or d4) and attacks later.',
    ideas: [
      'Bishop on c4 eyes f7, the square only Black’s king defends.',
      'c3 prepares d4 to take the whole centre.',
      'Castle early, then Re1, Nbd2–f1–g3 is the classic knight manoeuvre.',
      'Don’t rush: in the slow Italian the side with the better plan wins, not the side with tricks.',
    ],
    lines: [
      {
        id: 'italian-giuoco',
        name: 'Giuoco Piano (3...Bc5)',
        moves:
          'e4 {Grab the centre and open lines for the queen and bishop.} e5 Nf3 {Develop with tempo: the knight attacks e5.} Nc6 {Defends e5.} Bc4 {The Italian bishop aims straight at f7.} Bc5 {Black mirrors, aiming at f2.} c3 {Prepares d4 and gives the bishop a retreat on b3/c2 later.} Nf6 {Counter-attacks e4.} d3 {Calm and solid: defend e4, keep the tension.} d6 O-O {King safety first.} O-O Re1 {Supports e4 and prepares Nbd2–f1.} a6 Bb3 {Pre-empts ...Na5 hitting the bishop.} Ba7 Nbd2 {Heading for f1 and g3, a classic regrouping.}',
      },
      {
        id: 'italian-two-knights',
        name: 'Two Knights (3...Nf6) with 4.d3',
        moves:
          'e4 e5 Nf3 Nc6 Bc4 Nf6 {Black counter-attacks e4 instead of copying.} d3 {Simplest answer: defend e4, avoid a gambit fight.} Be7 O-O O-O Re1 d6 c3 {Same plan as always: d4 when ready, knight to f1–g3.}',
      },
      {
        id: 'italian-ng5',
        name: 'Two Knights: sharp 4.Ng5',
        moves:
          'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 {Attacks f7 twice (knight + bishop).} d5 {The only good defence: block the bishop.} exd5 Na5 {Correct! Not 5...Nxd5?, which allows the Fried Liver.} Bb5+ c6 dxc6 bxc6 Be2 {White is a pawn up but Black has fast development.} h6 Nf3 e4 Ne5 {Typical position: White holds the extra pawn, Black has activity.}',
      },
      {
        id: 'italian-petrov',
        name: 'vs Petrov (2...Nf6)',
        moves:
          'e4 e5 Nf3 Nf6 {The Petrov: Black copies and attacks e4.} Nxe5 {Take first.} d6 {Important: kick the knight before taking back on e4.} Nf3 {Retreat. (Had Black taken 3...Nxe4 at once, 4.Qe2! wins a pawn or more.)} Nxe4 d4 {Grab the centre; the e4 knight will be chased.} d5 Bd3 {Develop with a threat to the knight.}',
      },
      {
        id: 'italian-philidor',
        name: 'vs Philidor (2...d6)',
        moves:
          'e4 e5 Nf3 d6 {Solid but passive.} d4 {Strike the centre immediately.} Nf6 Nc3 Nbd7 Bc4 {Pressure on f7 again.} Be7 O-O O-O {White has more space and easy development.}',
      },
    ],
  },
  {
    id: 'alapin',
    name: 'vs Sicilian: Alapin 2.c3',
    group: 'white',
    side: 'white',
    eco: 'B22',
    summary: 'The Sicilian (1...c5) is Black’s most popular defence and has mountains of theory. 2.c3 sidesteps it: White simply prepares d4 and gets a big centre.',
    ideas: [
      'c3 prepares d4 so White can recapture with a pawn and keep two centre pawns.',
      'If Black attacks e4 with ...Nf6, push e5 and chase the knight.',
      'Black’s queen often comes to d5 early; develop with tempo against it.',
    ],
    lines: [
      {
        id: 'alapin-d5',
        name: '2...d5',
        moves:
          'e4 c5 c3 {Prepare d4.} d5 {Black hits the centre immediately.} exd5 Qxd5 {The queen can’t be hit by Nc3 because the c3 pawn blocks that square.} d4 Nf6 Nf3 e6 Be2 Nc6 O-O cxd4 cxd4 {Classic isolated queen’s pawn position: White has active pieces and space.}',
      },
      {
        id: 'alapin-nf6',
        name: '2...Nf6',
        moves:
          'e4 c5 c3 Nf6 {Attack e4.} e5 {Gain space with tempo.} Nd5 d4 cxd4 Nf3 {Develop first; the d4 pawn will be recaptured.} Nc6 Bc4 {Hits the d5 knight.} Nb6 Bb3 {Keeps the bishop on the a2–g8 diagonal.}',
      },
    ],
  },
  {
    id: 'french-advance',
    name: 'vs French: Advance 3.e5',
    group: 'white',
    side: 'white',
    eco: 'C02',
    summary: 'Against 1...e6 2.d4 d5, push 3.e5. You get space on the kingside, and Black’s light-squared bishop is shut in behind the e6 pawn.',
    ideas: [
      'The pawn chain d4–e5 points at Black’s kingside: attack there.',
      'Black will attack the base of the chain (d4) with ...c5, ...Nc6, ...Qb6.',
      'Keep d4 well defended with c3, Nf3 and sometimes Be3.',
    ],
    lines: [
      {
        id: 'french-adv-main',
        name: 'Main line with ...Qb6',
        moves:
          'e4 e6 d4 d5 e5 {Gain space and cramp Black.} c5 {Black attacks the base of the chain.} c3 {Support d4.} Nc6 Nf3 Qb6 {Three attackers on d4.} Be2 {Develop and prepare to castle; the d4 pawn is defended enough.} cxd4 cxd4 Nge7 Na3 {Heading to c2 to defend d4 again.} Nf5 Nc2 {Rock-solid centre; next Bd3 or O-O.}',
      },
    ],
  },
  {
    id: 'caro-advance',
    name: 'vs Caro-Kann: Advance 3.e5',
    group: 'white',
    side: 'white',
    eco: 'B12',
    summary: 'Against 1...c6 2.d4 d5, 3.e5 grabs space. Unlike the French, Black’s bishop gets out to f5, so White develops quickly and plays c4 or c3 depending on taste.',
    ideas: [
      'Gain space, develop smoothly: Nf3, Be2, O-O, then c3 or c4.',
      'Black’s bishop on f5 can be a target for Nh4 or g4 in sharper lines.',
    ],
    lines: [
      {
        id: 'caro-adv-short',
        name: 'Short Variation',
        moves:
          'e4 c6 d4 d5 e5 {Space.} Bf5 {Black develops the bishop before playing ...e6.} Nf3 e6 Be2 {Quiet and healthy, Nigel Short’s system.} c5 Be3 {Watches c5 and d4.} Nd7 O-O {White is well developed and ready for c3/c4 or Nbd2.}',
      },
    ],
  },
  {
    id: 'scandi',
    name: 'vs Scandinavian (1...d5)',
    group: 'white',
    side: 'white',
    eco: 'B01',
    summary: 'Black attacks e4 at once. Take the pawn and chase the black queen with your pieces, gaining time for development.',
    ideas: [
      'Every time you develop with an attack on the queen, you gain a tempo.',
      'Classical set-up: Nc3, d4, Nf3, Bc4, Bd2, then castle.',
    ],
    lines: [
      {
        id: 'scandi-qa5',
        name: '2...Qxd5 3.Nc3 Qa5',
        moves:
          'e4 d5 exd5 Qxd5 Nc3 {Develop with tempo on the queen.} Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5 Bd2 {Threatens Nd5 discovering an attack on the queen.} e6 {White has a free, comfortable lead in development.}',
      },
    ],
  },
  {
    id: 'pirc',
    name: 'vs Pirc / Modern (1...d6, ...g6)',
    group: 'white',
    side: 'white',
    eco: 'B07',
    summary: 'Black lets you build a big centre and fianchettoes the bishop. A simple, dangerous plan is the "150 Attack": Be3, Qd2, f3 and attack the king.',
    ideas: [
      'Be3 + Qd2 prepares Bh6 to trade Black’s best piece, the g7 bishop.',
      'Castle queenside and push h4–h5 if Black castles short.',
    ],
    lines: [
      {
        id: 'pirc-150',
        name: '150 Attack',
        moves:
          'e4 d6 d4 Nf6 Nc3 g6 Be3 {Plan: Qd2 and Bh6.} Bg7 Qd2 c6 f3 {Supports e4 and prepares g4/h4.} b5 Nge2 Nbd7 Bh6 {Trade off the dangerous fianchetto bishop.}',
      },
    ],
  },
  {
    id: 'london',
    name: 'London System (for 1.d4 players)',
    group: 'white',
    side: 'white',
    eco: 'D02',
    summary: 'A system opening: the same set-up against almost anything. d4, Bf4, e3, Nf3, c3, Nbd2, Bd3. Low theory and great for building a solid foundation.',
    ideas: [
      'Get the dark-squared bishop out (Bf4) BEFORE playing e3.',
      'The "London pyramid" d4–c3–e3 is very hard to break.',
      'Later, Ne5 and a kingside attack with h4 or Qf3–h3 is common.',
    ],
    lines: [
      {
        id: 'london-main',
        name: 'Main set-up vs ...d5',
        moves:
          'd4 d5 Bf4 {The key move: the bishop gets out before e3 locks it in.} Nf6 e3 e6 Nf3 c5 c3 {Pyramid complete.} Nc6 Nbd2 Bd6 Bg3 {Keep the bishop; don’t let Black trade it on your terms.} O-O Bd3 {Every piece on its standard square.}',
      },
    ],
  },

  // ───────────── BLACK vs 1.e4 ─────────────
  {
    id: 'e5-vs-italian',
    name: 'vs Italian Game',
    group: 'vs-e4',
    side: 'black',
    eco: 'C50–C54',
    summary: 'When White plays Bc4, develop your bishop to c5 and mirror White’s healthy set-up. Know the Fried Liver danger after 3...Nf6 4.Ng5.',
    ideas: [
      'Castle quickly; f7 is a target until you do.',
      '...a6 and ...Ba7 keeps your bishop safe from Na4 or d4–d5 tricks.',
      'Against Ng5 ideas, ...h6 is often useful.',
    ],
    lines: [
      {
        id: 'black-giuoco',
        name: 'Giuoco Piano',
        moves:
          'e4 e5 Nf3 Nc6 Bc4 Bc5 {Develop and aim at f2.} c3 Nf6 {Attack e4 immediately.} d3 d6 O-O O-O {Both sides safe; now a slow manoeuvring game.} Re1 a6 {Make room for ...Ba7.} Bb3 Ba7 {Safe from ...Na4 and from d4 with tempo.}',
      },
      {
        id: 'black-giuoco-d4',
        name: 'Giuoco Piano with 5.d4',
        moves:
          'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 {Sharper: White grabs the centre.} exd4 {Take, then hit e4.} cxd4 Bb4+ {Check and gain time.} Bd2 Bxd2+ Nbxd2 d5 {Strike back in the centre: the key freeing move.} exd5 Nxd5 {Black is fine; White has an isolated d-pawn.}',
      },
    ],
  },
  {
    id: 'e5-vs-ruy',
    name: 'vs Ruy Lopez (3.Bb5)',
    group: 'vs-e4',
    side: 'black',
    eco: 'C84–C99',
    summary: 'The Spanish is the most respected 1.e4 e5 opening. The bishop pressures the knight defending e5. Play the classical Morphy Defence: ...a6, ...Nf6, ...Be7, ...b5, ...d6.',
    ideas: [
      'White is not threatening Bxc6 + Nxe5 yet: after Bxc6 dxc6 Nxe5, ...Qd4 wins the pawn back.',
      '...a6 asks the bishop a question; ...b5 kicks it to b3.',
      'In the closed lines, ...Na5 and ...c5 gain queenside space.',
    ],
    lines: [
      {
        id: 'ruy-closed',
        name: 'Closed Ruy Lopez (Chigorin)',
        moves:
          'e4 e5 Nf3 Nc6 Bb5 {Pressure on the defender of e5.} a6 {Morphy Defence: put the question to the bishop.} Ba4 Nf6 O-O Be7 {Calm development; e4 is "attacked" but Nxe4 now allows Re1.} Re1 b5 Bb3 d6 c3 O-O h3 {Stops ...Bg4.} Na5 {Chase the strong bishop.} Bc2 c5 d4 Qc7 {The famous Chigorin set-up: solid and rich.}',
      },
      {
        id: 'ruy-exchange',
        name: 'Exchange Variation (4.Bxc6)',
        moves:
          'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 {Recapture with the d-pawn: it opens the c8 bishop and the d-file.} O-O f6 {Defend e5 solidly.} d4 exd4 Nxd4 c5 {Kick the knight; Black has the bishop pair as compensation for the worse pawn structure.}',
      },
    ],
  },
  {
    id: 'e5-vs-scotch',
    name: 'vs Scotch (3.d4)',
    group: 'vs-e4',
    side: 'black',
    eco: 'C45',
    summary: 'White opens the centre at once. Take on d4, then develop with threats: 4...Bc5 hits the knight on d4.',
    ideas: [
      'After 4.Nxd4 Bc5, the d4 knight is under pressure.',
      '...Qf6 adds an attacker on d4 and eyes f2.',
    ],
    lines: [
      {
        id: 'scotch-bc5',
        name: '4...Bc5',
        moves:
          'e4 e5 Nf3 Nc6 d4 exd4 {Take.} Nxd4 Bc5 {Attack the knight.} Be3 Qf6 {Pile up on d4.} c3 Nge7 {Develop the knight to e7 so it doesn’t block the queen.} Bc4 O-O O-O Bb6 {Safe king, solid position.}',
      },
    ],
  },
  {
    id: 'e5-vs-kg',
    name: 'vs King’s Gambit (2.f4)',
    group: 'vs-e4',
    side: 'black',
    eco: 'C33–C36',
    summary: 'White sacrifices a pawn to open the f-file. Take it, then strike back in the centre with ...d5, the Modern Defence. Black gets easy play.',
    ideas: [
      'Accept with ...exf4, then ...d5! returns the pawn for fast development.',
      'Watch out for Bc4 + Ng5 attacks on f7.',
    ],
    lines: [
      {
        id: 'kg-modern',
        name: 'Modern Defence',
        moves:
          'e4 e5 f4 {Gambit!} exf4 {Accept.} Nf3 d5 {Hit back in the centre.} exd5 Nf6 Bc4 Nxd5 O-O Be7 {Black develops smoothly and the f4 pawn is still extra for now.}',
      },
    ],
  },
  {
    id: 'e5-vs-qh5',
    name: 'vs early Queen (Scholar’s Mate attempts)',
    group: 'vs-e4',
    side: 'black',
    eco: 'C20',
    summary: 'At club level many games are lost to 2.Qh5 + 3.Bc4 aiming at f7. Defend calmly, then develop with tempo against the queen.',
    ideas: [
      'After 2.Qh5 defend e5 with ...Nc6, then block with ...g6 once Bc4 comes.',
      'Then ...Nf6 attacks the queen and you gain time.',
      'NEVER play ...Nf6 while Qh5 + Bc4 both hit f7 and nothing blocks: Qxf7 is mate.',
    ],
    lines: [
      {
        id: 'qh5-defence',
        name: 'Defend and punish',
        moves:
          'e4 e5 Qh5 {Attacks e5 and f7.} Nc6 {Defends e5.} Bc4 {Threatens Qxf7#!} g6 {Block the diagonal.} Qf3 {Again threatens f7.} Nf6 {Defends f7 and develops.} Ne2 Bg7 {Black has gained time; the white queen is badly placed.}',
      },
    ],
  },
  {
    id: 'e5-vs-vienna',
    name: 'vs Vienna (2.Nc3)',
    group: 'vs-e4',
    side: 'black',
    eco: 'C25–C29',
    summary: 'The Vienna often leads to the Vienna Gambit with f4. Meet it with ...Nf6 and a quick ...d5.',
    ideas: ['...d5 in the centre is the antidote to most flank gambits.'],
    lines: [
      {
        id: 'vienna-gambit',
        name: 'Vienna Gambit 3.f4 d5',
        moves:
          'e4 e5 Nc3 Nf6 f4 {The Vienna Gambit.} d5 {Counter in the centre.} fxe5 Nxe4 Nf3 Be7 d4 O-O Bd3 f5 {Supports the strong knight on e4.}',
      },
    ],
  },

  // ───────────── BLACK vs 1.d4 ─────────────
  {
    id: 'qgd',
    name: 'Queen’s Gambit Declined',
    group: 'vs-d4',
    side: 'black',
    eco: 'D30–D69',
    summary: 'Hold the d5 point with ...e6. It is one of the most solid defences ever played, and the plans are clear: develop, castle, then free your game with ...c5 or ...e5.',
    ideas: [
      'Keep a pawn on d5; ...e6 supports it.',
      'The light-squared bishop is your problem piece: plan ...b6 & ...Bb7, or free it with ...dxc4 & ...e5.',
      'Capablanca’s freeing manoeuvre: ...dxc4 and ...Nd5 to trade pieces.',
    ],
    lines: [
      {
        id: 'qgd-orthodox',
        name: 'Orthodox Defence',
        moves:
          'd4 d5 c4 {The Queen’s Gambit: White offers a pawn to deflect d5.} e6 {Decline and support d5.} Nc3 Nf6 Bg5 Be7 {Unpin.} e3 O-O Nf3 Nbd7 Rc1 c6 Bd3 dxc4 {Wait until White’s bishop has moved, then take, gaining a tempo.} Bxc4 Nd5 {Capablanca’s freeing manoeuvre: trade pieces to get breathing room.}',
      },
      {
        id: 'qgd-exchange',
        name: 'Exchange Variation',
        moves:
          'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 {Recapture with the e-pawn: your c8 bishop is now free.} Bg5 Be7 e3 c6 Bd3 Nbd7 Qc2 O-O Nf3 Re8 O-O Nf8 {Defends h7 and heads for g6 or e6.}',
      },
    ],
  },
  {
    id: 'vs-london',
    name: 'vs London System',
    group: 'vs-d4',
    side: 'black',
    eco: 'D02',
    summary: 'Against the London, play ...d5, ...Nf6, ...e6, ...c5 and ...Nc6 to pressure d4, then ...Bd6 to challenge the f4 bishop.',
    ideas: [
      '...c5 attacks d4, the heart of White’s pyramid.',
      'Offering a bishop trade with ...Bd6 reduces White’s attacking potential.',
    ],
    lines: [
      {
        id: 'vs-london-main',
        name: 'Classical set-up',
        moves:
          'd4 d5 Bf4 Nf6 e3 c5 {Hit the centre right away.} c3 Nc6 Nd2 e6 Ngf3 Bd6 {Challenge the London bishop.} Bg3 O-O Bd3 b6 {Prepare ...Bb7; Black is fully equal.}',
      },
    ],
  },

  // ───────────── TRAPS ─────────────
  {
    id: 'trap-fried-liver',
    name: 'Fried Liver Attack',
    group: 'traps',
    side: 'white',
    eco: 'C57',
    summary: 'If Black answers 4.Ng5 d5 5.exd5 with 5...Nxd5?, White sacrifices on f7 and drags the king into the open.',
    ideas: ['Black’s correct move is 5...Na5. Know both sides of this.'],
    lines: [
      {
        id: 'fried-liver',
        name: 'Main line',
        moves:
          'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 {Natural but a mistake.} Nxf7 {The sacrifice!} Kxf7 Qf3+ {Fork-like: check and attack on d5.} Ke6 {Forced to defend the knight.} Nc3 {Pile up on the pinned d5 knight; Black’s king is stuck in the centre.}',
      },
    ],
  },
  {
    id: 'trap-legal',
    name: 'Légal’s Mate',
    group: 'traps',
    side: 'white',
    eco: 'C41',
    summary: 'A pin that isn’t really a pin: White gives up the queen and mates with minor pieces when Black greedily takes it.',
    ideas: ['A pinned knight can still move if the "pinned-to" piece is only the queen, not the king.'],
    lines: [
      {
        id: 'legal',
        name: 'Légal’s Mate',
        moves:
          'e4 e5 Nf3 d6 Bc4 Bg4 {Pins the knight to the queen.} Nc3 g6 {A slow move.} Nxe5 {The "pinned" knight jumps away!} Bxd1 {Greedy.} Bxf7+ Ke7 Nd5# {Mate with three minor pieces.}',
      },
    ],
  },
  {
    id: 'trap-blackburne',
    name: 'Blackburne Shilling Gambit',
    group: 'traps',
    side: 'black',
    eco: 'C50',
    summary: 'A cheeky trap for Black: 3...Nd4 invites 4.Nxe5?, which loses to a queen raid.',
    ideas: ['Objectively dubious: against 4.Nxd4 or 4.c3 it fails. But it shows why grabbing pawns can be deadly.'],
    lines: [
      {
        id: 'blackburne',
        name: 'The trap',
        moves:
          'e4 e5 Nf3 Nc6 Bc4 Nd4 {Leaves e5 hanging on purpose.} Nxe5 {Takes the bait.} Qg5 {Attacks e5 and g2.} Nxf7 Qxg2 Rf1 Qxe4+ Be2 Nf3# {Smothered-style mate.}',
      },
    ],
  },
  {
    id: 'trap-englund',
    name: 'Englund Gambit Trap',
    group: 'traps',
    side: 'black',
    eco: 'A40',
    summary: 'Against 1.d4, 1...e5 sets a trap: if White develops the bishop to f4 carelessly, the black queen sweeps in.',
    ideas: ['Again objectively bad for Black, but very common online. If you’re White, play 4.Qd5 or 4.Nc3.'],
    lines: [
      {
        id: 'englund',
        name: 'The trap',
        moves:
          'd4 e5 dxe5 Nc6 Nf3 Qe7 Bf4 {Natural but wrong.} Qb4+ {Fork: check and attack on b2.} Bd2 Qxb2 Bc3 Bb4 {Pins the bishop.} Qd2 Bxc3 Qxc3 Qc1# {Back rank mate!}',
      },
    ],
  },
];

export function findOpening(id: string): Opening | undefined {
  return OPENINGS.find((o) => o.id === id) ?? ENCYCLOPEDIA.find((o) => o.id === id);
}

/** Title of a repertoire or encyclopedia group. */
export const groupTitle = (id: string) => [...GROUPS, ...ENC_GROUPS].find((g) => g.id === id)?.title ?? '';
