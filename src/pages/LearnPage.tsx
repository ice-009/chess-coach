import { useMemo, useState } from 'react';
import { ALL_LESSONS, CHAPTERS, findLesson } from '../data/lessons';
import type { Section } from '../data/lessons';
import { navigate } from '../lib/router';
import { KEYS, load, save } from '../lib/storage';
import { logActivity } from '../lib/activity';
import { Board } from '../components/Board';
import { Markdown } from '../components/Markdown';
import { sectionFen } from '../lib/chess';
import { AGAIN, GOOD, HARD, addCard } from '../lib/deck';
import { MovePuzzle } from '../components/MovePuzzle';

export { sectionFen };

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
      <MovePuzzle
        id={id}
        fen={fen}
        solutions={s.solutions}
        prompt={s.prompt}
        explain={s.explain}
        onDone={(firstTry, revealed) => {
          // the exercise joins your review deck: it comes back before you'd forget it
          const cut = id.lastIndexOf('-');
          const lessonId = id.slice(0, cut);
          addCard({ kind: 'lesson', ref: `${lessonId}#${id.slice(cut + 1)}`, title: findLesson(lessonId)?.lesson.title ?? 'Lesson exercise' }, revealed ? AGAIN : firstTry ? GOOD : HARD);
        }}
      />
    </div>
  );
}

type Item = { s: Section; i: number };
/** A block of reading with the boards that illustrate it, or an exercise on its own. */
type Group = { kind: 'row'; text: Item[]; boards: Item[] } | { kind: 'exercise'; item: Item };

function groupSections(sections: Section[]): Group[] {
  const out: Group[] = [];
  let row: Extract<Group, { kind: 'row' }> | null = null;
  sections.forEach((s, i) => {
    if (s.kind === 'exercise') {
      out.push({ kind: 'exercise', item: { s, i } });
      row = null;
    } else if (s.kind === 'text') {
      if (!row || row.boards.length) out.push((row = { kind: 'row', text: [], boards: [] })); // text after a board starts a new block
      row.text.push({ s, i });
    } else {
      if (!row) out.push((row = { kind: 'row', text: [], boards: [] }));
      row.boards.push({ s, i });
    }
  });
  return out;
}

/** Wide screens: one or two boards sit beside their text; more boards form a grid under it. */
function LessonGroup({ g, lessonId }: { g: Group; lessonId: string }) {
  if (g.kind === 'exercise') return <SectionView s={g.item.s} id={`${lessonId}-${g.item.i}`} />;
  const split = g.text.length > 0 && g.boards.length > 0 && g.boards.length <= 2;
  return (
    <div className={`lesson-row ${split ? 'split' : ''}`}>
      {g.text.length > 0 && (
        <div className="lesson-text">
          {g.text.map(({ s, i }) => <SectionView key={i} s={s} id={`${lessonId}-${i}`} />)}
        </div>
      )}
      {g.boards.length > 0 && (
        <div className={split ? 'lesson-media' : 'lesson-gallery'}>
          {g.boards.map(({ s, i }) => <SectionView key={i} s={s} id={`${lessonId}-${i}`} />)}
        </div>
      )}
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
      {groupSections(lesson.sections).map((g, k) => (
        <LessonGroup key={`${lesson.id}-${k}`} g={g} lessonId={lesson.id} />
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
