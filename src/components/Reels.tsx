"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Machine, Pip as PipId } from "../../shared/slots";
import { windowAt } from "../../shared/slots";
import type { SpinReport } from "../../shared/protocol";
import { Pip } from "./Pip";

/*
  The drums.

  Nothing here decides anything. The spin was resolved in the machine room
  before the first frame, and this component's only job is to not give the
  answer away early: the drums turn, then come to rest on symbols that were
  already fixed. It would be dishonest to animate a result that could still
  change, and it would be a lie to animate one that already has — so the
  animation is openly theatre and the panel beside it says so.
*/

/** How long the drums turn once the answer is in, and the stagger between them. */
const LAND_MS = 760;
const STAGGER_MS = 130;
/** Cells of blur above the result: enough that the eye cannot follow a symbol. */
const RUN_UP = 18;

type Stage = "rest" | "roll" | "land";

function randomPips(reel: PipId[], count: number): PipId[] {
  // Drawn from the reel's own strip, so the blur is made of the right symbols
  // in the right proportions — a drum nobody can read is still that drum.
  return Array.from({ length: count }, () => reel[Math.floor(Math.random() * reel.length)]);
}

export function Reels({
  cabinet,
  rolling,
  result,
  onSettled,
}: {
  cabinet: Machine;
  /** True from the moment the lever is pulled until the answer comes back. */
  rolling: boolean;
  /** The finished spin, or null while one is in flight. */
  result: SpinReport | null;
  onSettled: () => void;
}) {
  const [stage, setStage] = useState<Stage>("rest");
  const [landed, setLanded] = useState<SpinReport | null>(null);
  const [moving, setMoving] = useState(false);
  const [reduced, setReduced] = useState(false);
  const settledFor = useRef<number | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
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
      setStage(reduced ? "rest" : "roll");
      return;
    }
    if (!result) setStage("rest");
  }, [rolling, reduced, result]);

  // The answer is in. Reduced motion skips straight to it.
  useEffect(() => {
    if (!result || settledFor.current === result.nonce) return;
    if (reduced) {
      settledFor.current = result.nonce;
      setStage("rest");
      setLanded(result);
      onSettled();
      return;
    }
    setStage("land");
    setMoving(false);
    // One frame on the starting transform, so the transition has somewhere to
    // come from; without this the browser coalesces both and nothing moves.
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setMoving(true)));
    const timer = window.setTimeout(() => {
      if (settledFor.current === result.nonce) return;
      settledFor.current = result.nonce;
      setStage("rest");
      setLanded(result);
      onSettled();
    }, LAND_MS + STAGGER_MS * (cabinet.reels.length - 1) + 60);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [result, reduced, cabinet.reels.length, onSettled]);

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
    // A new nonce is a new spin; the strips never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cabinet, result?.nonce, rolling],
  );

  const lit = useMemo(() => {
    const cells = new Set<string>();
    if (!landed) return cells;
    for (const win of landed.lines) {
      const rows = cabinet.lines[win.line];
      for (let reel = 0; reel < win.run; reel++) cells.add(`${reel}-${rows[reel]}`);
    }
    if (landed.scatter) {
      landed.window.forEach((reel, c) => reel.forEach((pip, r) => (pip === landed.scatter?.symbol ? cells.add(`${c}-${r}`) : null)));
    }
    return cells;
  }, [landed, cabinet.lines]);

  const reels = cabinet.reels.length;
  const rows = cabinet.rows;

  return (
    <div
      className="reels"
      data-stage={stage}
      data-reels={reels}
      style={{ "--reels": reels, "--rows": rows } as React.CSSProperties}
      role="img"
      aria-label={
        stage === "rest" && landed
          ? `${landed.outcome}. ${landed.window.map((reel, i) => `Reel ${i + 1}: ${reel.join(", ")}`).join(". ")}`
          : "The reels are turning"
      }
    >
      {cabinet.reels.map((reel, index) => {
        const cells =
          stage === "roll"
            ? // The last rows repeat the first, so the loop has no seam.
              [...blur[index], ...blur[index].slice(0, rows)]
            : stage === "land" && result
              ? [...blur[index], ...result.window[index]]
              : resting[index];
        const spun = stage === "roll" ? blur[index].length : stage === "land" ? blur[index].length : 0;

        return (
          <div className="reel" key={index}>
            <div
              className={`drum${stage === "land" && moving ? " is-moving" : ""}`}
              data-stage={stage}
              style={
                {
                  "--spun": spun,
                  "--delay": `${index * STAGGER_MS}ms`,
                  "--land-ms": `${LAND_MS}ms`,
                } as React.CSSProperties
              }
            >
              {cells.map((pip, cell) => {
                const row = stage === "rest" ? cell : cell - blur[index].length;
                const isLit = stage === "rest" && lit.has(`${index}-${row}`);
                return (
                  <div className={`cell${isLit ? " is-lit" : ""}${pip === "blank" ? " is-blank" : ""}`} key={cell}>
                    <Pip pip={pip} size={76} ink="var(--field)" paper="var(--paper)" />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* The lines that paid. Two plates, like everything else printed here:
          the cells they cross are already lit cream, so a cream line alone
          would vanish on them, and a dark one would vanish in the gaps. */}
      {stage === "rest" && landed?.lines.length ? (
        <svg className="paylines" viewBox={`0 0 ${reels * 10} ${rows * 10}`} preserveAspectRatio="none" aria-hidden="true">
          {landed.lines.map((win) => {
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
