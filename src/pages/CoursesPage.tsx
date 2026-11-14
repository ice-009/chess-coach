import { useMemo, useState } from 'react';
import { COURSES, courseProgress, findCourse, markStep, progressSnapshot, stepKey, stepProgress, stepView } from '../lib/courses';
import type { Course } from '../lib/courses';
import { navigate } from '../lib/router';

function Ring({ pct, size = 64 }: { pct: number; size?: number }) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  return (
    <svg className="course-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${pct}% complete`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--tone)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle">{pct}%</text>
    </svg>
  );
}

function CourseList() {
  const snap = useMemo(() => progressSnapshot(), []);
  const started = COURSES.filter((c) => {
    const p = courseProgress(c, snap);
    return p.done > 0 && p.done < p.total;
  });
  return (
    <div>
      <div className="page-head">
        <h1>Courses</h1>
        <p className="muted">Step-by-step paths through the lessons, puzzles, drills, openings and bots. Every step ticks itself off as you train.</p>
      </div>
      {started.length > 0 && (
        <section className="chapter">
          <div className="section-title">Continue where you left off</div>
          <div className="continue-row">
            {started.map((c) => {
              const p = courseProgress(c, snap);
              const next = p.next ? stepView(p.next, snap) : null;
              return (
                <a key={c.id} className={`continue-card tone-${c.tone}`} href={next?.href ?? `#/courses/${c.id}`}>
                  <Ring pct={p.pct} size={56} />
                  <span>
                    <b>{c.title}</b>
                    {next && <span className="muted small">Next: {next.title}</span>}
                  </span>
                  <span className="teaser-more">Go →</span>
                </a>
              );
            })}
          </div>
        </section>
      )}
      {(['Beginner', 'Intermediate', 'Advanced'] as const).map((level) => (
        <section key={level} className="chapter">
          <div className="section-title">{level}</div>
          <div className="course-grid">
            {COURSES.filter((c) => c.level === level).map((c) => {
              const p = courseProgress(c, snap);
              return (
                <a key={c.id} className={`course-card tone-${c.tone}`} href={`#/courses/${c.id}`}>
                  <span className="course-art" aria-hidden="true">{c.icon}</span>
                  <span className="course-body">
                    <span className="row course-tags">
                      <span className="course-level">{c.level}</span>
                      <span className="muted small">{c.rating}</span>
                    </span>
                    <b className="course-title">{c.title}</b>
                    <span className="course-tagline">{c.tagline}</span>
                    <span className="course-foot">
                      <span className="course-bar"><span style={{ width: `${p.pct}%` }} /></span>
                      <span className="small muted nowrap">{p.done}/{p.total} steps</span>
                    </span>
                  </span>
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function CourseView({ course }: { course: Course }) {
  const [snap, setSnap] = useState(progressSnapshot);
  const p = courseProgress(course, snap);
  const next = p.next ? stepView(p.next, snap) : null;
  let n = 0;
  return (
    <div className={`course tone-${course.tone}`}>
      <button className="btn-ghost" onClick={() => navigate('courses')}>← All courses</button>
      <header className="course-hero">
        <span className="course-art big" aria-hidden="true">{course.icon}</span>
        <div className="course-hero-main">
          <div className="row course-tags">
            <span className="course-level">{course.level}</span>
            <span className="muted small">For {course.rating}</span>
          </div>
          <h1>{course.title}</h1>
          <p>{course.tagline}</p>
          {next ? (
            <a className="btn-green course-cta" href={next.href}>{p.done ? 'Continue' : 'Start'}: {next.title} →</a>
          ) : (
            <div className="note">🎓 Course complete. Well done!</div>
          )}
        </div>
        <Ring pct={p.pct} size={96} />
      </header>
      <ol className="course-path">
        {course.chapters.map((ch, ci) => (
          <li key={ci} className="course-chapter">
            <div className="chapter-head"><span className="chapter-no">{ci + 1}</span><h2>{ch.title}</h2></div>
            <ul className="steps">
              {ch.steps.map((s) => {
                const v = stepView(s, snap);
                const prog = stepProgress(s, snap);
                const done = prog >= 1;
                const isNext = p.next && stepKey(p.next) === stepKey(s);
                n++;
                return (
                  <li key={stepKey(s)} className={`step ${done ? 'done' : ''} ${isNext ? 'next' : ''}`}>
                    <a href={v.href} className="step-link">
                      <span className="step-icon">{done ? '✓' : v.icon}</span>
                      <span className="step-main">
                        <b>{n}. {v.title}</b>
                        <span className="muted small">{v.sub}</span>
                        {prog > 0 && prog < 1 && <span className="course-bar thin"><span style={{ width: `${prog * 100}%` }} /></span>}
                      </span>
                      {isNext && <span className="step-next">Next</span>}
                    </a>
                    {(!done || snap.manual[stepKey(s)]) && <button
                      className="step-mark"
                      title={done ? 'Mark as not done' : 'Mark as done'}
                      aria-label={done ? 'Mark as not done' : 'Mark as done'}
                      onClick={() => {
                        markStep(s, !done);
                        setSnap(progressSnapshot()); // re-read after marking a step
                      }}
                    >
                      {done ? '↺' : '✓'}
                    </button>}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function CoursesPage({ courseId }: { courseId?: string }) {
  const course = courseId ? findCourse(courseId) : undefined;
  if (courseId && !course) return <div className="error">Course not found.</div>;
  return course ? <CourseView course={course} /> : <CourseList />;
}
