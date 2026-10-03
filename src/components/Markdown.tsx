import type { ReactNode } from 'react';

type Block = { type: 'h' | 'p'; text: string } | { type: 'ul' | 'ol'; items: string[] };

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((part, i) =>
    part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong>
    : part.startsWith('*') && part.length > 2 ? <em key={i}>{part.slice(1, -1)}</em>
    : part,
  );
}

function parse(md: string): Block[] {
  const out: Block[] = [];
  let prevBlank = true;
  for (const raw of md.trim().split('\n')) {
    const l = raw.trim();
    const last = out[out.length - 1];
    if (!l) { prevBlank = true; continue; }
    if (l.startsWith('### ')) out.push({ type: 'h', text: l.slice(4) });
    else if (/^(- |\d+\. )/.test(l)) {
      const type = l.startsWith('- ') ? 'ul' : 'ol';
      const text = l.replace(/^(- |\d+\. )/, '');
      if (last && last.type === type) last.items.push(text);
      else out.push({ type, items: [text] });
    } else if (last && last.type === 'p' && !prevBlank) last.text += ' ' + l;
    else out.push({ type: 'p', text: l });
    prevBlank = false;
  }
  return out;
}

/** Renders the markdown subset used in lessons: ### headings, - bullets, 1. lists, **bold**, *italic*. */
export function Markdown({ md }: { md: string }) {
  return (
    <div className="md">
      {parse(md).map((b, i) =>
        b.type === 'h' ? <h3 key={i}>{inline(b.text)}</h3>
        : b.type === 'p' ? <p key={i}>{inline(b.text)}</p>
        : b.type === 'ul' ? <ul key={i}>{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>
        : b.type === 'ol' ? <ol key={i}>{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>
        : null,
      )}
    </div>
  );
}
