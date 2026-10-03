// Browser side of the AI coach: talks to the local /api/coach endpoint (see server/coachApi.ts).

export class CoachSetupError extends Error {}

export async function coachConfigured(): Promise<boolean | null> {
  try {
    const r = await fetch('/api/coach/status');
    return r.ok ? ((await r.json()) as { configured: boolean }).configured : null;
  } catch {
    return null; // e.g. a static build without the local server
  }
}

/** Streams the coach's Markdown answer, calling onText with the full text so far. */
export async function streamCoach(facts: unknown, onText: (text: string) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch('/api/coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(facts),
    signal,
  });
  if (res.status === 404) throw new CoachSetupError('The AI coach needs the local server. Start the app with npm run dev or npm start.');
  if (!res.ok) {
    const { error } = (await res.json().catch(() => ({ error: '' }))) as { error?: string };
    if (error === 'NO_AUTH') throw new CoachSetupError('NO_AUTH');
    throw new Error(error || `AI coach error (${res.status})`);
  }
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    const marker = text.indexOf('[[coach-error]]');
    if (marker >= 0) throw new Error(text.slice(marker + 15).trim());
    onText(text);
  }
}
