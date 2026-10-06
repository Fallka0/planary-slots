"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type Coin, formatChips, type HoldPlay, type HoldRule, type Machine } from "../../shared/slots";
import { useSound } from "@/lib/sound";
import { Pip } from "./Pip";

/*
  Hold & Win, played out.

  The board is the window, cell for cell. Every coin, every respin and every
  empty miss arrives from the machine room already decided; the board shows
  them one respin at a time, with the counter going back to three whenever a
  coin lands, exactly as the rule in shared/slots.ts says it does.
*/

export function HoldBoard({
  cabinet,
  rule,
  play,
  totalBet,
  turbo,
  onDone,
}: {
  cabinet: Machine;
  rule: HoldRule;
  play: HoldPlay;
  totalBet: number;
  turbo: boolean;
  onDone: () => void;
}) {
  const sound = useSound();
  const cells = cabinet.reels.length * cabinet.rows;
  const [shown, setShown] = useState<Coin[]>([]);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [respin, setRespin] = useState(-1);
  const [left, setLeft] = useState(rule.respins);
  const [rolling, setRolling] = useState(false);
  const [finished, setFinished] = useState(false);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  const names = useMemo(() => new Map(rule.values.filter((v) => v.name).map((v) => [v.value, v.name!])), [rule.values]);

  useEffect(() => {
    const timers: number[] = [];
    let t = 0;
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const beat = turbo ? 260 : 750;

    // The coins that started it lock first, one after another.
    play.start.forEach((coin, i) => {
      at(t + i * (turbo ? 90 : 260), () => {
        setShown((s) => [...s, coin]);
        setFresh(new Set([coin.cell]));
        sound.play("lock");
      });
    });
    t += play.start.length * (turbo ? 90 : 260) + beat;

    let counter = rule.respins;
    play.respins.forEach((landed, r) => {
      at(t, () => {
        setRespin(r);
        setRolling(true);
        setFresh(new Set());
        sound.play("spin");
      });
      t += beat;
      const after = landed.length > 0 ? rule.respins : counter - 1;
      counter = after;
      at(t, () => {
        setRolling(false);
        if (landed.length) {
          setShown((s) => [...s, ...landed]);
          setFresh(new Set(landed.map((c) => c.cell)));
          sound.play("lock");
        } else {
          sound.play("stop");
        }
        setLeft(after);
      });
      t += landed.length ? beat * 1.3 : beat;
    });

    at(t, () => {
      setFinished(true);
      sound.play(play.full ? "grand" : play.multiple >= 50 ? "big" : "win", Math.min(4, play.multiple / 20));
    });
    at(t + (turbo ? 900 : play.full ? 3200 : 2200), () => done.current());
    return () => timers.forEach((id) => window.clearTimeout(id));
    // Played once per bonus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const board = new Map(shown.map((c) => [c.cell, c.value]));
  const total = shown.reduce((sum, c) => sum + c.value, 0) + (finished && play.full ? rule.grand : 0);

  return (
    <div className="bonus hold-bonus" data-finished={finished || undefined} data-full={(finished && play.full) || undefined}>
      <div className="hold-head">
        <p className="bonus-title poster">Hold &amp; Win</p>
        <div className="hold-respins" aria-label={`${left} respin${left === 1 ? "" : "s"} left`}>
          {Array.from({ length: rule.respins }, (_, i) => (
            <span key={i} className={i < left ? "is-on" : undefined} />
          ))}
          <em>{respin < 0 ? "Locking" : "Respins"}</em>
        </div>
      </div>

      <div className="hold-grid" style={{ "--reels": cabinet.reels.length, "--rows": cabinet.rows } as React.CSSProperties}>
        {Array.from({ length: cells }, (_, cell) => {
          // Cells count down each reel, then along; the grid fills row by row.
          const reel = Math.floor(cell / cabinet.rows);
          const row = cell % cabinet.rows;
          const value = board.get(cell);
          return (
            <div
              key={cell}
              className={`hold-cell${value !== undefined ? " is-coin" : ""}${fresh.has(cell) ? " is-fresh" : ""}${rolling && value === undefined ? " is-rolling" : ""}`}
              style={{ gridColumn: reel + 1, gridRow: row + 1 }}
            >
              {value !== undefined ? (
                <>
                  <Pip pip={rule.symbol} size={80} ink="var(--field)" paper="var(--paper)" />
                  <span className="hold-value poster num">{names.get(value) ?? `${value}×`}</span>
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="bonus-read" aria-live="polite">
        {finished && play.full ? (
          <span className="poster">Full window · Grand {rule.grand}×</span>
        ) : null}
        <span className="poster num">
          {total}× · {formatChips(total * totalBet)} chips
        </span>
      </p>
    </div>
  );
}
