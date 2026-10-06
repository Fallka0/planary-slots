"use client";

import { useEffect, useRef, useState } from "react";
import { formatChips, type WheelPlay, type WheelRule } from "../../shared/slots";
import { useSound } from "@/lib/sound";

/*
  The Orbit Wheel, printed.

  Every segment on it is the segment in shared/slots.ts, in the same order, so
  the wheel on screen is the wheel the odds are worked out from — not a
  picture of one. The pointer was always going to stop where the machine room
  drew it; the spin is the time it takes to say so.
*/

const SIZE = 360;
const C = SIZE / 2;
/** Radii: the outer ring, the inner wheel, and the hub. */
const R_OUT = 176;
const R_RING = 132;
const R_IN = 128;
const R_HUB = 34;

function arc(r0: number, r1: number, a0: number, a1: number) {
  // Angles in degrees, 0 at the top, clockwise.
  const p = (r: number, a: number) => {
    const rad = ((a - 90) * Math.PI) / 180;
    return `${(C + r * Math.cos(rad)).toFixed(2)} ${(C + r * Math.sin(rad)).toFixed(2)}`;
  };
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${p(r1, a0)} A${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} L${p(r0, a1)} A${r0} ${r0} 0 ${large} 0 ${p(r0, a0)} Z`;
}

function label(r: number, a: number) {
  const rad = ((a - 90) * Math.PI) / 180;
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) };
}

/** The rotation that brings segment `i` of `n` under the pointer, after `turns` whole turns. */
function landOn(i: number, n: number, turns: number) {
  return turns * 360 - (i * 360) / n;
}

export function OrbitWheel({
  rule,
  play,
  totalBet,
  turbo,
  onDone,
}: {
  rule: WheelRule;
  play: WheelPlay;
  totalBet: number;
  turbo: boolean;
  onDone: () => void;
}) {
  const sound = useSound();
  const [stage, setStage] = useState<"ready" | "inner" | "up" | "outer" | "won">("ready");
  const [innerTurn, setInnerTurn] = useState(0);
  const [outerTurn, setOuterTurn] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  const nIn = rule.inner.length;
  const nOut = rule.outer.length;
  const spinMs = turbo ? 1400 : 4200;

  useEffect(() => {
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    // Ticks that slow as the wheel does: a sound, nothing more.
    const ticks = (from: number, length: number) => {
      const count = turbo ? 10 : 26;
      for (let k = 0; k < count; k++) at(from + length * (1 - (1 - k / count) ** 2.2), () => sound.play("tick"));
    };
    at(turbo ? 150 : 500, () => {
      setStage("inner");
      setInnerTurn(landOn(play.inner, nIn, turbo ? 3 : 6));
      ticks(0, spinMs);
    });
    let t = (turbo ? 150 : 500) + spinMs + 200;
    if (play.outer !== null) {
      at(t, () => {
        setStage("up");
        sound.play("up");
      });
      t += turbo ? 500 : 1300;
      at(t, () => {
        setStage("outer");
        setOuterTurn(-landOn(play.outer!, nOut, turbo ? 2 : 4));
        ticks(0, spinMs);
      });
      t += spinMs + 200;
    }
    at(t, () => {
      setStage("won");
      sound.play(play.multiple >= 100 ? "grand" : "big", Math.min(4, play.multiple / 25));
    });
    at(t + (turbo ? 900 : 2600), () => done.current());
    return () => timers.forEach((id) => window.clearTimeout(id));
    // Played once per bonus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const segIn = 360 / nIn;
  const segOut = 360 / nOut;
  const transition = `transform ${spinMs}ms cubic-bezier(0.12, 0.72, 0.16, 1)`;

  return (
    <div className="bonus wheel-bonus" data-stage={stage}>
      <p className="bonus-title poster">Orbit Wheel</p>
      <div className="wheel-stage">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="wheel" aria-hidden="true">
          {/* The outer ring turns the other way. */}
          <g style={{ transform: `rotate(${outerTurn}deg)`, transformOrigin: "50% 50%", transition }} className="wheel-outer">
            {rule.outer.map((value, i) => {
              const a0 = i * segOut - segOut / 2;
              const pos = label((R_OUT + R_RING) / 2, i * segOut);
              const hit = stage === "won" && play.outer === i;
              return (
                <g key={i} className={hit ? "is-hit" : undefined}>
                  <path d={arc(R_RING, R_OUT, a0, a0 + segOut)} className={i % 2 ? "seg-b" : "seg-a"} />
                  <text x={pos.x} y={pos.y + 7} textAnchor="middle" className="seg-label poster" transform={`rotate(${i * segOut} ${pos.x} ${pos.y})`}>
                    {formatChips(value)}×
                  </text>
                </g>
              );
            })}
          </g>
          <g style={{ transform: `rotate(${innerTurn}deg)`, transformOrigin: "50% 50%", transition }} className="wheel-inner">
            {rule.inner.map((value, i) => {
              const a0 = i * segIn - segIn / 2;
              const pos = label(R_IN * 0.7, i * segIn);
              const hit = (stage === "won" || stage === "up" || stage === "outer") && play.inner === i;
              return (
                <g key={i} className={`${value === "up" ? "is-up" : ""}${hit ? " is-hit" : ""}`}>
                  <path d={arc(R_HUB, R_IN, a0, a0 + segIn)} className={value === "up" ? "seg-up" : i % 2 ? "seg-d" : "seg-c"} />
                  <text x={pos.x} y={pos.y + 8} textAnchor="middle" className="seg-label poster" transform={`rotate(${i * segIn} ${pos.x} ${pos.y})`}>
                    {value === "up" ? "UP" : `${value}×`}
                  </text>
                </g>
              );
            })}
            <circle cx={C} cy={C} r={R_HUB} className="wheel-hub" />
          </g>
          <circle cx={C} cy={C} r={R_HUB - 12} className="wheel-cap" />
        </svg>
        {/* The pointer: one for the inner wheel, and the outer ring reads off the same line. */}
        <svg viewBox="0 0 40 46" className="wheel-pointer" aria-hidden="true">
          <path d="M20 46 2 6a4 4 0 0 1 3-6h30a4 4 0 0 1 3 6z" />
        </svg>
      </div>
      <p className="bonus-read" aria-live="polite">
        {stage === "up" ? (
          <span className="poster">Up to the outer ring!</span>
        ) : stage === "won" ? (
          <span className="poster num">
            {play.multiple}× · {formatChips(play.pays)} chips
          </span>
        ) : (
          <span>Every segment is equally likely. {rule.inner.filter((v) => v === "up").length} of the {nIn} send you to the outer ring.</span>
        )}
      </p>
      <span className="sr-only">Stake {formatChips(totalBet)}</span>
    </div>
  );
}
