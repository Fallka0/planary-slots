"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useSyncExternalStore } from "react";

/*
  The machine's voice, synthesised.

  No sound files: every cue is a few oscillators and a burst of noise shaped in
  the Web Audio API, so the whole soundboard is the size of this file and
  plays the moment it's asked to. On by default, like a machine on a floor;
  the speaker in the top bar silences it, and the choice is remembered.

  A browser will not make a sound before the page has been touched, so the
  audio context is only woken by the first cue — which is always the answer
  to a press of the lever.
*/

export type Cue = "spin" | "stop" | "win" | "big" | "tease" | "bonus" | "lock" | "tick" | "up" | "grand" | "click";

const KEY = "planary:slots:sound";

class Board {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  private wake(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
      const length = this.ctx.sampleRate * 0.6;
      this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** One note: an oscillator through an envelope. */
  private tone(type: OscillatorType, from: number, at: number, length: number, level = 1, to?: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, at + length);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(level, at + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(env).connect(this.master!);
    osc.start(at);
    osc.stop(at + length + 0.02);
  }

  /** A burst of filtered noise: the drums turning, the lever's clack. */
  private hiss(at: number, length: number, from: number, to: number, level = 0.6) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(to, at + length);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(level, at + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    src.connect(filter).connect(env).connect(this.master!);
    src.start(at);
    src.stop(at + length + 0.02);
  }

  play(cue: Cue, strength = 1) {
    const ctx = this.wake();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + 0.005;
    const note = (n: number) => 440 * 2 ** ((n - 69) / 12);
    switch (cue) {
      case "click":
        this.tone("square", 1400, t, 0.03, 0.18);
        break;
      case "spin":
        this.hiss(t, 0.42, 400, 2600, 0.5);
        this.tone("triangle", 180, t, 0.2, 0.25, 90);
        break;
      case "stop":
        this.tone("sine", 150, t, 0.11, 0.7, 60);
        this.hiss(t, 0.05, 3000, 1800, 0.25);
        break;
      case "tick":
        this.tone("square", 2200, t, 0.018, 0.12);
        break;
      case "tease":
        this.tone("sine", 260, t, 1.1, 0.35, 880);
        this.tone("sine", 390, t + 0.05, 1.05, 0.18, 1320);
        break;
      case "win": {
        // Two notes, a third apart: a small win is a nod, not a song.
        [76, 79].forEach((n, i) => this.tone("triangle", note(n), t + i * 0.09, 0.22, 0.55));
        break;
      }
      case "big": {
        // An arpeggio that climbs further the bigger the win.
        const steps = [72, 76, 79, 84, 88, 91, 96].slice(0, 3 + Math.min(4, Math.round(strength)));
        steps.forEach((n, i) => this.tone("triangle", note(n), t + i * 0.085, 0.32, 0.5));
        const end = t + steps.length * 0.085;
        [72, 76, 79, 84].forEach((n) => this.tone("sine", note(n), end, 0.9, 0.22));
        break;
      }
      case "bonus": {
        [67, 72, 76, 79].forEach((n, i) => this.tone("square", note(n), t + i * 0.12, 0.16, 0.22));
        [72, 76, 79, 84].forEach((n) => this.tone("triangle", note(n), t + 0.5, 1.1, 0.3));
        this.hiss(t + 0.45, 0.7, 800, 5000, 0.25);
        break;
      }
      case "lock":
        this.tone("sine", 1320, t, 0.45, 0.45);
        this.tone("sine", 1980, t, 0.3, 0.2);
        this.tone("triangle", 660, t, 0.12, 0.3);
        break;
      case "up":
        this.tone("square", 660, t, 0.1, 0.2, 990);
        this.tone("triangle", note(84), t + 0.08, 0.2, 0.35);
        break;
      case "grand": {
        [60, 64, 67, 72, 76, 79, 84, 88, 91, 96].forEach((n, i) => this.tone("triangle", note(n), t + i * 0.07, 0.4, 0.45));
        [72, 76, 79, 84, 88].forEach((n) => this.tone("sine", note(n), t + 0.75, 1.6, 0.2));
        this.hiss(t + 0.7, 1.2, 600, 6000, 0.3);
        break;
      }
    }
  }
}

const SoundContext = createContext<{ on: boolean; toggle: () => void; play: (cue: Cue, strength?: number) => void }>({
  on: true,
  toggle: () => {},
  play: () => {},
});

/** The stored choice, readable without an effect: on unless it was turned off. */
const listeners = new Set<() => void>();
let memory: boolean | null = null;
function readOn(): boolean {
  if (memory !== null) return memory;
  try {
    memory = window.localStorage.getItem(KEY) !== "off";
  } catch {
    // Private mode: sound stays on for this visit.
    memory = true;
  }
  return memory;
}
function writeOn(next: boolean) {
  memory = next;
  try {
    window.localStorage.setItem(KEY, next ? "on" : "off");
  } catch {}
  listeners.forEach((fn) => fn());
}
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const board = useRef<Board | null>(null);
  const on = useSyncExternalStore(subscribe, readOn, () => true);

  const toggle = useCallback(() => {
    const next = !readOn();
    writeOn(next);
    if (next) {
      board.current ??= new Board();
      board.current.play("click");
    }
  }, []);

  const play = useCallback((cue: Cue, strength?: number) => {
    if (!readOn()) return;
    board.current ??= new Board();
    board.current.play(cue, strength);
  }, []);

  const value = useMemo(() => ({ on, toggle, play }), [on, toggle, play]);
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export const useSound = () => useContext(SoundContext);
