// Opening encyclopedia: the main lines of the major openings, for understanding (not a repertoire to memorise).
// Same format as openings.ts: SAN moves, {braces} explain the move before them. Every line is checked by
// scripts/validate-data.ts (legal moves), against the master database (each move is played by masters) and
// by Stockfish (no move throws the position away).
import type { Opening } from './openings';

export const ENC_GROUPS: { id: string; title: string; blurb: string }[] = [
  { id: 'enc-open', title: 'Open games (1.e4 e5)', blurb: 'The classical battle for the centre: quick development, the fight for d4 and e5, and attacks on f7 and f2.' },
  { id: 'enc-sicilian', title: 'The Sicilian (1.e4 c5)', blurb: 'The most popular answer to 1.e4. Black trades a wing pawn for White’s centre pawn and plays for an unbalanced, double-edged game.' },
  { id: 'enc-semi', title: 'Other defences to 1.e4', blurb: 'French, Caro-Kann, Pirc, Scandinavian and Alekhine: each lets White have something (space, the centre, tempi) in return for a solid structure or counterplay.' },
  { id: 'enc-qg', title: 'Queen’s pawn games (1.d4 d5)', blurb: 'The Queen’s Gambit family: White offers the c-pawn to lure Black’s d-pawn away from the centre.' },
  { id: 'enc-indian', title: 'Indian defences (1.d4 Nf6)', blurb: 'Black controls the centre with pieces first and strikes with pawns later: hypermodern chess.' },
  { id: 'enc-flank', title: 'Flank openings (1.c4, 1.Nf3)', blurb: 'White controls the centre from the side and keeps the options open: often a Sicilian or Queen’s Gambit with colours reversed.' },
];

export const ENCYCLOPEDIA: Opening[] = [
  // ───────────────────────── Open games ─────────────────────────
  {
    id: 'enc-ruy',
    name: 'Ruy Lopez (Spanish)',
    group: 'enc-open',
    side: 'white',
    eco: 'C60–C99',
    summary: 'The oldest main line of 1.e4 e5. The bishop on b5 attacks the knight that defends e5, so White keeps up long-term pressure on Black’s centre.',
    ideas: [
      'White: the threat is not 4.Bxc6 and Nxe5 at once (Black regains the pawn with ...Qd4), but the pressure lasts the whole game.',
      'White: the classic plan is c3 and d4 to build a big centre, then Nbd2–f1–g3 and play on the kingside.',
      'Black: ...a6 and ...b5 chase the bishop to b3, gaining queenside space; ...Na5 hits the bishop and prepares ...c5.',
      'Black: in the Berlin, Black gives up castling rights for a solid endgame with the bishop pair.',
      'Structure to know: after the d4–d5 push, White plays on the kingside and Black on the queenside.',
    ],
    lines: [
      {
        id: 'enc-ruy-closed',
        name: 'Closed: Chigorin main line',
        moves:
          'e4 e5 Nf3 {Attacks e5 and develops.} Nc6 {Defends e5.} Bb5 {Attacks the defender of e5.} a6 {The Morphy Defence: ask the bishop at once.} Ba4 Nf6 {Counter-attacks e4.} O-O {e4 is indirectly defended: after ...Nxe4, Re1 wins it back.} Be7 Re1 {Now e4 is defended and Bxc6 followed by Nxe5 is a real threat.} b5 Bb3 d6 {Solidly defends e5.} c3 {Prepares d4 and gives the bishop a retreat square on c2.} O-O h3 {Stops ...Bg4, which would pin the knight and pressure d4.} Na5 {Hunts the strong bishop.} Bc2 c5 {Gains queenside space and pressures d4.} d4 Qc7 {Defends e5 and connects the rooks.} Nbd2 {The knight heads for f1 and g3 or e3.}',
      },
      {
        id: 'enc-ruy-berlin',
        name: 'Berlin Defence',
        moves:
          'e4 e5 Nf3 Nc6 Bb5 Nf6 {The Berlin: counter-attack e4 at once.} O-O Nxe4 {Takes the pawn; White wins it back.} d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8 {The Berlin endgame: Black has lost castling and has doubled pawns, but the bishop pair and no weaknesses make it very hard to beat.} Nc3 Ke8 {The king tucks away on the kingside.} h3 {Stops ...Bg4 and prepares g4 to chase the knight.}',
      },
      {
        id: 'enc-ruy-marshall',
        name: 'Marshall Attack',
        moves:
          'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5 {The Marshall gambit: Black gives a pawn for a fierce kingside attack.} exd5 Nxd5 Nxe5 Nxe5 Rxe5 c6 {Opens the way for the queen and bishop.} d4 Bd6 {Hits the rook and aims at h2.} Re1 Qh4 {The attack begins.} g3 Qh3 {The queen sits next to White’s king; White must defend accurately for a long time.}',
      },
      {
        id: 'enc-ruy-exchange',
        name: 'Exchange Variation',
        moves:
          'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 {Gives up the bishop to damage Black’s pawns.} dxc6 {Recapturing with the d-pawn opens the d-file and the c8-bishop’s diagonal.} O-O f6 {Defends e5 calmly.} d4 exd4 Nxd4 c5 Nb3 Qxd1 Rxd1 {White hopes for an endgame where the healthy kingside majority wins; Black has the bishop pair as compensation.}',
      },
    ],
  },
  {
    id: 'enc-italian',
    name: 'Italian Game',
    group: 'enc-open',
    side: 'white',
    eco: 'C50–C58',
    summary: 'The bishop goes to c4 to aim at f7. Today the slow Giuoco Pianissimo (c3 and d3) is a top-level main line; the Evans Gambit and 4.Ng5 are the sharp alternatives.',
    ideas: [
      'White: slow build-up with c3, d3, O-O, Re1, a4 and Nbd2–f1–g3; d3–d4 comes when everything is ready.',
      'Black: ...a6 and ...Ba7 keep the bishop on its strong diagonal; ...h6 stops Bg5 pins.',
      'Evans Gambit: White gives the b-pawn to gain time for c3 and d4 and a lead in development.',
      'Two Knights 4.Ng5: White attacks f7 directly; Black gives a pawn for rapid development with ...d5 and ...Na5.',
    ],
    lines: [
      {
        id: 'enc-italian-pianissimo',
        name: 'Giuoco Pianissimo',
        moves:
          'e4 e5 Nf3 Nc6 Bc4 {Aims at f7.} Bc5 {Black mirrors, aiming at f2.} c3 {Prepares d4.} Nf6 d3 {The quiet approach: keep e4 solid and build up first.} d6 O-O a6 {Gives the bishop a retreat on a7.} a4 {Takes queenside space and stops ...b5.} Ba7 Re1 O-O h3 h6 {Both sides stop the Bg5/Bg4 pins.} Nbd2 Re8 {Typical: the knight goes to f1 and g3, then White plays d4 or attacks on the kingside.}',
      },
      {
        id: 'enc-italian-evans',
        name: 'Evans Gambit',
        moves:
          'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 {The Evans Gambit: a pawn for time.} Bxb4 c3 {Gains a tempo on the bishop and prepares d4.} Ba5 d4 exd4 O-O {White has a lead in development and open lines against Black’s king, which is still in the centre.}',
      },
      {
        id: 'enc-italian-ng5',
        name: 'Two Knights: 4.Ng5',
        moves:
          'e4 e5 Nf3 Nc6 Bc4 Nf6 {The Two Knights Defence.} Ng5 {Attacks f7 twice.} d5 {Blocks the bishop’s diagonal.} exd5 Na5 {Not 5...Nxd5? 6.Nxf7 (the Fried Liver). Black gives a pawn but chases the bishop.} Bb5+ c6 dxc6 bxc6 Be2 h6 {Kicks the knight.} Nf3 e4 {Black gains space and time.} Ne5 {Black has good compensation for the pawn: active pieces and the e4 wedge.}',
      },
    ],
  },
  {
    id: 'enc-scotch',
    name: 'Scotch Game',
    group: 'enc-open',
    side: 'white',
    eco: 'C44–C45',
    summary: 'White opens the centre at once with 3.d4. The game becomes open and concrete; White gets space and quick development.',
    ideas: [
      'White: after 4.Nxd4 the knight is centralised; White often plays Nxc6 to give Black doubled c-pawns.',
      'Black: 4...Nf6 attacks e4; 4...Bc5 develops with pressure on the d4-knight.',
      'In the Mieses line (5.Nxc6 bxc6 6.e5) White grabs space; Black’s pieces must find active squares before the space tells.',
    ],
    lines: [
      {
        id: 'enc-scotch-mieses',
        name: 'Mieses Variation (4...Nf6)',
        moves:
          'e4 e5 Nf3 Nc6 d4 {Opens the centre immediately.} exd4 Nxd4 Nf6 {Attacks e4.} Nxc6 bxc6 {Black’s pawns are doubled, but the b-file opens and d5 is supported.} e5 {Gains space and kicks the knight.} Qe7 {Pins the e5-pawn against the king.} Qe2 Nd5 c4 Ba6 {Pins the c4-pawn: a sharp, rich position.}',
      },
      {
        id: 'enc-scotch-bc5',
        name: 'Classical (4...Bc5)',
        moves:
          'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 {Develops with an attack on d4.} Nxc6 Qf6 {Threatens mate on f2 and takes back on c6 next.} Qd2 dxc6 Nc3 {Both sides develop quickly; Black’s bishop pair against White’s better structure.}',
      },
    ],
  },
  {
    id: 'enc-petrov',
    name: 'Petrov (Russian) Defence',
    group: 'enc-open',
    side: 'black',
    eco: 'C42–C43',
    summary: 'Black answers the attack on e5 with a counter-attack on e4. Very solid and symmetrical: a favourite of players who want a safe game with Black.',
    ideas: [
      'Black: never copy White blindly: after 3.Nxe5 Nxe4? 4.Qe2 wins material. First 3...d6, then take on e4.',
      'Black: the knight on e4 is well placed; Black develops with ...Be7, ...Nc6, ...O-O.',
      'White: aims for a slightly more active position with c4 and pressure on the centre.',
    ],
    lines: [
      {
        id: 'enc-petrov-main',
        name: 'Classical main line',
        moves:
          'e4 e5 Nf3 Nf6 {Counter-attack e4.} Nxe5 d6 {First kick the knight; taking on e4 at once is a mistake.} Nf3 Nxe4 d4 d5 {Supports the strong knight on e4.} Bd3 Nc6 O-O Be7 c4 {White attacks the centre to undermine the e4-knight.} Nb4 {Hits the bishop.} Be2 O-O {Symmetrical and solid; White has a small initiative.}',
      },
    ],
  },
  {
    id: 'enc-kings-gambit',
    name: 'King’s Gambit',
    group: 'enc-open',
    side: 'white',
    eco: 'C30–C39',
    summary: 'The romantic gambit: White gives the f-pawn to open the f-file and build a big centre. Risky for both kings.',
    ideas: [
      'White: after ...exf4 White wants d4, Bxf4 and an attack down the f-file.',
      'Black: holding the extra pawn with ...g5 is the critical try; returning it with ...d5 is the safe one.',
      'Both kings are exposed: concrete calculation matters more than general rules.',
    ],
    lines: [
      {
        id: 'enc-kg-kieseritzky',
        name: 'Kieseritzky Gambit',
        moves:
          'e4 e5 f4 {Offers the f-pawn to deflect e5.} exf4 Nf3 {Stops ...Qh4+.} g5 {Defends the extra pawn on f4.} h4 {Undermines the pawn chain at once.} g4 Ne5 {The Kieseritzky: the knight jumps forward instead of retreating.} Nf6 {Counter-attacks e4.} Bc4 {Aims at f7.} d5 {Blocks the bishop and gives a pawn back to speed up development.} exd5 Bd6 {Hits the e5-knight.} d4 Nh5 {Guards the f4-pawn; both kings are exposed and every move counts.}',
      },
    ],
  },
  {
    id: 'enc-vienna',
    name: 'Vienna Game',
    group: 'enc-open',
    side: 'white',
    eco: 'C25–C29',
    summary: 'White develops the queen’s knight first and keeps f2–f4 in reserve: a King’s Gambit with more preparation.',
    ideas: [
      'White: f4 is the main idea; Nc3 first stops ...d5 ideas and supports e4.',
      'Black: the strongest answer to f4 is the counter-strike ...d5, opening the centre while White’s king is uncastled.',
    ],
    lines: [
      {
        id: 'enc-vienna-gambit',
        name: 'Vienna Gambit',
        moves:
          'e4 e5 Nc3 {Develops and supports e4.} Nf6 f4 {The gambit.} d5 {Strike back in the centre.} fxe5 Nxe4 {The knight is strong on e4.} Nf3 Bc5 {Develops toward White’s uncastled king.} d4 Bb4 {Pins the c3-knight, which is the only piece that can challenge e4.} Bd2 c5 {Strikes at d4: Black gets quick counterplay against White’s centre.}',
      },
    ],
  },
  {
    id: 'enc-four-knights',
    name: 'Four Knights Game',
    group: 'enc-open',
    side: 'white',
    eco: 'C46–C49',
    summary: 'Both sides bring out their knights first. Simple, sound development: a good opening to understand piece play.',
    ideas: [
      'Spanish Four Knights (4.Bb5): the bishop pins/pressures c6 like in the Ruy Lopez.',
      'Symmetrical positions favour the side that breaks the symmetry first with a good plan.',
    ],
    lines: [
      {
        id: 'enc-4n-spanish',
        name: 'Spanish Four Knights, Symmetrical',
        moves:
          'e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Bb4 {Black copies White.} O-O O-O d3 d6 Bg5 {Pins the knight and starts to threaten Nd5.} Bxc3 {Black removes the knight before it lands on d5.}',
      },
    ],
  },

  // ───────────────────────── Sicilian ─────────────────────────
  {
    id: 'enc-najdorf',
    name: 'Sicilian Najdorf',
    group: 'enc-sicilian',
    side: 'black',
    eco: 'B90–B99',
    summary: 'Fischer’s and Kasparov’s weapon. 5...a6 is a flexible waiting move: it stops Nb5 and Bb5 and prepares ...e5 or ...e6 and ...b5.',
    ideas: [
      'Black: ...e5 gains space and kicks the d4-knight; the d5 square becomes the key battleground.',
      'Black: queenside play with ...b5, ...Bb7 and the half-open c-file.',
      'White (English Attack, Be3/f3/Qd2/O-O-O): pawn storm with g4–g5 and h4–h5 against Black’s king.',
      'Opposite-side castling: both players race; every tempo counts.',
    ],
    lines: [
      {
        id: 'enc-najdorf-english',
        name: 'English Attack (6.Be3)',
        moves:
          'e4 c5 {Fights for d4 from the side.} Nf3 d6 d4 cxd4 {Trades a wing pawn for a centre pawn.} Nxd4 Nf6 {Attacks e4.} Nc3 a6 {The Najdorf.} Be3 e5 {Space, and the knight must retreat.} Nb3 Be6 {Fights for d5.} f3 {Supports e4 and prepares g4.} Be7 Qd2 O-O O-O-O {Kings on opposite sides: the race begins.} Nbd7 g4 b5 {White attacks on the kingside, Black on the queenside.}',
      },
      {
        id: 'enc-najdorf-bg5',
        name: '6.Bg5 main line',
        moves:
          'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 {Pins the f6-knight.} e6 {Breaks the pin threat on d5 and prepares ...Be7.} f4 {Threatens e5.} Be7 Qf3 Qc7 {Hits c3 and supports ...Nbd7.} O-O-O Nbd7 {A classic sharp battle: White breaks with e5 or g4, Black counters with ...b5.}',
      },
    ],
  },
  {
    id: 'enc-dragon',
    name: 'Sicilian Dragon',
    group: 'enc-sicilian',
    side: 'black',
    eco: 'B70–B79',
    summary: 'Black fianchettoes the bishop on g7, where it bites down the long diagonal. Against the Yugoslav Attack it becomes one of the sharpest races in chess.',
    ideas: [
      'Black: the g7-bishop plus the half-open c-file and the ...Rxc3 exchange sacrifice are the main weapons.',
      'White (Yugoslav Attack): Be3, f3, Qd2, O-O-O, then h4–h5 to open the h-file and trade the dragon bishop with Bh6.',
      'Black’s knight jumps to e5 and c4 to swap White’s attacking bishop.',
    ],
    lines: [
      {
        id: 'enc-dragon-yugoslav',
        name: 'Yugoslav Attack (9.Bc4)',
        moves:
          'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 {The Dragon.} Be3 Bg7 f3 {Stops ...Ng4 and supports a g4/h4 attack.} O-O Qd2 Nc6 Bc4 {Aims at f7 and controls d5.} Bd7 O-O-O Rc8 {Pressure on the c-file.} Bb3 Ne5 {Heads for c4.} h4 {White’s attack: h5, Bh6 and mate on the h-file.}',
      },
    ],
  },
  {
    id: 'enc-sveshnikov',
    name: 'Sicilian Sveshnikov',
    group: 'enc-sicilian',
    side: 'black',
    eco: 'B33',
    summary: 'Black plays ...e5 early, accepting a hole on d5 and a backward d-pawn in return for active pieces and time. A modern main line at the top level.',
    ideas: [
      'Black: ...b5 and ...f5 give dynamic counterplay; the bishop pair compensates for the doubled f-pawns.',
      'White: the knight on d5 is the pride of White’s position; White plays c3 and Nc2 to re-route the a3-knight.',
    ],
    lines: [
      {
        id: 'enc-sveshnikov-main',
        name: 'Main line (9.Bxf6)',
        moves:
          'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 {The Sveshnikov: kick the knight at once.} Ndb5 {Eyes d6 and c7.} d6 Bg5 {Fights for d5.} a6 Na3 b5 {Gains space; the a3-knight is offside.} Bxf6 gxf6 {Doubled pawns, but the bishop pair and open g-file.} Nd5 f5 {Black hits the centre at once.}',
      },
    ],
  },
  {
    id: 'enc-taimanov',
    name: 'Sicilian Taimanov',
    group: 'enc-sicilian',
    side: 'black',
    eco: 'B46–B49',
    summary: 'Black keeps the pawn on e6 and develops flexibly with ...Nc6 and ...Qc7. Solid, but with plenty of counterplay.',
    ideas: [
      'Black: the queen on c7 controls e5; ...a6 and ...b5 give queenside space.',
      'Black can choose between ...Nf6/...Bb4 pressure on e4 and a hedgehog set-up.',
      'White: the English Attack (Be3, Qd2, O-O-O, f3) again.',
    ],
    lines: [
      {
        id: 'enc-taimanov-english',
        name: 'English Attack',
        moves:
          'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6 Nc3 Qc7 {Controls e5 and prepares ...a6.} Be3 a6 Qd2 Nf6 O-O-O Bb4 {Pins the c3-knight and hits e4.} f3 {Supports e4; a sharp middlegame follows with ...Ne5 and ...b5.}',
      },
    ],
  },
  {
    id: 'enc-rossolimo',
    name: 'Sicilian Rossolimo (3.Bb5)',
    group: 'enc-sicilian',
    side: 'white',
    eco: 'B30–B31',
    summary: 'An anti-Sicilian: White avoids the open Sicilian, develops quickly and often gives the bishop for the c6-knight to damage Black’s pawns.',
    ideas: [
      'White: castle, Re1, c3 and d4 for the centre, or Bxc6 to double Black’s pawns.',
      'Black: the bishop pair and the fianchetto (...g6, ...Bg7) give long-term counterplay.',
    ],
    lines: [
      {
        id: 'enc-rossolimo-g6',
        name: '3...g6',
        moves:
          'e4 c5 Nf3 Nc6 Bb5 {Pins the knight that controls d4.} g6 O-O Bg7 Re1 e5 {Black blocks the centre and keeps the bishop pair options.} Bxc6 {White gives the bishop to double Black’s pawns.} dxc6 d3 {White plans Nbd2–c4 and pressure against e5.}',
      },
    ],
  },
  {
    id: 'enc-alapin',
    name: 'Sicilian Alapin (2.c3)',
    group: 'enc-sicilian',
    side: 'white',
    eco: 'B22',
    summary: 'White prepares d4 so that a pawn, not a knight, recaptures: White gets a classical centre and avoids the open Sicilian’s theory.',
    ideas: [
      'Black: hit the centre at once with 2...Nf6 or 2...d5.',
      'White often ends up with an isolated d-pawn: activity in return for a long-term weakness.',
    ],
    lines: [
      {
        id: 'enc-alapin-nf6',
        name: '2...Nf6',
        moves:
          'e4 c5 c3 {Prepares d4.} Nf6 {Attacks e4.} e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6 {Black hits the e5-pawn; the position resembles an Alekhine.} Bc4 Nb6 Bb5 {Pressure on c6 keeps e5 under control.}',
      },
    ],
  },

  // ───────────────────────── Other defences to 1.e4 ─────────────────────────
  {
    id: 'enc-french',
    name: 'French Defence',
    group: 'enc-semi',
    side: 'black',
    eco: 'C00–C19',
    summary: 'Black builds a solid wall with ...e6 and ...d5 and then attacks White’s centre from the side with ...c5 and ...f6. The price: the c8-bishop is often “bad”, shut in behind e6.',
    ideas: [
      'Black: attack the base of White’s pawn chain with ...c5, then the head with ...f6.',
      'Black: free the light-squared bishop (...b6 and ...Ba6, or ...Bd7–e8–h5) or trade it.',
      'White: space on the kingside after e4–e5; attack the black king with Qg4, f4–f5 or Bd3 and Qh5 ideas.',
      'Winawer (3...Bb4): Black gives the bishop for the c3-knight and doubles White’s pawns; White gets the bishop pair and dark-square attacking chances.',
    ],
    lines: [
      {
        id: 'enc-french-winawer',
        name: 'Winawer: Poisoned Pawn',
        moves:
          'e4 e6 {Prepares ...d5.} d4 d5 Nc3 {Defends e4.} Bb4 {The Winawer: pin the knight that defends e4.} e5 c5 {Strikes at the base of the chain.} a3 Bxc3+ bxc3 {White has doubled pawns but the bishop pair.} Ne7 Qg4 {Attacks g7: the dark squares around Black’s king are weak without the bishop.} Qc7 {Counter-attack: Black sacrifices g7 for play against c3 and the centre.} Qxg7 Rg8 Qxh7 cxd4 Ne2 Nbc6 f4 {Very sharp: White has extra kingside pawns, Black has central pressure and open files.}',
      },
      {
        id: 'enc-french-classical',
        name: 'Classical: Steinitz Variation',
        moves:
          'e4 e6 d4 d5 Nc3 Nf6 {Attacks e4.} e5 {Gains space and kicks the knight.} Nfd7 f4 {Supports e5 and prepares f5.} c5 Nf3 Nc6 Be3 {Defends d4.} cxd4 Nxd4 Bc5 {Black fights for d4 and the dark squares.} Qd2 O-O {White has space; Black hits the centre with ...f6 or ...Qb6.}',
      },
      {
        id: 'enc-french-tarrasch',
        name: 'Tarrasch (3.Nd2)',
        moves:
          'e4 e6 d4 d5 Nd2 {Avoids the Winawer pin and keeps c3 for a pawn.} c5 {The most active reply.} exd5 Qxd5 {Black gets free piece play in an open position.} Ngf3 cxd4 Bc4 {Gains time on the queen.} Qd6 O-O Nf6 Nb3 Nc6 Nbxd4 {White has a small lead in development; Black is solid.}',
      },
      {
        id: 'enc-french-exchange',
        name: 'Exchange Variation',
        moves:
          'e4 e6 d4 d5 exd5 exd5 {A symmetrical structure: Black’s c8-bishop is freed at once.} Bd3 Nc6 c3 Bd6 {Both sides develop naturally; the game is about piece play, not pawn breaks.}',
      },
    ],
  },
  {
    id: 'enc-caro',
    name: 'Caro-Kann Defence',
    group: 'enc-semi',
    side: 'black',
    eco: 'B10–B19',
    summary: 'Like the French, Black supports ...d5 with a pawn, but with ...c6, so the light-squared bishop can come out to f5 before ...e6. Solid and sound: a favourite of world champions.',
    ideas: [
      'Black: develop the c8-bishop outside the pawn chain (…Bf5 or …Bg4) before playing …e6.',
      'Black: in the Advance, hit the chain with …c5 and use the f5-bishop actively.',
      'White (Classical): gain space with h4–h5 against the bishop, castle queenside and use the space advantage.',
      'Panov (exchange with c4): Black gets play against White’s isolated d-pawn.',
    ],
    lines: [
      {
        id: 'enc-caro-classical',
        name: 'Classical (4...Bf5)',
        moves:
          'e4 c6 {Prepares ...d5.} d4 d5 Nc3 dxe4 Nxe4 Bf5 {The bishop comes out before ...e6.} Ng3 {Gains time on the bishop.} Bg6 h4 {Threatens h5 to trap the bishop.} h6 Nf3 Nd7 {Stops Ne5.} h5 Bh7 Bd3 Bxd3 Qxd3 e6 Bd2 Ngf6 O-O-O {White has more space; Black is very solid.}',
      },
      {
        id: 'enc-caro-advance',
        name: 'Advance (Short Variation)',
        moves:
          'e4 c6 d4 d5 e5 {Gains space.} Bf5 {The bishop comes out first.} Nf3 e6 Be2 c5 {Attacks the base of the chain.} Be3 {Supports d4.} Nd7 O-O Ne7 {Heads for c6 or f5; a strategic battle around d4 and e5.}',
      },
      {
        id: 'enc-caro-panov',
        name: 'Panov Attack',
        moves:
          'e4 c6 d4 d5 exd5 cxd5 c4 {The Panov: White accepts an isolated pawn for activity.} Nf6 Nc3 e6 Nf3 Be7 {Black blockades d5 and plays against the future isolated d4-pawn.}',
      },
    ],
  },
  {
    id: 'enc-pirc',
    name: 'Pirc Defence',
    group: 'enc-semi',
    side: 'black',
    eco: 'B07–B09',
    summary: 'A hypermodern defence: Black lets White build a big centre, fianchettoes the bishop on g7 and strikes back later with ...c5 or ...e5.',
    ideas: [
      'Black: the g7-bishop and the breaks ...c5 or ...e5 undermine White’s centre.',
      'White (Austrian Attack, f4): a huge centre and an attack with e5; Black must hit back quickly.',
    ],
    lines: [
      {
        id: 'enc-pirc-austrian',
        name: 'Austrian Attack',
        moves:
          'e4 d6 d4 Nf6 Nc3 g6 {The Pirc.} f4 {The Austrian Attack: three centre pawns.} Bg7 Nf3 O-O Bd3 Na6 {Prepares ...c5 without allowing Bb5.} O-O c5 {Strikes at d4; the game turns sharp.}',
      },
    ],
  },
  {
    id: 'enc-scandinavian',
    name: 'Scandinavian Defence',
    group: 'enc-semi',
    side: 'black',
    eco: 'B01',
    summary: 'Black challenges e4 at once with 1...d5. After 2.exd5 Qxd5 the queen comes out early, but Black gets a clear, easy-to-play position.',
    ideas: [
      'Black: the queen retreats to a5 or d6 after Nc3; then ...Nf6, ...Bf5 or ...Bg4, ...e6, ...c6: a solid “Caro-Kann” structure.',
      'White: gains time on the queen and plays for a lead in development and space.',
    ],
    lines: [
      {
        id: 'enc-scandi-qd6',
        name: 'Modern: 3...Qd6',
        moves:
          'e4 d5 {Challenge e4 immediately.} exd5 Qxd5 Nc3 {Develops with tempo on the queen.} Qd6 {The modern retreat: the queen controls e5 and b4.} d4 Nf6 Nf3 a6 {Prevents Nb5 and Bb5+, and prepares ...b5 or ...Bg4.}',
      },
    ],
  },
  {
    id: 'enc-alekhine',
    name: 'Alekhine Defence',
    group: 'enc-semi',
    side: 'black',
    eco: 'B02–B05',
    summary: 'Black provokes White’s pawns forward with 1...Nf6, then attacks the over-extended centre. Very provocative and hypermodern.',
    ideas: [
      'Black: the knight dances, but each pawn White pushes becomes a target for ...d6, ...c5 and ...f6.',
      'White: keep the space advantage without over-extending; the Modern Variation (4.Nf3) is calm and strong.',
    ],
    lines: [
      {
        id: 'enc-alekhine-modern',
        name: 'Modern Variation',
        moves:
          'e4 Nf6 {Attacks e4 and invites e5.} e5 Nd5 d4 d6 {Attacks the e5-pawn at once.} Nf3 Bg4 {Pins the knight that defends e5.} Be2 e6 O-O Be7 c4 Nb6 {Black’s pieces are solid; the fight is about White’s space against Black’s pressure on the centre.}',
      },
    ],
  },

  // ───────────────────────── 1.d4 d5 ─────────────────────────
  {
    id: 'enc-qgd',
    name: 'Queen’s Gambit Declined',
    group: 'enc-qg',
    side: 'black',
    eco: 'D30–D69',
    summary: 'Black declines the gambit with 2...e6 and keeps a pawn on d5. Solid, classical and very well understood: it has held up at world-championship level for over a century.',
    ideas: [
      'Black: hold d5, develop with ...Nf6, ...Be7, ...O-O, ...Nbd7, then free the position with ...c5 or ...e5, or exchange pieces with ...Ne4.',
      'White: the minority attack (b4–b5) in the Exchange Variation, or central expansion with e4.',
      'Black’s problem piece is the c8-bishop; freeing it is the main strategic task.',
    ],
    lines: [
      {
        id: 'enc-qgd-orthodox',
        name: 'Orthodox: Lasker Defence',
        moves:
          'd4 d5 c4 {The Queen’s Gambit: offers the c-pawn to deflect d5.} e6 {Declines and keeps d5 solid.} Nc3 Nf6 Bg5 {Pins the knight that defends d5.} Be7 e3 O-O Nf3 h6 Bh4 Ne4 {Lasker’s idea: trade pieces to free Black’s cramped position.} Bxe7 Qxe7 cxd5 Nxc3 bxc3 exd5 {Black has freed the game; the c8-bishop now has the c8–h3 diagonal.}',
      },
      {
        id: 'enc-qgd-exchange',
        name: 'Exchange: Carlsbad structure',
        moves:
          'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 {The Carlsbad pawn structure.} Bg5 c6 e3 Be7 Bd3 Nbd7 Qc2 O-O Nf3 Re8 O-O Nf8 {Black regroups the knight to g6 or e6.} Rab1 {Prepares the minority attack b4–b5.}',
      },
    ],
  },
  {
    id: 'enc-qga',
    name: 'Queen’s Gambit Accepted',
    group: 'enc-qg',
    side: 'black',
    eco: 'D20–D29',
    summary: 'Black takes the c4-pawn, not to keep it, but to free the position: White gets the centre, Black gets free development and play against d4.',
    ideas: [
      'Black: don’t hold on to c4; develop with ...Nf6, ...e6, ...c5 and ...a6–b5.',
      'White: wins the pawn back with Bxc4 and plays for e3–e4 or an isolated-pawn position with active pieces.',
    ],
    lines: [
      {
        id: 'enc-qga-classical',
        name: 'Classical (4.e3)',
        moves:
          'd4 d5 c4 dxc4 {Accepts the gambit.} Nf3 {Stops ...e5.} Nf6 e3 e6 Bxc4 {White regains the pawn.} c5 {Hits d4 at once.} O-O a6 {Prepares ...b5.} dxc5 Qxd1 Rxd1 Bxc5 {A balanced endgame-like position where Black’s activity matches White’s development.}',
      },
    ],
  },
  {
    id: 'enc-slav',
    name: 'Slav and Semi-Slav',
    group: 'enc-qg',
    side: 'black',
    eco: 'D10–D19, D43–D49',
    summary: 'Black supports d5 with ...c6 instead of ...e6, so the c8-bishop can still come out (Slav), or keeps it home for a rich, dynamic Semi-Slav with ...e6.',
    ideas: [
      'Slav: Black takes on c4 and develops the bishop to f5 or g4 before ...e6.',
      'Semi-Slav (Meran): ...dxc4 and ...b5 gain queenside space; ...c5 follows.',
      'White: a4 stops ...b5 in the Slav; in the Meran White plays for e4–e5.',
    ],
    lines: [
      {
        id: 'enc-slav-main',
        name: 'Slav main line (5.a4 Bf5)',
        moves:
          'd4 d5 c4 c6 {The Slav: supports d5 and keeps the c8–h3 diagonal open.} Nf3 Nf6 Nc3 dxc4 {Now Black can try to keep the pawn with ...b5.} a4 {Stops ...b5.} Bf5 {The bishop comes out before ...e6.} e3 e6 Bxc4 Bb4 O-O O-O Qe2 {White prepares e4; Black’s position is very solid.}',
      },
      {
        id: 'enc-slav-meran',
        name: 'Semi-Slav: Meran',
        moves:
          'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6 {The Semi-Slav.} e3 Nbd7 Bd3 dxc4 Bxc4 b5 {The Meran: queenside space with tempo.} Bd3 Bb7 {Next comes ...a6 and ...c5 to free the game.}',
      },
    ],
  },
  {
    id: 'enc-catalan',
    name: 'Catalan Opening',
    group: 'enc-qg',
    side: 'white',
    eco: 'E00–E09',
    summary: 'A Queen’s Gambit with the bishop fianchettoed on g2, where it presses against d5 and the long diagonal. Long-term, positional pressure.',
    ideas: [
      'White: the g2-bishop pressures b7 and the queenside; White often gives a pawn on c4 for lasting pressure.',
      'Black: take on c4 and try to keep it with ...a6 and ...b5, or play ...c5/...c6 to blunt the bishop.',
    ],
    lines: [
      {
        id: 'enc-catalan-open',
        name: 'Open Catalan',
        moves:
          'd4 Nf6 c4 e6 g3 {The Catalan.} d5 Bg2 Be7 Nf3 O-O O-O dxc4 {Black takes the pawn.} Qc2 {Wins it back.} a6 Qxc4 b5 {Gains time on the queen.} Qc2 Bb7 {Black has developed; White’s bishop on g2 still pressures the long diagonal.}',
      },
    ],
  },
  {
    id: 'enc-london',
    name: 'London System',
    group: 'enc-qg',
    side: 'white',
    eco: 'D02, A46',
    summary: 'A system, not a sharp opening: White plays d4, Bf4, e3, Nf3, c3, Bd3 and Nbd2 against almost anything. Easy to learn, solid, and popular at every level.',
    ideas: [
      'White: the f4-bishop goes out before e3; the pyramid c3–d4–e3 is rock solid.',
      'White: kingside attack with Ne5, Qf3 and g4 against a black king on g8.',
      'Black: ...c5 and ...Qb6 hit b2 and d4; ...Nh5 can trade the strong f4-bishop.',
    ],
    lines: [
      {
        id: 'enc-london-main',
        name: 'Main set-up',
        moves:
          'd4 d5 Bf4 {The London bishop comes out before e3.} Nf6 e3 c5 c3 Nc6 Nd2 e6 Ngf3 Bd6 Bg3 {Keeps the bishop; after ...Bxg3 hxg3 the h-file opens for White.} O-O Bd3 {The classic London set-up is complete.}',
      },
    ],
  },

  // ───────────────────────── Indian defences ─────────────────────────
  {
    id: 'enc-kid',
    name: 'King’s Indian Defence',
    group: 'enc-indian',
    side: 'black',
    eco: 'E60–E99',
    summary: 'Black lets White build a big centre, castles behind a fianchettoed bishop and then strikes with ...e5 and ...f5. When the centre locks, it becomes a race: White on the queenside, Black on the kingside.',
    ideas: [
      'Black: after d4–d5 the pawn chain points to the kingside: ...Ne8/...Nd7, ...f5, ...f4, ...g5–g4 is the classic attack.',
      'White: play on the queenside with c5, b4 and Nd2–c4, where White’s chain points.',
      'The g7-bishop looks blocked in these lines but often decides the game later.',
    ],
    lines: [
      {
        id: 'enc-kid-classical',
        name: 'Classical: Mar del Plata',
        moves:
          'd4 Nf6 c4 g6 {Prepares the fianchetto.} Nc3 Bg7 e4 d6 {White has a big centre; Black will attack it later.} Nf3 O-O Be2 e5 {Strikes at d4.} O-O Nc6 d5 {Closes the centre.} Ne7 {Heads for the kingside.} Ne1 {Makes room for f3 and heads for d3.} Nd7 Be3 f5 {The thematic break.} f3 f4 Bf2 g5 {The pawn storm: ...g4 is next.}',
      },
      {
        id: 'enc-kid-samisch',
        name: 'Sämisch (5.f3)',
        moves:
          'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3 {Supports e4 and prepares Be3, Qd2 and a kingside pawn storm.} O-O Be3 e5 d5 Nh5 {Prepares ...f5.} Qd2 f5 O-O-O {Opposite-side castling: a race of pawn storms.}',
      },
    ],
  },
  {
    id: 'enc-nimzo',
    name: 'Nimzo-Indian Defence',
    group: 'enc-indian',
    side: 'black',
    eco: 'E20–E59',
    summary: 'Black pins the c3-knight to stop e4. Black is often happy to give the bishop for the knight to double White’s pawns. One of the soundest defences to 1.d4.',
    ideas: [
      'Black: control e4 with ...Bb4, ...Ne4 and ...b6/...Bb7.',
      'Black: after ...Bxc3, play against White’s doubled c-pawns with ...c5, ...Nc6–a5 and ...Ba6.',
      'White: the bishop pair and a strong centre; 4.Qc2 avoids doubled pawns, 4.e3 develops quickly.',
    ],
    lines: [
      {
        id: 'enc-nimzo-classical',
        name: 'Classical (4.Qc2)',
        moves:
          'd4 Nf6 c4 e6 Nc3 Bb4 {The Nimzo-Indian pin.} Qc2 {Recaptures with the queen if ...Bxc3, avoiding doubled pawns.} O-O a3 Bxc3+ Qxc3 d5 {Black fights for the centre.} Nf3 dxc4 Qxc4 b6 {Black develops the bishop to b7 or a6 with tempo.}',
      },
      {
        id: 'enc-nimzo-rubinstein',
        name: 'Rubinstein (4.e3)',
        moves:
          'd4 Nf6 c4 e6 Nc3 Bb4 e3 {Simple development.} O-O Bd3 d5 Nf3 c5 O-O Nc6 a3 Bxc3 bxc3 dxc4 Bxc4 Qc7 {Black aims at e5 to stop White’s e4; White has the bishop pair and centre.}',
      },
    ],
  },
  {
    id: 'enc-qid',
    name: 'Queen’s Indian Defence',
    group: 'enc-indian',
    side: 'black',
    eco: 'E12–E19',
    summary: 'After 3.Nf3 (avoiding the Nimzo), Black fianchettoes the queen’s bishop to control e4 and d5. Solid and positional.',
    ideas: [
      'Black: the b7- or a6-bishop fights for e4; ...d5 or ...c5 come later.',
      'White: the g2-bishop opposes it on the long diagonal; White aims for a central break with d4–d5 or e4.',
    ],
    lines: [
      {
        id: 'enc-qid-main',
        name: 'Main line (4.g3 Ba6)',
        moves:
          'd4 Nf6 c4 e6 Nf3 b6 {The Queen’s Indian.} g3 Ba6 {Attacks c4 at once.} b3 Bb4+ {Disrupts White’s development.} Bd2 Be7 {The bishop on d2 is now misplaced.} Bg2 c6 Bc3 d5 Ne5 Nfd7 Nxd7 Nxd7 Nd2 O-O O-O {A solid, balanced middlegame.}',
      },
    ],
  },
  {
    id: 'enc-grunfeld',
    name: 'Grünfeld Defence',
    group: 'enc-indian',
    side: 'black',
    eco: 'D70–D99',
    summary: 'Black lets White build a big pawn centre and then attacks it with pieces: the g7-bishop, ...c5 and ...Nc6. Dynamic and very concrete.',
    ideas: [
      'Black: pressure on d4 with ...Bg7, ...c5, ...Nc6 and ...Qa5 or ...Bg4.',
      'White (Exchange): a big centre (c3, d4, e4) supported by Be3 and Ne2; the d4–d5 push is White’s main trump.',
    ],
    lines: [
      {
        id: 'enc-grunfeld-exchange',
        name: 'Exchange Variation',
        moves:
          'd4 Nf6 c4 g6 Nc3 d5 {The Grünfeld.} cxd5 Nxd5 e4 Nxc3 bxc3 {White has a big centre.} Bg7 {Already hits c3 and d4.} Bc4 c5 Ne2 Nc6 Be3 O-O O-O {The fight is about d4: Black piles up pressure, White prepares d5 or Rc1.}',
      },
      {
        id: 'enc-grunfeld-russian',
        name: 'Russian System (5.Qb3)',
        moves:
          'd4 Nf6 c4 g6 Nc3 d5 Nf3 Bg7 Qb3 {Attacks d5.} dxc4 Qxc4 O-O e4 {White has the centre.} Bg4 {Pressure on d4 via the f3-knight.}',
      },
    ],
  },
  {
    id: 'enc-benoni',
    name: 'Benoni and Benko',
    group: 'enc-indian',
    side: 'black',
    eco: 'A56–A79',
    summary: 'Black plays ...c5 against d4, inviting d5. In the Modern Benoni Black gets a queenside majority and active pieces; in the Benko Gambit Black gives a pawn for lasting pressure on the a- and b-files.',
    ideas: [
      'Modern Benoni: Black’s plan is ...a6, ...b5 and the queenside majority; White’s is e4–e5 or f4–f5 in the centre.',
      'Benko: Black’s rooks and the g7-bishop press on a2 and b2 down the open files; the pawn sacrifice is long-term.',
    ],
    lines: [
      {
        id: 'enc-benoni-modern',
        name: 'Modern Benoni',
        moves:
          'd4 Nf6 c4 c5 {Challenges d4.} d5 e6 Nc3 exd5 cxd5 d6 {The Benoni structure: Black has a queenside pawn majority, White a central one.} e4 g6 Nf3 Bg7 Be2 O-O O-O Re8 {Pressure against e4; ...a6 and ...b5 come next.}',
      },
      {
        id: 'enc-benko',
        name: 'Benko Gambit',
        moves:
          'd4 Nf6 c4 c5 d5 b5 {The Benko Gambit.} cxb5 a6 bxa6 Bxa6 {Black is a pawn down but has open a- and b-files.} Nc3 d6 e4 Bxf1 Kxf1 {White can’t castle; Black develops with ...g6, ...Bg7 and the rooks to a8 and b8.} g6',
      },
    ],
  },
  {
    id: 'enc-dutch',
    name: 'Dutch Defence',
    group: 'enc-indian',
    side: 'black',
    eco: 'A80–A99',
    summary: 'Black controls e4 with 1...f5 and plays for a kingside attack. Unbalanced from move one.',
    ideas: [
      'Leningrad: ...g6 and ...Bg7 combine the Dutch with a King’s Indian bishop; ...e5 is the main break.',
      'Stonewall: pawns on c6, d5, e6, f5 give a rock-solid grip on e4; the knight goes to e4, but e5 is a hole.',
      'White: fianchetto on g2 and fight for e4 with Nc3, Qc2 or the e4 break.',
    ],
    lines: [
      {
        id: 'enc-dutch-leningrad',
        name: 'Leningrad',
        moves:
          'd4 f5 {Controls e4.} g3 Nf6 Bg2 g6 Nf3 Bg7 O-O O-O c4 d6 {Prepares ...e5.} Nc3 Qe8 {The Leningrad queen manoeuvre: supports ...e5 and can swing to h5 for an attack.}',
      },
      {
        id: 'enc-dutch-stonewall',
        name: 'Stonewall',
        moves:
          'd4 e6 c4 f5 g3 Nf6 Bg2 d5 {The Stonewall wall of pawns.} Nf3 c6 O-O Bd6 {The bishop eyes h2; Black plans ...Qe7, ...O-O and ...Ne4.}',
      },
    ],
  },

  // ───────────────────────── Flank openings ─────────────────────────
  {
    id: 'enc-english',
    name: 'English Opening',
    group: 'enc-flank',
    side: 'white',
    eco: 'A10–A39',
    summary: '1.c4 controls d5 from the side. Often a Sicilian with colours reversed: White has an extra tempo for the same ideas.',
    ideas: [
      'White: the g2-bishop and a queenside push with b4–b5, or a central break with d4.',
      'Reversed Sicilian (1...e5): Black takes the centre and White plays a Sicilian a move up.',
      'Symmetrical (1...c5): long manoeuvring battles; the d4 or d5 breaks decide.',
    ],
    lines: [
      {
        id: 'enc-english-reversed',
        name: 'Reversed Sicilian (1...e5)',
        moves:
          'c4 {Controls d5.} e5 Nc3 Nf6 Nf3 Nc6 g3 d5 {A reversed open Sicilian, with White a tempo up.} cxd5 Nxd5 Bg2 Nb6 O-O Be7 {White presses on the long diagonal and the c-file; Black has central space.}',
      },
      {
        id: 'enc-english-symmetrical',
        name: 'Symmetrical (1...c5)',
        moves:
          'c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 {Full symmetry.} Nf3 e6 O-O Nge7 {Black prepares ...d5; White aims for d4 or the b4 break.}',
      },
    ],
  },
  {
    id: 'enc-reti',
    name: 'Réti Opening',
    group: 'enc-flank',
    side: 'white',
    eco: 'A04–A09',
    summary: '1.Nf3 and 2.c4: a hypermodern opening that attacks Black’s centre from the flanks and keeps every option open.',
    ideas: [
      'White: c4 against d5, the g2-bishop, and b3/Bb2 for the long diagonal.',
      'Black: occupy the centre with ...d5 and ...e5 or ...c6, but don’t let White undermine it.',
    ],
    lines: [
      {
        id: 'enc-reti-main',
        name: 'Main line (2...d4)',
        moves:
          'Nf3 d5 c4 {Attacks d5 from the side.} d4 {Black gains space.} e3 {Attacks the d4-pawn.} Nc6 exd4 Nxd4 Nxd4 Qxd4 Nc3 {White gains time on the queen; Black has an active queen and free development.}',
      },
    ],
  },
];
