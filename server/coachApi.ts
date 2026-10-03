// Local API for the AI coach. Runs inside the Vite dev/preview server (Node), so the Anthropic
// credentials stay on your machine and never reach the browser.
import Anthropic from '@anthropic-ai/sdk';
import type { Connect, Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

const SYSTEM = `You are a warm but direct chess coach for an improving club player who wants to earn a FIDE rating.

You receive engine-verified data about one of the player's games: each of their mistakes with the evaluation before and after (from the player's point of view, in pawns), the opponent's best reply, the better move, the seconds spent on the move and the clock, plus themes an analysis program already detected (premoves, rushing, time trouble, hanging pieces, missed tactics, being tactically outplayed).

Write a short coaching review in Markdown with exactly these sections:
### Why this game went this way
2-4 sentences naming the main cause. Be concrete: premoved or rushed critical moves, time trouble, a tactical oversight, getting outplayed tactically, or a strategic drift.
### Key moments
For each of the player's mistakes, most costly first (at most 4): the move in bold, what went wrong in plain words, and the thinking habit that would have prevented it.
### Train this week
Three concrete, specific actions.

Rules:
- Use only moves, lines and evaluations that appear in the data. Never invent variations or claim moves that are not listed. If the data doesn't explain something, say so briefly.
- Talk to the player as "you". Encouraging, never harsh.
- Under 350 words. No preamble before the first heading.`;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 200_000) reject(new Error('request too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export function coachApi(env: Record<string, string>): Plugin {
  const apiKey = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  const configured = !!(apiKey || process.env.ANTHROPIC_AUTH_TOKEN);
  let client: Anthropic | null = null;

  const handler: Connect.NextHandleFunction = async (req, res, next) => {
    if (req.url === '/api/coach/status' && req.method === 'GET') return sendJson(res, 200, { configured });
    if (req.url !== '/api/coach' || req.method !== 'POST') return next();

    let facts: unknown;
    try {
      facts = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid game data.' });
    }
    try {
      client ??= apiKey ? new Anthropic({ apiKey }) : new Anthropic();
    } catch {
      return sendJson(res, 401, { error: 'NO_AUTH' });
    }

    const stream = client.beta.messages.stream({
      model: 'claude-opus-5-5',
      max_tokens: 64000,
      output_config: { effort: 'medium' },
      // if a safety classifier declines, retry server-side on Anthropic's recommended fallback model
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: `Here is the data for my game:\n\n${JSON.stringify(facts, null, 2)}` }],
    });
    res.on('close', () => {
      if (!res.writableEnded) stream.abort(); // the user navigated away
    });

    try {
      let started = false;
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          if (!started) {
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' });
            started = true;
          }
          res.write(event.delta.text);
        }
      }
      const final = await stream.finalMessage();
      if (!started) res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      if (final.stop_reason === 'refusal') res.write('\n\n_The AI coach could not review this game. The instant coach above still applies._');
      res.end();
    } catch (err) {
      if (res.writableEnded) return;
      const message =
        err instanceof Anthropic.AuthenticationError ? 'NO_AUTH'
        // a client-side SDK error (no request was sent): in practice, no credentials configured
        : err instanceof Anthropic.AnthropicError && !(err instanceof Anthropic.APIError) ? 'NO_AUTH'
        : err instanceof Anthropic.PermissionDeniedError ? 'Your API key does not have access to this model.'
        : err instanceof Anthropic.RateLimitError ? 'Rate limited by the Claude API. Wait a minute and try again.'
        : err instanceof Anthropic.APIConnectionError ? 'Could not reach the Claude API. Check your internet connection.'
        : err instanceof Anthropic.APIError ? `Claude API error (${err.status}).`
        : 'The AI coach failed unexpectedly.';
      if (message !== 'NO_AUTH') console.error('[coach]', err);
      if (!res.headersSent) sendJson(res, message === 'NO_AUTH' ? 401 : 502, { error: message });
      else res.end(`\n\n[[coach-error]] ${message}`);
    }
  };

  return {
    name: 'chess-coach-api',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}
