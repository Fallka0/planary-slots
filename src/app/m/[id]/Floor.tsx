"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Info, X } from "lucide-react";
import { formatChips, machineById, type MachineId, MACHINES } from "../../../../shared/slots";
import { Celebration, winTier } from "@/components/Celebration";
import { Fairness } from "@/components/Fairness";
import { FreeSpins } from "@/components/FreeSpins";
import { HoldBoard } from "@/components/HoldBoard";
import { OrbitWheel } from "@/components/OrbitWheel";
import { Paytable } from "@/components/Paytable";
import { Pip } from "@/components/Pip";
import { Rail } from "@/components/Rail";
import { litCells, Reels, teaseFrom } from "@/components/Reels";
import { Stake } from "@/components/Stake";
import { TopBar } from "@/components/TopBar";
import { useWallet } from "@/components/WalletProvider";
import { useSound } from "@/lib/sound";
import { useMachine } from "@/lib/useMachine";

const BONUS_TITLE = { wheel: "Orbit Wheel", hold: "Hold & Win", free: "Free spins" } as const;

/**
 * Where the round is on screen. The money has moved before any of this:
 * `reels` is the drums landing, `intro` the bonus game announcing itself,
 * `bonus` the game played out, `celebrate` a big win printed big.
 */
type Scene = "reels" | "intro" | "bonus" | "celebrate";

/**
 * One machine, on the floor.
 *
 * The cabinet takes the machine's own field and ink, the way every container
 * in this casino that holds a cover does, and the chrome around it stays the
 * parlour's. Everything that costs chips is under the drums; everything that
 * explains the machine is on the right, open rather than tucked away.
 */
export function Floor({ id }: { id: MachineId }) {
  const cabinet = machineById(id)!;
  const { balance } = useWallet();
  const sound = useSound();
  const machine = useMachine(cabinet);
  const { state, phase, result, error, lineBet, turbo } = machine;
  const [scene, setScene] = useState<{ nonce: number; scene: Scene } | null>(null);
  const [baseShown, setBaseShown] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  const totalBet = lineBet * cabinet.lines.length;
  const current = result && scene?.nonce === result.nonce ? scene.scene : "reels";
  const tease = useMemo(() => teaseFrom(cabinet, result?.window ?? null), [cabinet, result]);

  /** The round has been shown in full: celebrate it if it earned that, then hand back the lever. */
  const wrapUp = (nonce: number) => {
    if (!result || result.nonce !== nonce) return;
    // Measured against the stake of one spin, bought or not: a bought bonus
    // that pays 75 spins' worth is a huge win. But a bought bonus that pays
    // back less than it cost is a loss, and is not dressed up as a win.
    const beatPrice = !result.bought || result.returned > result.staked;
    if (beatPrice && winTier(result.returned, totalBet)) {
      setScene({ nonce, scene: "celebrate" });
      return;
    }
    later(turbo ? 120 : 420, () => machine.presented());
  };

  /** Rounds already read off the drums: a round is announced, played and paid on screen once. */
  const handled = useRef<number | null>(null);

  /** The drums have stopped on the paid spin. */
  const reelsSettled = () => {
    if (!result || handled.current === result.nonce) return;
    const nonce = result.nonce;
    handled.current = nonce;
    setBaseShown(nonce);
    if (result.expanded.length) sound.play("up");
    if (result.basePays > 0 && !result.bonus) sound.play(result.basePays >= totalBet * 5 ? "big" : "win", 1);
    if (result.bonus) {
      later(turbo ? 350 : 1100, () => {
        setScene({ nonce, scene: "intro" });
        sound.play("bonus");
      });
      later(turbo ? 1100 : 3000, () => setScene({ nonce, scene: "bonus" }));
      return;
    }
    wrapUp(nonce);
  };

  // A bought bonus has no drums to land: it goes straight to the announcement.
  useEffect(() => {
    if (phase !== "showing" || !result?.bought) return;
    const nonce = result.nonce;
    const intro = window.setTimeout(() => {
      setScene({ nonce, scene: "intro" });
      sound.play("bonus");
    }, 0);
    const start = window.setTimeout(() => setScene({ nonce, scene: "bonus" }), turbo ? 800 : 2200);
    return () => {
      window.clearTimeout(intro);
      window.clearTimeout(start);
    };
    // Once per bought round; turbo changing mid-announcement must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result]);

  // Nothing scheduled for a round may fire after the page has moved on.
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  const showing = phase === "showing" && result;
  const shownBase = result && baseShown === result.nonce;
  const lit = useMemo(() => {
    if (!result || !shownBase) return new Set<string>();
    // Only symbols that did something light up: a lone portal that paid
    // nothing must not look like a win.
    const extra = result.scatter ? [result.scatter.symbol] : [];
    if (result.bonus && cabinet.feature) extra.push(cabinet.feature.symbol);
    return litCells(cabinet, result.window, result.lines, extra);
  }, [result, shownBase, cabinet]);
  const coins = useMemo(() => {
    const map = new Map<string, number>();
    if (result?.bonus?.kind === "hold" && !result.bought) {
      for (const coin of result.bonus.start) map.set(`${Math.floor(coin.cell / cabinet.rows)}-${coin.cell % cabinet.rows}`, coin.value);
    }
    return map;
  }, [result, cabinet.rows]);

  const bonusDone = () => result && wrapUp(result.nonce);

  return (
    <div className="app" style={{ "--field": cabinet.field, "--ink": cabinet.ink, "--dot": cabinet.dot } as React.CSSProperties}>
      <TopBar>
        <span className="machine-tag poster">{cabinet.name}</span>
      </TopBar>

      <main className="floor">
        <section className="play">
          <div className="cab" data-machine={cabinet.id} data-spinning={phase !== "idle" || undefined} data-scene={showing ? current : undefined}>
            <div className="cab-print" aria-hidden="true">
              <span className="cab-plate plate-a">{cabinet.lines.length}</span>
              <span className="cab-plate plate-b">{cabinet.lines.length}</span>
              <span className="cab-orbit orbit-a" />
              <span className="cab-orbit orbit-b" />
            </div>

            <div className="cab-head">
              <h1 className="poster">{cabinet.name}</h1>
              <span className="cab-caption poster">{cabinet.caption}</span>
            </div>

            <div className="cab-stage">
              {/* The drums stay mounted through the bonus game, only covered:
                  mounted afresh they would land the round a second time. */}
              <div className="stage-reels" data-covered={(showing && current === "bonus") || undefined}>
                <Reels
                  cabinet={cabinet}
                  spinKey={result && !result.bought ? `n${result.nonce}` : null}
                  target={result && !result.bought ? result.window : null}
                  rolling={phase === "spinning"}
                  turbo={turbo}
                  tease={tease}
                  lines={shownBase ? result!.lines : []}
                  lit={lit}
                  expanded={result?.expanded ?? []}
                  coins={coins}
                  onReelStop={(reel) => {
                    sound.play("stop");
                    if (tease !== null && reel === tease - 1) sound.play("tease");
                  }}
                  onSettled={reelsSettled}
                />
              </div>

              {showing && current === "bonus" && result.bonus && cabinet.feature ? (
                result.bonus.kind === "wheel" && cabinet.feature.kind === "wheel" ? (
                  <OrbitWheel rule={cabinet.feature} play={result.bonus} totalBet={totalBet} turbo={turbo} onDone={bonusDone} />
                ) : result.bonus.kind === "hold" && cabinet.feature.kind === "hold" ? (
                  <HoldBoard cabinet={cabinet} rule={cabinet.feature} play={result.bonus} totalBet={totalBet} turbo={turbo} onDone={bonusDone} />
                ) : result.bonus.kind === "free" && cabinet.feature.kind === "free" ? (
                  <FreeSpins cabinet={cabinet} rule={cabinet.feature} play={result.bonus} lineBet={lineBet} turbo={turbo} onDone={bonusDone} />
                ) : null
              ) : null}

              {showing && current === "intro" && result.bonus ? (
                <div className="bonus-intro" role="status">
                  {cabinet.feature ? <Pip pip={cabinet.feature.symbol} size={120} ink="var(--field)" paper="var(--paper)" /> : null}
                  <p className="poster">{BONUS_TITLE[result.bonus.kind]}</p>
                  <span>
                    {result.bought
                      ? "Bought — here it comes."
                      : result.bonus.kind === "free"
                        ? `${cabinet.feature?.kind === "free" ? cabinet.feature.spins : ""} spins, the multiplier climbing every one.`
                        : result.bonus.kind === "hold"
                          ? "The coins lock. Three respins."
                          : "Spin the wheel."}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="cab-read" aria-live="polite">
              <Readout result={result} phase={phase} scene={current} shownBase={Boolean(shownBase)} />
            </div>

            {showing && current === "celebrate" ? (
              <Celebration amount={result.returned} totalBet={totalBet} turbo={turbo} onDone={() => machine.presented()} />
            ) : null}
          </div>

          {machine.notice ? (
            <p className="notice">
              <Info size={16} aria-hidden="true" />
              <span>{machine.notice}</span>
              <button type="button" className="notice-x" onClick={machine.dismissNotice} aria-label="Dismiss">
                <X size={15} aria-hidden="true" />
              </button>
            </p>
          ) : null}

          <Stake
            cabinet={cabinet}
            lineBet={lineBet}
            setLineBet={machine.setLineBet}
            canChangeBet={machine.canChangeBet}
            phase={phase}
            auto={machine.auto}
            turbo={turbo}
            onTurbo={machine.setTurbo}
            onSpin={() => {
              sound.play("spin");
              void machine.spin(false);
            }}
            onBuy={() => {
              sound.play("click");
              void machine.spin(true);
            }}
            onAuto={machine.startAuto}
            onStopAuto={machine.stopAuto}
            balance={balance}
          />

          <p className="floor-other">
            Also here:{" "}
            {MACHINES.filter((other) => other.id !== cabinet.id).map((other, index) => (
              <span key={other.id}>
                {index > 0 ? " · " : ""}
                <Link href={`/m/${other.id}`}>{other.name}</Link>
              </span>
            ))}
          </p>
        </section>

        <aside className="side">
          <Paytable cabinet={cabinet} lineBet={lineBet} />
          <Fairness state={state} last={phase === "idle" ? result : null} onSeed={(value) => void machine.setSeed(value)} />
          <Rail history={state?.history ?? []} />
        </aside>
      </main>

      {error ? (
        <p className="toast" role="status">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The line under the drums: what just happened, in words and chips. */
function Readout({
  result,
  phase,
  scene,
  shownBase,
}: {
  result: ReturnType<typeof useMachine>["result"];
  phase: ReturnType<typeof useMachine>["phase"];
  scene: Scene;
  shownBase: boolean;
}) {
  if (phase === "loading") return <p className="cab-idle">Opening the machine…</p>;
  if (phase === "spinning") return <p className="cab-idle">Spinning…</p>;
  if (!result) return <p className="cab-idle">Committed and waiting. The hash of your next spin is under Provably fair.</p>;
  const done = phase === "idle";
  if (!done && !shownBase && !result.bought) return <p className="cab-idle">…</p>;
  if (!done && scene !== "reels" && result.bonus) {
    return (
      <p className="cab-win poster">
        <span className="num">{result.basePays > 0 ? `+${formatChips(result.basePays)}` : BONUS_TITLE[result.bonus.kind]}</span>
        <em>{result.basePays > 0 ? "from the reels, and the bonus game to come" : "playing"}</em>
      </p>
    );
  }
  const shown = done ? result.returned : result.basePays;
  if (shown > 0) {
    return (
      <p className="cab-win poster">
        <span className="num">+{formatChips(shown)}</span>
        <em>{result.outcome}</em>
      </p>
    );
  }
  return <p className="cab-nothing">{result.outcome}</p>;
}
