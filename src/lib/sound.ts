// Board sounds, synthesised with Web Audio (no recordings): a wooden "tock" for moves, a sharper "clack" for
// captures, two tocks for castling, a bright ping with a check, a rising chime for promotion, and short tones
// for right / wrong answers and the end of a game. Safari only plays audio after a tap, so the first tap or
// key press anywhere unlocks it.
import { useSyncExternalStore } from 'react';

export type SoundKind = 'move' | 'capture' | 'castle' | 'check' | 'promote' | 'end' | 'correct' | 'wrong' | 'illegal';

const KEY = 'cca-sound'; // "off" turns sounds off on this device
let enabled = (() => {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
})();
const subs = new Set<() => void>();
export const soundOn = () => enabled;
export function setSoundOn(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // storage blocked: the setting lasts until the page reloads
  }
  subs.forEach((f) => f());
}
export const useSoundOn = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => enabled,
  );

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
function audio(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.25), ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

// unlock audio on the first interaction (iOS keeps an AudioContext suspended until then)
if (typeof window !== 'undefined') {
  const unlock = () => {
    const c = audio();
    if (c && c.state !== 'running') c.resume().catch(() => undefined);
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

/** A short knock: filtered noise for the click plus a low sine for the body of the wood. */
function knock(c: AudioContext, at: number, { pitch = 1700, body = 170, gain = 0.7, length = 0.07 } = {}) {
  const src = c.createBufferSource();
  src.buffer = noise;
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = pitch;
  band.Q.value = 1.4;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + length * 0.6);
  src.connect(band).connect(g).connect(c.destination);
  src.start(at);
  src.stop(at + length);

  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(body, at);
  osc.frequency.exponentialRampToValueAtTime(body * 0.6, at + length);
  const og = c.createGain();
  og.gain.setValueAtTime(gain * 0.9, at);
  og.gain.exponentialRampToValueAtTime(0.001, at + length);
  osc.connect(og).connect(c.destination);
  osc.start(at);
  osc.stop(at + length);
}

function tone(c: AudioContext, at: number, freq: number, length: number, gain = 0.18, type: OscillatorType = 'sine') {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(g).connect(c.destination);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

/** Plays a board sound (if sounds are on). The last one is noted on <html data-last-sound> for tests. */
export function playSound(kind: SoundKind) {
  document.documentElement.dataset.lastSound = kind;
  document.documentElement.dataset.soundCount = String(Number(document.documentElement.dataset.soundCount ?? 0) + 1);
  if (!enabled) return;
  const c = audio();
  if (!c || c.state !== 'running') return;
  const t = c.currentTime + 0.005;
  switch (kind) {
    case 'move':
      return knock(c, t);
    case 'capture':
      knock(c, t, { pitch: 1250, body: 140, gain: 0.95, length: 0.09 });
      return knock(c, t + 0.028, { pitch: 2600, body: 220, gain: 0.45, length: 0.05 });
    case 'castle':
      knock(c, t);
      return knock(c, t + 0.11, { pitch: 1900, gain: 0.6 });
    case 'check':
      knock(c, t);
      tone(c, t + 0.03, 1318, 0.16, 0.12);
      return tone(c, t + 0.03, 1975, 0.12, 0.05);
    case 'promote':
      knock(c, t);
      tone(c, t + 0.05, 784, 0.12, 0.12);
      return tone(c, t + 0.13, 1175, 0.2, 0.12);
    case 'end':
      tone(c, t, 523, 0.5, 0.12);
      tone(c, t, 659, 0.5, 0.1);
      return tone(c, t + 0.18, 784, 0.6, 0.12);
    case 'correct':
      tone(c, t, 880, 0.12, 0.14);
      return tone(c, t + 0.09, 1320, 0.22, 0.14);
    case 'wrong':
      return tone(c, t, 196, 0.22, 0.12, 'triangle');
    case 'illegal':
      return tone(c, t, 150, 0.12, 0.08, 'triangle');
  }
}
