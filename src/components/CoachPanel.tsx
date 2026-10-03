import { useEffect, useRef, useState } from 'react';
import type { CoachReport, ReasonKind } from '../lib/coach';
import { CoachSetupError, coachConfigured, streamCoach } from '../lib/aiCoach';
import { formatClock } from '../lib/analysis';
import { THEME_LABEL } from '../lib/moveReasons';
import { STATIC_HOST } from '../lib/host';
import { ClassIcon } from './icons';
import { Markdown } from './Markdown';

const REASON_ICON: Record<ReasonKind, string> = {
  fast: '⚡',
  'time-trouble': '⏱',
  hung: '🎯',
  outplayed: '⚔️',
  missed: '🔍',
  calculation: '🧮',
  opening: '📖',
  positional: '♟',
};

const TIME_BADGE: Record<string, { label: string; cls: string }> = {
  premove: { label: 'Premove', cls: 'bad' },
  rushed: { label: 'Rushed', cls: 'bad' },
  'time-trouble': { label: 'Time trouble', cls: 'warn' },
  'long-think': { label: 'Long think', cls: 'info' },
};

interface Props {
  report: CoachReport;
  buildFacts: () => unknown;
  onJump: (ply: number) => void;
  onPractice?: (ply: number) => void;
}

function AiCoach({ buildFacts }: { buildFacts: () => unknown }) {
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'setup' | 'error'>('idle');
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!STATIC_HOST) coachConfigured().then(setConfigured);
    return () => ctrl.current?.abort();
  }, []);

  async function run() {
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    setText('');
    setError('');
    setState('loading');
    try {
      await streamCoach(buildFacts(), setText, ctrl.current.signal);
      setState('done');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      if (e instanceof CoachSetupError) {
        setState('setup');
        if (e.message !== 'NO_AUTH') setError(e.message);
      } else {
        setState('error');
        setError((e as Error).message);
      }
    }
  }

  return (
    <div className="ai-coach">
      <div className="ai-head">
        <span className="ai-badge">AI</span>
        <div>
          <b>Claude's coaching review</b>
          <div className="muted small">A written explanation of this game, built from the engine facts above.</div>
        </div>
      </div>
      {STATIC_HOST && (
        <p className="muted small">
          The AI review runs in the app on your computer, with your own Anthropic API key (it is not offered on this public site, where anyone
          could use the key). The coach above works everywhere.
        </p>
      )}
      {!STATIC_HOST && state === 'idle' && (
        <>
          <button className="btn-green wide" onClick={run}>Explain my game</button>
          {configured === false && <div className="muted small">Needs an Anthropic API key. Clicking will show how to add one.</div>}
        </>
      )}
      {state === 'loading' && !text && (
        <div className="analyzing">
          <span className="spinner" />
          <div className="muted">Claude is reviewing your game…</div>
        </div>
      )}
      {text && <div className="ai-text"><Markdown md={text} /></div>}
      {state === 'loading' && text && <span className="spinner tiny" />}
      {state === 'done' && <button className="btn-secondary wide" onClick={run}>Regenerate</button>}
      {state === 'setup' && (
        <div className="setup">
          {error ? (
            <p>{error}</p>
          ) : (
            <>
              <p><b>One-time setup:</b> the AI coach uses Claude through your own Anthropic API key.</p>
              <ol>
                <li>Create a key at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a>.</li>
                <li>In the project folder, copy <code>.env.example</code> to <code>.env.local</code> and paste the key after <code>ANTHROPIC_API_KEY=</code>.</li>
                <li>Restart the app (<code>npm run dev</code>) and click the button again.</li>
              </ol>
              <p className="muted small">The key stays on your computer: only the local server uses it, never the web page.</p>
            </>
          )}
          <button className="btn-secondary" onClick={run}>Try again</button>
        </div>
      )}
      {state === 'error' && (
        <div className="setup">
          <p className="error">{error}</p>
          <button className="btn-secondary" onClick={run}>Try again</button>
        </div>
      )}
    </div>
  );
}

export function CoachPanel({ report, buildFacts, onJump, onPractice }: Props) {
  return (
    <div className="coach-panel">
      <div className="coach">
        <span className="coach-avatar">♞</span>
        <div className="coach-bubble verdict">{report.verdict}</div>
      </div>

      {report.reasons.length > 0 && (
        <section>
          <div className="section-title">What decided the game</div>
          <div className="reasons">
            {report.reasons.map((r) => (
              <div key={r.kind} className={`reason ${r.kind}`}>
                <span className="reason-icon">{REASON_ICON[r.kind]}</span>
                <div>
                  <b>{r.title}</b>
                  <div className="reason-detail">{r.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {report.insights.length > 0 && (
        <section>
          <div className="section-title">Your mistakes, explained</div>
          {report.insights.map((x) => (
            <div key={x.ply} className="insight">
              <div className="insight-head">
                <ClassIcon c={x.classification} size={20} />
                <b>{x.label}</b>
                {TIME_BADGE[x.timeCause] && <span className={`time-badge ${TIME_BADGE[x.timeCause].cls}`}>{TIME_BADGE[x.timeCause].label}</span>}
                {x.spent !== null && <span className="muted small">⏱ {x.spent < 10 ? x.spent.toFixed(1) : Math.round(x.spent)}s{x.clockBefore !== null ? ` · ${formatClock(x.clockBefore)} left` : ''}</span>}
              </div>
              <p>{x.text}</p>
              {x.bestSan && x.bestWhy.length > 0 && (
                <div className="insight-why">
                  <b>Why {x.bestSan} is better:</b>
                  <ul>
                    {x.bestWhy.map((r) => (
                      <li key={r.theme}>
                        {r.text} {r.lesson && <a className="learn" href={`#/learn/${r.lesson}`}>{THEME_LABEL[r.theme]} →</a>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="insight-actions">
                <button className="chip" onClick={() => onJump(x.ply)}>Find the better move</button>
                <button className="chip" onClick={() => onJump(x.ply + 1)}>See what happened</button>
                {onPractice && <button className="chip" onClick={() => onPractice(x.ply)}>Practise from here</button>}
              </div>
            </div>
          ))}
        </section>
      )}

      {report.tips.length > 0 && (
        <section>
          <div className="section-title">What to work on</div>
          <ul className="tips">
            {report.tips.map((t) => (
              <li key={t.text}>
                {t.text} <a href={t.href}>Open →</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AiCoach buildFacts={buildFacts} />
    </div>
  );
}
