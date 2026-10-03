export interface ChessComPlayer {
  username: string;
  rating: number;
  result: string;
}

export interface ChessComGame {
  url: string;
  pgn: string;
  time_control: string;
  time_class: 'bullet' | 'blitz' | 'rapid' | 'daily';
  end_time: number;
  rated: boolean;
  rules: string;
  white: ChessComPlayer;
  black: ChessComPlayer;
}

const BASE = 'https://api.chess.com/pub/player';
const DRAWS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']);

export async function getArchives(username: string): Promise<string[]> {
  const res = await fetch(`${BASE}/${encodeURIComponent(username.toLowerCase())}/games/archives`);
  if (res.status === 404) throw new Error('User not found on chess.com');
  if (!res.ok) throw new Error(`chess.com API error (${res.status})`);
  const data = await res.json();
  return [...(data.archives as string[])].reverse(); // newest month first
}

export async function getGames(archiveUrl: string): Promise<ChessComGame[]> {
  const res = await fetch(archiveUrl);
  if (!res.ok) throw new Error(`chess.com API error (${res.status})`);
  const data = await res.json();
  return (data.games as ChessComGame[])
    .filter((g) => g.rules === 'chess' && g.pgn)
    .reverse(); // newest game first
}

export interface Profile {
  username: string;
  name?: string;
  title?: string;
  avatar?: string;
  country?: string;
  ratings: { label: string; rating: number }[];
}

export async function getProfile(username: string): Promise<Profile> {
  const u = encodeURIComponent(username.toLowerCase());
  type RawProfile = { username?: string; name?: string; title?: string; avatar?: string; country?: string };
  type RawStats = Partial<Record<'chess_rapid' | 'chess_blitz' | 'chess_bullet' | 'chess_daily', { last?: { rating: number } }>>;
  const [p, s]: [RawProfile, RawStats] = await Promise.all([
    fetch(`${BASE}/${u}`).then((r) => (r.ok ? r.json() : {})),
    fetch(`${BASE}/${u}/stats`).then((r) => (r.ok ? r.json() : {})),
  ]);
  const ratings = (
    [
      ['Rapid', s.chess_rapid],
      ['Blitz', s.chess_blitz],
      ['Bullet', s.chess_bullet],
      ['Daily', s.chess_daily],
    ] as const
  ).flatMap(([label, v]) => (v?.last?.rating ? [{ label, rating: v.last.rating }] : []));
  return {
    username: p.username ?? username,
    name: p.name,
    title: p.title,
    avatar: p.avatar,
    country: typeof p.country === 'string' ? p.country.split('/').pop() : undefined,
    ratings,
  };
}

export function summarize(game: ChessComGame, user: string) {
  const isWhite = game.white.username.toLowerCase() === user.toLowerCase();
  const me = isWhite ? game.white : game.black;
  const opp = isWhite ? game.black : game.white;
  const outcome: 'win' | 'loss' | 'draw' =
    me.result === 'win' ? 'win' : DRAWS.has(me.result) ? 'draw' : 'loss';
  const eco = game.pgn.match(/\[ECOUrl "[^"]*\/openings\/([^"]+)"\]/);
  const opening = eco ? decodeURIComponent(eco[1]).replace(/-/g, ' ') : '—';
  return {
    game,
    color: (isWhite ? 'white' : 'black') as 'white' | 'black',
    me,
    opp,
    outcome,
    opening,
    moves: Number([...game.pgn.matchAll(/\s(\d+)\.\s/g)].pop()?.[1] ?? 0),
    date: new Date(game.end_time * 1000),
  };
}
