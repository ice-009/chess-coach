// The coach: turns engine evaluations, the engine's lines and the clock data into plain-English
// explanations of *why* moves went wrong (premoves, rushing, time trouble, hanging pieces, tactics…).
import { formatClock, isError, timeSpent } from './analysis';
import type { Classification, GameAnalysis, ParsedGame } from './analysis';
import { formatScore } from './chess';
import { PIECE_NAME, VALUE, lineText, materialBalance, phaseOf, playLine, settledBalance } from './tactics';
import { Chess } from 'chess.js';
import type { PieceSymbol } from 'chess.js';

export type TimeCause = 'premove' | 'rushed' | 'time-trouble' | 'long-think' | 'normal' | 'unknown';
export type TacticKind = 'allowed-mate' | 'hung-piece' | 'allowed-tactic' | 'missed-mate' | 'missed-win' | 'positional';

export interface MoveInsight {
  ply: number; // index of the move
  label: string; // "23. Kf1" / "23… Kf1"
  classification: Classification;
  phase: 'opening' | 'middlegame' | 'endgame';
  spent: number | null;
  clockBefore: number | null;
  timeCause: TimeCause;
  tactic: TacticKind;
  evalBefore: string; // from the mover's point of view
  evalAfter: string;
  bestSan: string | null;
  refutation?: string; // the opponent's punishing line
  bestLine?: string; // what should have been played
  text: string; // full explanation
}

export type ReasonKind = 'fast' | 'time-trouble' | 'hung' | 'outplayed' | 'missed' | 'calculation' | 'opening' | 'positional';

export interface Reason {
  kind: ReasonKind;
  title: string;
  detail: string;
  weight: number;
}

export interface CoachReport {
  color: 'w' | 'b';
  verdict: string;
  reasons: Reason[];
  insights: MoveInsight[]; // the player's mistakes, misses and blunders
  opponentHighlights: { ply: number; label: string; classification: Classification }[];
  tips: { text: string; href: string }[];
  medianSpent: number | null;
}

const moveLabel = (game: ParsedGame, i: number) => `${Math.floor(i / 2) + 1}${i % 2 ? '…' : '.'} ${game.moves[i].san}`;
const povScore = (cp: number, mate: number | null, color: 'w' | 'b') =>
  color === 'w' ? formatScore(mate !== null ? null : cp, mate) : formatScore(mate !== null ? null : -cp, mate === null ? null : -mate);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const pieceList = (ps: PieceSymbol[]) => ps.map((p) => PIECE_NAME[p]).join(' and ');
const secs = (s: number) => (s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`);

function timeCauseFor(spent: number | null, clockBefore: number | null, med: number | null, game: ParsedGame): TimeCause {
  if (spent === null || clockBefore === null || !game.timeControl) return 'unknown';
  const { base } = game.timeControl;
  if (clockBefore < Math.max(0.1 * base, 10)) return 'time-trouble';
  if (spent <= 0.3) return 'premove';
  if (med !== null && spent < Math.min(0.4 * med, 10)) return 'rushed';
  if (med !== null && spent > Math.max(2.5 * med, 0.08 * base)) return 'long-think';
  return 'normal';
}

/** Explains a single move (any side). Used both for the coach report and the per-move speech bubble. */
export function explainMove(game: ParsedGame, analysis: GameAnalysis, i: number, med: number | null = null): MoveInsight {
  const move = game.moves[i];
  const color = move.color;
  const review = analysis.reviews[i];
  const before = analysis.evals[i];
  const after = analysis.evals[i + 1];
  const spentAll = timeSpent(game);
  const spent = spentAll[i];
  const clockBefore = game.clocks && game.timeControl ? (i >= 2 ? game.clocks[i - 2] : game.timeControl.base) : null;
  const timeCause = timeCauseFor(spent, clockBefore, med, game);
  const phase = phaseOf(game.fens[i], i);
  const opp = color === 'w' ? 'b' : 'w';

  // what the opponent can do now
  const reply = playLine(game.fens[i + 1], after.pv ?? [], color, 6);
  const materialBefore = materialBalance(new Chess(game.fens[i]), color);
  const lost = materialBefore - settledBalance(reply, color);
  // what we could have done instead
  const best = playLine(game.fens[i], before.pv ?? [], color, 6);
  const gain = settledBalance(best, color) - best.start;
  const oppMates = after.mate !== null && (opp === 'w' ? after.mate > 0 : after.mate < 0);
  const weHadMate = before.mate !== null && (color === 'w' ? before.mate > 0 : before.mate < 0);

  let tactic: TacticKind = 'positional';
  let tacticText = '';
  const refutation = reply.steps.length ? lineText(game.fens[i + 1], reply.steps, 5) : undefined;
  const bestLine = best.steps.length ? lineText(game.fens[i], best.steps, 5) : undefined;
  const first = reply.steps[0];
  const fork = reply.steps.find((s) => s.color === opp && s.fork.length);

  if (oppMates && !weHadMate) {
    tactic = 'allowed-mate';
    tacticText = `It allows a forced checkmate in ${Math.abs(after.mate ?? 0)}: ${refutation}.`;
  } else if (review.classification === 'miss' && (weHadMate || gain >= 2)) {
    tactic = weHadMate ? 'missed-mate' : 'missed-win';
    tacticText = weHadMate ? `You had a forced mate: ${bestLine}.` : `${review.bestSan} would have won material: ${bestLine}.`;
  } else if (lost >= 2 && first?.captured && VALUE[first.captured] >= 3 && !reply.steps[1]?.captured) {
    tactic = 'hung-piece';
    tacticText = `It leaves your ${PIECE_NAME[first.captured]} on ${first.to} hanging: ${first.san} simply takes it.`;
  } else if (lost >= 2 && fork) {
    tactic = 'allowed-tactic';
    tacticText = `It allows ${fork.san}, a ${PIECE_NAME[fork.piece]} fork of your ${pieceList(fork.fork)}. Line: ${refutation}.`;
  } else if (lost >= 2) {
    tactic = 'allowed-tactic';
    tacticText = `It allows a tactic that wins ${lost >= 5 ? 'a lot of ' : ''}material: ${refutation}.`;
  } else if (weHadMate) {
    tactic = 'missed-mate';
    tacticText = `You missed a forced mate: ${bestLine}.`;
  } else if (gain >= 2) {
    tactic = 'missed-win';
    tacticText = `You missed ${review.bestSan}, which wins material: ${bestLine}.`;
  } else {
    tacticText = review.bestSan ? `No material is lost right away, but ${review.bestSan} kept a much better position${bestLine ? ` (${bestLine})` : ''}.` : '';
  }

  const timeText =
    timeCause === 'premove' ? `You played it in ${secs(spent ?? 0)}. That looks like a premove, in a position that needed a real look.`
    : timeCause === 'rushed' ? `You spent only ${secs(spent ?? 0)} here, much faster than your usual ${secs(med ?? 0)}. This was a critical moment that deserved more time.`
    : timeCause === 'time-trouble' ? `You had only ${formatClock(clockBefore ?? 0)} left on the clock, so time trouble played a part.`
    : timeCause === 'long-think' ? `You thought for ${secs(spent ?? 0)} and still went wrong, which points to a calculation error rather than carelessness.`
    : '';

  const evalBefore = povScore(before.cp, before.mate, color);
  const evalAfter = povScore(after.cp, after.mate, color);
  const label = moveLabel(game, i);
  const text = [`${label} was ${review.classification === 'inaccuracy' ? 'an inaccuracy' : `a ${review.classification}`} (${evalBefore} → ${evalAfter}).`, tacticText, timeText]
    .filter(Boolean)
    .join(' ');

  return { ply: i, label, classification: review.classification, phase, spent, clockBefore, timeCause, tactic, evalBefore, evalAfter, bestSan: review.bestSan, refutation, bestLine, text };
}

const TIPS: Record<ReasonKind, { text: string; href: string }> = {
  fast: { text: 'Before every move in a sharp position, run the blunder check: checks, captures, threats.', href: '#/learn/blunder-check' },
  'time-trouble': { text: 'Budget your clock: play the opening fast and save time for the middlegame.', href: '#/learn/time' },
  hung: { text: 'Before you move, ask: is every one of my pieces still defended after this move?', href: '#/learn/blunder-check' },
  outplayed: { text: 'Train tactics daily, so you spot your opponent\u2019s shots before they happen.', href: '#/learn/forks' },
  missed: { text: 'Look for your own checks and captures first. Your mistakes from this game are now puzzles.', href: '#/train' },
  calculation: { text: 'When you calculate, write the line down in your head move by move and check the final position for enemy checks.', href: '#/learn/blunder-check' },
  opening: { text: 'Drill your opening lines so you reach a good middlegame without spending energy.', href: '#/openings' },
  positional: { text: 'When there are no tactics, find your worst piece and improve it.', href: '#/learn/planning' },
};

/** The full coach report for one player. */
export function coachReport(game: ParsedGame, analysis: GameAnalysis, color: 'w' | 'b', result?: 'win' | 'loss' | 'draw'): CoachReport {
  const spent = timeSpent(game);
  const mine = game.moves.map((_, i) => i).filter((i) => game.moves[i].color === color);
  const med = median(mine.filter((i) => analysis.reviews[i].classification !== 'book').map((i) => spent[i]).filter((s): s is number => s !== null));
  const insights = mine.filter((i) => isError(analysis.reviews[i].classification)).map((i) => explainMove(game, analysis, i, med));
  const opponentHighlights = game.moves
    .map((m, i) => ({ m, i }))
    .filter(({ m, i }) => m.color !== color && (analysis.reviews[i].classification === 'brilliant' || analysis.reviews[i].classification === 'great'))
    .map(({ i }) => ({ ply: i, label: moveLabel(game, i), classification: analysis.reviews[i].classification }));

  const by = (pred: (x: MoveInsight) => boolean) => insights.filter(pred);
  const fast = by((x) => x.timeCause === 'premove' || x.timeCause === 'rushed');
  const trouble = by((x) => x.timeCause === 'time-trouble');
  const longThink = by((x) => x.timeCause === 'long-think');
  const hung = by((x) => x.tactic === 'hung-piece');
  const allowed = by((x) => x.tactic === 'allowed-tactic' || x.tactic === 'allowed-mate');
  const missed = by((x) => x.tactic === 'missed-win' || x.tactic === 'missed-mate');
  const opening = by((x) => x.phase === 'opening');
  const positional = by((x) => x.tactic === 'positional');
  const names = (xs: MoveInsight[]) => xs.map((x) => x.label).join(', ');

  const reasons: Reason[] = [];
  if (fast.length)
    reasons.push({
      kind: 'fast',
      title: 'Moving too fast at critical moments',
      detail: `${fast.length === 1 ? 'One' : fast.length} of your ${insights.length} big mistakes ${fast.length === 1 ? 'was' : 'were'} played almost instantly (${fast.map((x) => `${x.label} in ${secs(x.spent ?? 0)}${x.timeCause === 'premove' ? ', a premove' : ''}`).join('; ')}).`,
      weight: fast.length * 3,
    });
  if (trouble.length) {
    const firstLow = mine.find((i) => game.clocks && game.timeControl && (i >= 2 ? game.clocks[i - 2] : game.timeControl.base) < Math.max(0.1 * game.timeControl.base, 10));
    reasons.push({
      kind: 'time-trouble',
      title: 'Time trouble',
      detail: `Your clock dropped below ${formatClock(Math.max(0.1 * (game.timeControl?.base ?? 0), 10))} around move ${firstLow !== undefined ? Math.floor(firstLow / 2) + 1 : '?'}, and ${trouble.length} of your mistakes came after that (${names(trouble)}).`,
      weight: trouble.length * 3,
    });
  }
  if (hung.length)
    reasons.push({ kind: 'hung', title: 'Hanging pieces', detail: `You left material undefended: ${hung.map((x) => x.label).join(', ')}.`, weight: hung.length * 4 });
  if (allowed.length || opponentHighlights.length)
    reasons.push({
      kind: 'outplayed',
      title: 'Tactically outplayed',
      detail: [
        allowed.length ? `${allowed.length === 1 ? 'One move' : `${allowed.length} moves`} (${names(allowed)}) allowed your opponent a winning tactic.` : '',
        opponentHighlights.length ? `Your opponent found ${opponentHighlights.map((h) => `${h.label} (${h.classification})`).join(', ')}.` : '',
      ]
        .filter(Boolean)
        .join(' '),
      weight: allowed.length * 3 + opponentHighlights.length * 2,
    });
  if (missed.length)
    reasons.push({ kind: 'missed', title: 'Missed chances', detail: `You had a winning shot and didn't play it: ${missed.map((x) => `${x.label} (${x.bestSan} was the move)`).join('; ')}.`, weight: missed.length * 3 });
  if (longThink.length)
    reasons.push({ kind: 'calculation', title: 'Calculation errors', detail: `You thought hard and still went wrong: ${longThink.map((x) => `${x.label} after ${secs(x.spent ?? 0)}`).join(', ')}.`, weight: longThink.length * 2 });
  if (opening.length)
    reasons.push({ kind: 'opening', title: 'Opening trouble', detail: `Mistakes in the first 10 moves: ${names(opening)}.`, weight: opening.length * 2 });
  if (positional.length >= 2)
    reasons.push({ kind: 'positional', title: 'Slow positional slide', detail: `These moves lost ground without dropping material: ${names(positional)}.`, weight: positional.length });
  reasons.sort((a, b) => b.weight - a.weight);

  const PHRASE: Record<ReasonKind, string> = {
    fast: 'moving too fast at critical moments',
    'time-trouble': 'time trouble',
    hung: 'hanging pieces',
    outplayed: 'being tactically outplayed',
    missed: 'missed winning chances',
    calculation: 'calculation errors',
    opening: 'a rough opening',
    positional: 'a slow positional slide',
  };
  const outcome = result === 'win' ? 'You won' : result === 'loss' ? 'You lost' : result === 'draw' ? 'You drew' : 'This game';
  let verdict: string;
  if (!insights.length && !reasons.length) verdict = result === 'loss' ? 'You made no big mistakes. Your opponent simply played more precisely.' : 'Clean game: no mistakes or blunders. Great job!';
  // without mistakes of our own, the only remaining reason is the opponent's strong moves
  else if (!insights.length)
    verdict =
      result === 'loss'
        ? 'You made no big mistakes. Your opponent won with strong tactical shots, so study them below.'
        : 'No big mistakes from you, and your opponent found some strong moves too. A well-played game!';
  else if (result === 'win') verdict = `You won, but ${PHRASE[reasons[0].kind]} could have cost you this one.`;
  else verdict = `${outcome}${result ? '' : ' was decided'} mainly because of ${PHRASE[reasons[0].kind]}${reasons[1] ? ` and ${PHRASE[reasons[1].kind]}` : ''}.`;

  const tips = reasons.slice(0, 3).map((r) => TIPS[r.kind]);
  return { color, verdict, reasons, insights, opponentHighlights, tips, medianSpent: med };
}

/** Compact, factual summary of the game for the AI coach. Only engine-verified facts go in. */
export function coachFacts(
  game: ParsedGame,
  analysis: GameAnalysis,
  report: CoachReport,
  info: { player: string; opponent: string; playerRating?: number; opponentRating?: number; result?: string; opening?: string; timeControl?: string },
) {
  const color = report.color;
  return {
    player: { name: info.player, color: color === 'w' ? 'White' : 'Black', rating: info.playerRating },
    opponent: { name: info.opponent, rating: info.opponentRating },
    result: info.result,
    opening: info.opening,
    timeControl: info.timeControl,
    moves: game.moves.length,
    accuracy: { player: +analysis.accuracy[color].toFixed(1), opponent: +analysis.accuracy[color === 'w' ? 'b' : 'w'].toFixed(1) },
    medianSecondsPerMove: report.medianSpent,
    detectedThemes: report.reasons.map((r) => ({ theme: r.title, detail: r.detail })),
    playerMistakes: report.insights.map((x) => ({
      move: x.label,
      type: x.classification,
      phase: x.phase,
      evalBeforeAfter: `${x.evalBefore} → ${x.evalAfter}`,
      secondsSpent: x.spent,
      clockBefore: x.clockBefore === null ? null : formatClock(x.clockBefore),
      timeVerdict: x.timeCause,
      tacticVerdict: x.tactic,
      opponentBestReply: x.refutation ?? null,
      betterWas: x.bestSan,
      betterLine: x.bestLine ?? null,
    })),
    opponentStrongMoves: report.opponentHighlights.map((h) => `${h.label} (${h.classification})`),
  };
}
