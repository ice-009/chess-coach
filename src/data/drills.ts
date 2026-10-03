// Endgame drills. Every position was checked with Stockfish (scripts in the dev notes):
// the "win" drills are forced wins and the "hold" drills are draws with correct defence.
import type { Goal } from '../components/PlayBoard';

export interface Drill {
  id: string;
  title: string;
  group: 'Checkmates' | 'King and pawn' | 'Rook endgames' | 'Queen endgames';
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
    id: 'two-bishops',
    title: 'Two bishops vs king',
    group: 'Checkmates',
    fen: '8/8/3k4/8/8/8/8/2B1KB2 w - - 0 1',
    you: 'w',
    goal: { type: 'mate', maxMoves: 30 },
    tip: 'Put the bishops side by side: together they make a diagonal wall the king can’t cross. Shrink its area step by step, bring your king up to take the squares next to it, and drive it into a corner. The mate comes with the bishops on neighbouring diagonals. Watch for stalemate when the box gets small.',
  },
  {
    id: 'bn-corner',
    title: 'Bishop and knight: finish the mate',
    group: 'Checkmates',
    fen: '1k6/8/2K5/3N4/8/8/8/5B2 w - - 0 1',
    you: 'w',
    goal: { type: 'mate', maxMoves: 10 },
    tip: 'You can only mate in a corner your bishop controls: here the light-squared bishop needs a8 (or h1). Your king stands opposite the enemy king; the knight and bishop take turns covering the escape squares b8 and a7 until the bishop or knight gives mate.',
  },
  {
    id: 'bn-wrong-corner',
    title: 'Bishop and knight: from the wrong corner',
    group: 'Checkmates',
    fen: '7k/8/5K2/5B2/6N1/8/8/8 w - - 0 1',
    you: 'w',
    goal: { type: 'mate', maxMoves: 45 },
    tip: 'The king sits in h8, a dark corner, but your bishop is light-squared, so it can never mate there. Drive it along the 8th rank toward a8 with the “W manoeuvre”: the knight hops f7–e5–d7–c5–b7 in a W shape while your king and bishop keep the enemy king on the edge. Patience: it takes over 30 moves even with perfect play.',
  },
  {
    id: 'bn-full',
    title: 'Bishop and knight: the full mate',
    group: 'Checkmates',
    fen: '8/8/3k4/8/8/8/8/1N2KB2 w - - 0 1',
    you: 'w',
    goal: { type: 'mate', maxMoves: 50 },
    tip: 'The hardest basic mate (at most 33 moves with best play; the 50-move rule gives you 50). First centralise all three pieces, then push the king to the edge, then into the corner of your bishop’s colour, using the W manoeuvre if it runs to the wrong one.',
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
  {
    id: 'queen-vs-pawn',
    title: 'Queen vs pawn on the 7th',
    group: 'Queen endgames',
    fen: '7K/8/8/8/8/8/3pk3/Q7 w - - 0 1',
    you: 'w',
    goal: { type: 'capture', maxMoves: 35 },
    tip: 'Check, or pin, until the black king has to step in front of its own pawn (on d1). That blocks the pawn for one move: use it to bring your king one step closer. Repeat, and when your king arrives, win the pawn.',
  },
  {
    id: 'queen-vs-c-pawn',
    title: 'Hold the draw: queen vs bishop pawn',
    group: 'Queen endgames',
    fen: '6K1/8/8/8/8/8/1kp5/6Q1 w - - 0 1',
    you: 'b',
    goal: { type: 'draw', surviveMoves: 20 },
    tip: 'A pawn on the c- or f-file (and on the a- or h-file) on the 7th, with its king next to it, draws against a lone queen: when you are driven to the corner, go to a1 instead of blocking the pawn. Taking the pawn then leaves you stalemated, and White’s king is too far away to help.',
  },
];

export const findDrill = (id: string) => DRILLS.find((d) => d.id === id);
