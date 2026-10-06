"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type FreePlay, type FreeRule, formatChips, type Machine } from "../../shared/slots";
import { useSound } from "@/lib/sound";
import { litCells, Reels, teaseFrom } from "./Reels";

/*
  A series of free spins, played out on the same drums.

  The whole series came out of the commitment that started it, so every spin
  is already known. They are shown one after another, each with its
  multiplier, and the running total is what the casino has already paid.
*/

export function FreeSpins({
  cabinet,
  rule,
  play,
  lineBet,
  turbo,
  onDone,
}: {
  cabinet: Machine;
  rule: FreeRule;
  play: FreePlay;
  lineBet: number;
  turbo: boolean;
  onDone: () => void;
}) {
  const sound = useSound();
  const [index, setIndex] = useState(-1);
  const [rolling, setRolling] = useState(false);
  const [landed, setLanded] = useState(-1);
  const [banner, setBanner] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const timers = useRef<number[]>([]);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  /** Spin number `i`: a moment of turning, then the drums land on its window. */
  const start = (i: number) => {
    setIndex(i);
    setLanded(-1);
    setBanner(null);
    setRolling(true);
    sound.play("spin");
    later(turbo ? 110 : 420, () => setRolling(false));
  };

  const finish = () => {
    setFinished(true);
    const multiple = play.pays / (lineBet * cabinet.lines.length);
    sound.play(multiple >= 10 ? "big" : "win", Math.min(4, multiple / 25));
    later(turbo ? 800 : 2200, () => done.current());
  };

  useEffect(() => {
    later(turbo ? 300 : 1200, () => start(0));
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
    // Played once per series.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The drums have landed on spin `index`: show what it paid, then go on. */
  const settled = () => {
    const spin = play.spins[index];
    if (!spin) return;
    setLanded(index);
    if (spin.added > 0) {
      setBanner(`+${spin.added} free spins`);
      sound.play("bonus");
    } else if (spin.pays > 0) {
      sound.play("win");
    }
    const hold = spin.added > 0 ? (turbo ? 900 : 2000) : spin.pays > 0 ? (turbo ? 450 : 1300) : turbo ? 180 : 600;
    const next = index + 1;
    later(hold, () => (next < play.spins.length ? start(next) : finish()));
  };

  /** How many spins the series had awarded by each spin, so the count can say "4 / 22" after a retrigger. */
  const awarded = useMemo(() => {
    const out: number[] = [];
    let total = rule.spins;
    for (const spin of play.spins) {
      total += spin.added;
      out.push(total);
    }
    return out;
  }, [play.spins, rule.spins]);

  const current = index >= 0 ? play.spins[index] ?? null : null;
  const shownTotal = play.spins.slice(0, landed + 1).reduce((sum, s) => sum + s.pays, 0);
  const lit = useMemo(
    () => (current && landed === index ? litCells(cabinet, current.window, current.lines, current.scatter ? [current.scatter.symbol] : []) : new Set<string>()),
    [current, landed, index, cabinet],
  );
  const multiplier = current?.multiplier ?? 1;
  const totalSpins = index >= 0 && landed === index ? awarded[index] : index > 0 ? awarded[index - 1] : rule.spins;

  return (
    <div className="bonus free-bonus" data-finished={finished || undefined}>
      <div className="free-head">
        <p className="bonus-title poster">Free spins</p>
        <span className="free-count poster num" aria-label={`Free spin ${Math.max(1, index + 1)} of ${totalSpins}`}>
          {Math.max(0, index + 1)}
          <em>/{totalSpins}</em>
        </span>
        <span className="free-mult poster num" key={multiplier} data-max={multiplier >= rule.maxMultiplier || undefined} title="This spin's multiplier">
          ×{multiplier}
        </span>
        <span className="free-total poster num" title="Won so far in this series">
          {formatChips(shownTotal)}
        </span>
      </div>
      <Reels
        cabinet={cabinet}
        spinKey={current ? `free-${index}` : null}
        target={rolling ? null : current?.window ?? null}
        rolling={rolling}
        turbo={turbo}
        tease={current ? teaseFrom(cabinet, current.window) : null}
        lines={current && landed === index ? current.lines : []}
        lit={lit}
        expanded={current?.expanded ?? []}
        onReelStop={() => sound.play("stop")}
        onSettled={settled}
      />
      <p className="bonus-read" aria-live="polite">
        {finished ? (
          <span className="poster num">
            {play.spins.length} spins · {formatChips(play.pays)} chips
          </span>
        ) : banner ? (
          <span className="poster free-banner">{banner}</span>
        ) : current && landed === index && current.pays > 0 ? (
          <span className="poster num">
            +{formatChips(current.pays)} <em>at ×{current.multiplier}</em>
          </span>
        ) : (
          <span>The multiplier rises by one every free spin, up to ×{rule.maxMultiplier}.</span>
        )}
      </p>
    </div>
  );
}
