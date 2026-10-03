import { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { ALL_LESSONS, CHAPTERS, findLesson } from '../data/lessons';
import type { Section } from '../data/lessons';
import { parseLine } from '../lib/chess';
import { navigate } from '../lib/router';
import { KEYS, load, save } from '../lib/storage';
import { logActivity } from '../lib/activity';
import { Board } from '../components/Board';
import { Markdown } from '../components/Markdown';
import { MovePuzzle } from '../components/MovePuzzle';

export function sectionFen(s: { fen?: string; setup?: string }): string {
  return s.setup ? parseLine(s.setup).at(-1)!.fenAfter : new Chess(s.fen).fen();
}

export function useLessonsDone() {
  const [done, setDone] = useState<string[]>(() => load(KEYS.lessonsDone, []));
  const mark = (id: string) => {
    logActivity('lesson');
    const next = done.includes(id) ? done : [...done, id];
    save(KEYS.lessonsDone, next);
    setDone(next);
  };
  return { done, mark };
}

function SectionView({ s, id }: { s: Section; id: string }) {
  const fen = useMemo(() => (s.kind === 'text' ? '' : sectionFen(s)), [s]);
  if (s.kind === 'text') return <Markdown md={s.md} />;
  if (s.kind === 'board') {
    const squares = Object.fromEntries((s.squares ?? []).map((sq) => [sq, 'rgba(250,204,21,0.45)']));
    return (
      <figure className="lesson-board">
        <Board id={id} fen={fen} orientation={s.flip ? 'black' : 'white'} arrows={s.arrows} squares={squares} maxWidth={400} />
        <figcaption>{s.caption}</figcaption>
      </figure>
    );
  }
  return (
    <div className="exercise">
      <div className="exercise-tag">Your turn</div>
      <MovePuzzle id={id} fen={fen} solutions={s.solutions} prompt={s.prompt} explain={s.explain} />
    </div>
  );
}

function LessonView({ lessonId }: { lessonId: string }) {
  const found = findLesson(lessonId);
  const { done, mark } = useLessonsDone();
  if (!found) return <div className="error">Lesson not found. <a href="#/learn">Back to the course</a></div>;
  const { chapter, lesson } = found;
  const idx = ALL_LESSONS.findIndex((l) => l.id === lesson.id);
  const next = ALL_LESSONS[idx + 1];

  return (
    <article className="lesson">
      <button onClick={() => navigate('learn')}>← Course</button>
      <div className="eyebrow">{chapter.title}</div>
      <h1>{lesson.title}</h1>
      <div className="muted small">{lesson.minutes} min read{done.includes(lesson.id) ? ' · ✓ completed' : ''}</div>
      {lesson.sections.map((s, i) => (
        <SectionView key={`${lesson.id}-${i}`} s={s} id={`${lesson.id}-${i}`} />
      ))}
      <div className="lesson-footer">
        <button
          className="primary"
          onClick={() => {
            mark(lesson.id);
            navigate(next ? `learn/${next.id}` : 'learn');
          }}
        >
          {next ? `Complete & next: ${next.title} →` : 'Complete the course 🎉'}
        </button>
      </div>
    </article>
  );
}

export function LearnPage({ lessonId }: { lessonId?: string }) {
  const { done } = useLessonsDone();
  if (lessonId) return <LessonView key={lessonId} lessonId={lessonId} />;

  const total = ALL_LESSONS.length;
  const nextLesson = ALL_LESSONS.find((l) => !done.includes(l.id));

  return (
    <div>
      <h1>The course</h1>
      <p className="muted">From "what is chess" to your first FIDE rating. Each lesson is short and ends with a position to solve.</p>
      <div className="progress big"><div style={{ width: `${(done.length / total) * 100}%` }} /></div>
      <div className="muted small">{done.length} of {total} lessons complete</div>
      {nextLesson && (
        <button className="primary" style={{ margin: '14px 0' }} onClick={() => navigate(`learn/${nextLesson.id}`)}>
          {done.length ? 'Continue' : 'Start'}: {nextLesson.title} →
        </button>
      )}
      {CHAPTERS.map((c) => (
        <section key={c.id} className="chapter">
          <h2>{c.title}</h2>
          <p className="muted">{c.goal}</p>
          <div className="lesson-list">
            {c.lessons.map((l) => (
              <button key={l.id} className={`lesson-item ${done.includes(l.id) ? 'done' : ''}`} onClick={() => navigate(`learn/${l.id}`)}>
                <span className="check">{done.includes(l.id) ? '✓' : '○'}</span>
                <span>{l.title}</span>
                <span className="muted small">{l.minutes} min</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
