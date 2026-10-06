"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LineWin, Machine, Pip as PipId } from "../../shared/slots";
import { windowAt } from "../../shared/slots";
import { Pip } from "./Pip";

/*
  The drums.

  Nothing here decides anything. The round was resolved in the machine room
  before the first frame, and this component's only job is to not give the
  answer away early: the drums turn, then come to rest on symbols that were
  already fixed. The animation is openly theatre and the panel beside it says
  so.

  The one piece of drama that looks like suspense — the last drums turning
  longer — only ever plays when the drums that have already stopped show
  enough of a bonus symbol for the round still to start the bonus. It is not
  a near miss dressed up: the result is already known, and the slow drums are
  simply the honest moment before the one that decides it.
*/

/** How long the drums turn once the answer is in, and the stagger between them. */
const LAND_MS = 760;
const STAGGER_MS = 130;
const TURBO_LAND_MS = 280;
const TURBO_STAGGER_MS = 45;
/** Extra time on each drum from the teasing one on. */
const TEASE_MS = 900;
/** Cells of blur above the result: enough that the eye cannot follow a symbol. */
const RUN_UP = 18;

type Stage = "rest" | "roll" | "land";

function randomPips(reel: PipId[], count: number): PipId[] {
  // Drawn from the reel's own strip, so the blur is made of the right symbols
  // in the right proportions — a drum nobody can read is still that drum.
  return Array.from({ length: count }, () => reel[Math.floor(Math.random() * reel.length)]);
}

/** When each drum comes to rest, from the moment the answer arrives. */
export function landingTimes(reels: number, turbo: boolean, tease: number | null): number[] {
  const land = turbo ? TURBO_LAND_MS : LAND_MS;
  const stagger = turbo ? TURBO_STAGGER_MS : STAGGER_MS;
  return Array.from({ length: reels }, (_, i) => {
    const teased = tease !== null && i >= tease ? (i - tease + 1) * TEASE_MS : 0;
    return land + i * stagger + teased;
  });
}

export function Reels({
  cabinet,
  spinKey,
  target,
  rolling,
  turbo,
  tease = null,
  lines = [],
  lit,
  expanded = [],
  coins,
  onReelStop,
  onSettled,
}: {
  cabinet: Machine;
  /** Changes with every spin the drums should land: a nonce, or a free spin's index. */
  spinKey: string | null;
  /** Where the drums come to rest for `spinKey`. Null while the answer is not in. */
  target: PipId[][] | null;
  /** True from the moment the lever is pulled until the answer comes back. */
  rolling: boolean;
  turbo: boolean;
  /** The first drum to turn longer, because the bonus could still start. */
  tease?: number | null;
  /** The lines that paid, drawn once the drums are still. */
  lines?: LineWin[];
  /** Cells to light once the drums are still, as "reel-row". */
  lit?: Set<string>;
  /** Reels a wild has filled. */
  expanded?: number[];
  /** Coin values to print on cells, by "reel-row". */
  coins?: Map<string, number>;
  onReelStop?: (reel: number) => void;
  onSettled?: () => void;
}) {
  const [stage, setStage] = useState<Stage>("rest");
  const [landed, setLanded] = useState<{ key: string; window: PipId[][] } | null>(null);
  const [moving, setMoving] = useState(false);
  const [stopped, setStopped] = useState(0);
  const [reduced, setReduced] = useState(false);
  const settledFor = useRef<string | null>(null);
  // Held in refs so a parent re-rendering mid-landing does not restart it.
  const onStop = useRef(onReelStop);
  const onDone = useRef(onSettled);
  useEffect(() => {
    onStop.current = onReelStop;
    onDone.current = onSettled;
  });

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // The lever has been pulled: start turning.
  //
  // The last result stays on the drums until a new one lands, because a spin
  // can be refused — not enough chips, or the machine asking for a moment —
  // and when it is, nothing further ever arrives. Without the second branch
  // here the drums would turn forever on a spin that never happened, which is
  // the worst thing a machine can do: it looks exactly like one deciding.
  useEffect(() => {
    if (rolling) {
      setMoving(false);
      setStopped(0);
      setStage(reduced ? "rest" : "roll");
      return;
    }
    if (!target) setStage("rest");
  }, [rolling, reduced, target]);

  // The answer is in. Reduced motion skips straight to it.
  useEffect(() => {
    if (!target || !spinKey || settledFor.current === spinKey) return;
    const finish = () => {
      if (settledFor.current === spinKey) return;
      settledFor.current = spinKey;
      setStage("rest");
      setLanded({ key: spinKey, window: target });
      onDone.current?.();
    };
    if (reduced) {
      onStop.current?.(cabinet.reels.length - 1);
      finish();
      return;
    }
    setStage("land");
    setMoving(false);
    setStopped(0);
    const times = landingTimes(cabinet.reels.length, turbo, tease);
    // One frame on the starting transform, so the transition has somewhere to
    // come from; without this the browser coalesces both and nothing moves.
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setMoving(true)));
    const stops = times.map((ms, reel) =>
      window.setTimeout(() => {
        setStopped(reel + 1);
        onStop.current?.(reel);
      }, ms + 30),
    );
    const done = window.setTimeout(finish, Math.max(...times) + 90);
    return () => {
      cancelAnimationFrame(frame);
      stops.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(done);
    };
  }, [target, spinKey, reduced, turbo, tease, cabinet.reels.length]);

  /**
   * What is on the drums at rest: the last result, or — before the first spin —
   * a fixed spread across the strips. Fixed rather than random, so the server
   * and the browser draw the same machine; spread rather than stop zero, so a
   * machine nobody has touched does not look like five identical reels.
   */
  const resting = useMemo(
    () => (landed ? landed.window : windowAt(cabinet, cabinet.reels.map((reel, i) => (i * 7 + 2) % reel.length))),
    [landed, cabinet],
  );

  /** The blur, rebuilt for each spin so two spins never look identical. */
  const blur = useMemo(
    () => cabinet.reels.map((reel) => randomPips(reel, RUN_UP)),
    // A new key is a new spin; the strips never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cabinet, spinKey, rolling],
  );

  const times = useMemo(() => landingTimes(cabinet.reels.length, turbo, tease), [cabinet.reels.length, turbo, tease]);
  const reels = cabinet.reels.length;
  const rows = cabinet.rows;
  const atRest = stage === "rest" && landed !== null && landed.key === spinKey;
  const wilds = new Set(atRest ? expanded : []);

  return (
    <div
      className="reels"
      data-stage={stage}
      data-reels={reels}
      data-turbo={turbo || undefined}
      style={{ "--reels": reels, "--rows": rows } as React.CSSProperties}
      role="img"
      aria-label={
        atRest && landed
          ? landed.window.map((reel, i) => `Reel ${i + 1}: ${reel.join(", ")}`).join(". ")
          : stage === "rest"
            ? "The reels, at rest"
            : "The reels are turning"
      }
    >
      {cabinet.reels.map((reel, index) => {
        const cells =
          stage === "roll"
            ? // The last rows repeat the first, so the loop has no seam.
              [...blur[index], ...blur[index].slice(0, rows)]
            : stage === "land" && target
              ? [...blur[index], ...target[index]]
              : resting[index];
        const spun = stage === "roll" || stage === "land" ? blur[index].length : 0;
        const teasing = stage === "land" && tease !== null && index >= tease && stopped >= tease && stopped <= index;

        return (
          <div className={`reel${teasing ? " is-teasing" : ""}${wilds.has(index) ? " is-wild" : ""}`} key={index}>
            <div
              className={`drum${stage === "land" && moving ? " is-moving" : ""}`}
              data-stage={stage}
              style={
                {
                  "--spun": spun,
                  "--delay": "0ms",
                  "--land-ms": `${times[index]}ms`,
                } as React.CSSProperties
              }
            >
              {cells.map((pip, cell) => {
                const row = stage === "rest" ? cell : cell - blur[index].length;
                const key = `${index}-${row}`;
                const isLit = atRest && (lit?.has(key) ?? false);
                const value = atRest ? coins?.get(key) : undefined;
                return (
                  <div className={`cell${isLit ? " is-lit" : ""}${pip === "blank" ? " is-blank" : ""}`} key={cell}>
                    <Pip pip={pip} size={76} ink="var(--field)" paper="var(--paper)" />
                    {value !== undefined ? <span className="coin-value poster num">{value}×</span> : null}
                  </div>
                );
              })}
            </div>
            {wilds.has(index) && cabinet.wild ? (
              <div className="reel-wild" aria-hidden="true">
                <Pip pip={cabinet.wild.symbol} size={120} ink="var(--field)" paper="var(--paper)" />
                <span className="reel-wild-word poster">Wild</span>
              </div>
            ) : null}
          </div>
        );
      })}

      {/* The lines that paid. Two plates, like everything else printed here:
          the cells they cross are already lit cream, so a cream line alone
          would vanish on them, and a dark one would vanish in the gaps. */}
      {atRest && lines.length ? (
        <svg className="paylines" viewBox={`0 0 ${reels * 10} ${rows * 10}`} preserveAspectRatio="none" aria-hidden="true">
          {lines.map((win) => {
            const rowsOf = cabinet.lines[win.line];
            const points = Array.from({ length: win.run }, (_, reel) => `${reel * 10 + 5},${rowsOf[reel] * 10 + 5}`).join(" ");
            return (
              <g key={win.line}>
                <polyline className="line-under" points={points} vectorEffect="non-scaling-stroke" />
                <polyline className="line-over" points={points} vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
        </svg>
      ) : null}
    </div>
  );
}

/** The cells a set of line wins and a scatter light up, as "reel-row". */
export function litCells(cabinet: Machine, window: PipId[][] | null, lines: LineWin[], extra: PipId[] = []): Set<string> {
  const cells = new Set<string>();
  if (!window) return cells;
  for (const win of lines) {
    const rows = cabinet.lines[win.line];
    for (let reel = 0; reel < win.run; reel++) cells.add(`${reel}-${rows[reel]}`);
  }
  window.forEach((reel, c) => reel.forEach((pip, r) => (extra.includes(pip) ? cells.add(`${c}-${r}`) : null)));
  return cells;
}

/**
 * The first drum worth slowing down: the one after the drums already showing
 * enough of the bonus symbol that this drum could still start the bonus.
 * Null when the bonus can no longer start — then nothing is drawn out.
 */
export function teaseFrom(cabinet: Machine, window: PipId[][] | null): number | null {
  const rule = cabinet.feature;
  if (!rule || !window) return null;
  const need = rule.kind === "wheel" ? rule.count : rule.trigger;
  const symbol = rule.symbol;
  // Which reels can carry the symbol at all.
  const carriers = cabinet.reels.map((reel) => reel.includes(symbol));
  let seen = 0;
  for (let reel = 0; reel < window.length; reel++) {
    const remaining = carriers.slice(reel).filter(Boolean).length;
    // Before this drum stops, could the ones still turning complete the set?
    if (seen >= need - 1 && seen < need && carriers[reel] && seen + remaining >= need) return reel;
    seen += window[reel].filter((pip) => pip === symbol).length;
  }
  return null;
}
