// Endgame drills. Every position was checked with Stockfish (scripts in the dev notes):
// the "win" drills are forced wins and the "hold" drills are draws with correct defence.
import type { Goal } from '../components/PlayBoard';

export interface Drill {
  id: string;
  title: string;
  group: 'Checkmates' | 'King and pawn' | 'Rook endgames';
  fen: string;
  you: 'w' | 'b';
  goal: Goal;
  tip: string;
}

export const DRILLS: Drill[] = [
  {
    id: 'queen-mate',
    title: 'King and queen vs king',
    group: 'Checkmates',
    fen: '8/8/3k4/8/8/8/8/4K2Q w - - 0 1',
    you: 'w',
    goal: { type: 'mate', maxMoves: 15 },
    tip: 'Use the queen to shrink the enemy king’s box, staying a knight’s jump away from it. When the king is on the edge, bring your own king closer and mate. Always check: does the enemy king still have a legal move? If not, it is stalemate.',
  },
  {
    id: 'rook-mate',
    title: 'King and rook vs king',
    group: 'Checkmates',
    fen: '8/8/3k4/8/8/8/8/R3K3 w - - 0 1',
    you: 'w',
    goal: { type: 'mate', maxMoves: 25 },
    tip: 'Cut the king off with the rook, then walk your king up. When the kings face each other with one square between them, check from the side to push the king back a rank. Repeat until it is on the edge.',
  },
  {
    id: 'two-rooks',
    title: 'The ladder (two rooks)',
    group: 'Checkmates',
    fen: '8/8/8/4k3/8/8/8/R3K2R w - - 0 1',
    you: 'w',
    goal: { type: 'mate', maxMoves: 10 },
    tip: 'One rook cuts off a rank, the other gives check on the next rank: the king climbs down like a ladder. If the king attacks a rook, move that rook far away along the same rank.',
  },
  {
    id: 'kp-sixth',
    title: 'King on the 6th wins',
    group: 'King and pawn',
    fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1',
    you: 'w',
    goal: { type: 'promote', maxMoves: 12 },
    tip: 'With your king on the 6th rank in front of the pawn, you win whoever moves. Keep the opposition and walk the pawn home without allowing stalemate.',
  },
  {
    id: 'kp-key',
    title: 'Reach the key squares',
    group: 'King and pawn',
    fen: '8/8/3k4/8/8/2K5/3P4/8 w - - 0 1',
    you: 'w',
    goal: { type: 'promote', maxMoves: 15 },
    tip: 'Don’t push the pawn first. Lead with your king: get it in front of the pawn, two squares ahead (the "key squares"), then the pawn walks in.',
  },
  {
    id: 'kp-opposition',
    title: 'Win with the opposition',
    group: 'King and pawn',
    fen: '8/8/8/3k4/8/3K4/3P4/8 b - - 0 1',
    you: 'w',
    goal: { type: 'promote', maxMoves: 15 },
    tip: 'Black has to move and give way. Every time the black king steps aside, step forward and take the opposition again (kings face each other, one square apart, the other side to move).',
  },
  {
    id: 'square',
    title: 'The rule of the square',
    group: 'King and pawn',
    fen: '8/8/8/8/k7/8/6P1/7K w - - 0 1',
    you: 'w',
    goal: { type: 'promote', maxMoves: 8 },
    tip: 'Draw a square from the pawn to the promotion rank. If the enemy king can’t step inside it, just run. Remember the pawn may move two squares on its first move.',
  },
  {
    id: 'kp-hold',
    title: 'Hold the draw: block the pawn',
    group: 'King and pawn',
    fen: '8/4k3/8/8/4P3/4K3/8/8 b - - 0 1',
    you: 'b',
    goal: { type: 'draw', surviveMoves: 25 },
    tip: 'Stay in front of the pawn and keep the opposition: when the white king steps forward, face it. When the pawn reaches your second rank, step straight back in front of it.',
  },
  {
    id: 'kp-opposition-hold',
    title: 'Hold the draw: take the opposition',
    group: 'King and pawn',
    fen: '8/8/8/3k4/8/3K4/3P4/8 w - - 0 1',
    you: 'b',
    goal: { type: 'draw', surviveMoves: 25 },
    tip: 'The same position as "Win with the opposition", but White must move first, and that makes it a draw. Keep facing the white king; never step aside when you don’t have to.',
  },
  {
    id: 'rook-pawn',
    title: 'The rook-pawn draw',
    group: 'King and pawn',
    fen: '7k/8/7K/7P/8/8/8/8 b - - 0 1',
    you: 'b',
    goal: { type: 'draw', surviveMoves: 20 },
    tip: 'A rook pawn can’t be forced home if your king reaches the corner. Shuffle between h8 and g8 and you can’t be driven out.',
  },
  {
    id: 'lucena',
    title: 'Lucena: build a bridge',
    group: 'Rook endgames',
    fen: '3K4/3P1k2/8/8/8/8/2r5/4R3 w - - 0 1',
    you: 'w',
    goal: { type: 'promote', maxMoves: 20 },
    tip: 'Check the black king one more file away (Rf1+), then bring your rook to the 4th rank (Rf4). Walk your king out; when the checks start, block with the rook on the 4th rank: that is the bridge.',
  },
  {
    id: 'philidor',
    title: 'Philidor: the 3rd-rank defence',
    group: 'Rook endgames',
    fen: '4k3/R7/1r6/3KP3/8/8/8/8 b - - 0 1',
    you: 'b',
    goal: { type: 'draw', surviveMoves: 25 },
    tip: 'Keep your rook on your 3rd rank (here the 6th) so the white king can’t advance. Only when the pawn steps onto it, swing your rook to the back and give checks from behind.',
  },
];

export const findDrill = (id: string) => DRILLS.find((d) => d.id === id);
