"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Machine } from "../../shared/slots";
import type { MachineState, SpinReport } from "../../shared/protocol";
import { isRefusal, MAX_AUTO_SPINS } from "../../shared/protocol";
import { useAuth } from "@/components/AuthProvider";
import { useWallet } from "@/components/WalletProvider";
import { fetchState, newSpinKey, requestSpin, saveSeed } from "./machine";

/**
 * - `spinning`: the lever is pulled and the machine room has not answered.
 * - `showing`: the answer is in and the screen is playing it out — the drums
 *   landing, then any bonus game, then any celebration.
 * The chips have already moved by the time `showing` begins.
 */
export type Phase = "loading" | "idle" | "spinning" | "showing";

/** When a run of autoplay stops on its own. */
export interface AutoRules {
  spins: number;
  /** Stop when a bonus game starts. */
  onBonus: boolean;
  /** Stop on a single round paying at least this many times total stake; 0 for never. */
  onWin: number;
  /** Stop once this many chips down on the run; 0 for never. */
  lossLimit: number;
}

const TURBO_KEY = "planary:slots:turbo";

/**
 * One machine, as the screen sees it.
 *
 * A round is a single request: the machine room decides everything and
 * answers with the whole result, bonus game and all. What happens here
 * afterwards is theatre — `showing` lasts as long as the screen takes to play
 * it out, and the Floor calls `presented()` when it is done.
 */
export function useMachine(cabinet: Machine) {
  const { accessToken } = useAuth();
  const { setBalance } = useWallet();

  const [state, setState] = useState<MachineState | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [result, setResult] = useState<SpinReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lineBet, setLineBet] = useState(cabinet.lineBets[1] ?? cabinet.lineBets[0]);
  const [auto, setAuto] = useState<(AutoRules & { left: number; net: number }) | null>(null);
  const [turbo, setTurboState] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(TURBO_KEY);
    } catch {}
    if (stored === "on") queueMicrotask(() => setTurboState(true));
  }, []);

  const setTurbo = useCallback((on: boolean) => {
    setTurboState(on);
    try {
      window.localStorage.setItem(TURBO_KEY, on ? "on" : "off");
    } catch {}
  }, []);

  const apply = useCallback(
    (answer: MachineState) => {
      setState(answer);
      if (typeof answer.balance === "number") setBalance(answer.balance);
      if (answer.settled && answer.settled.spins > 0) {
        setNotice(
          `The old machine still owed you ${answer.settled.spins} free spin${answer.settled.spins === 1 ? "" : "s"}. They have been played and paid ${answer.settled.returned} chips — each one is in the history below.`,
        );
      }
    },
    [setBalance],
  );

  /** Picks up the machine's state again: the history's round ids arrive this way. */
  const refresh = useCallback(() => {
    void fetchState(cabinet.id, accessToken).then((answer) => {
      if (!isRefusal(answer)) apply(answer);
    });
  }, [cabinet.id, accessToken, apply]);

  useEffect(() => {
    let live = true;
    void fetchState(cabinet.id, accessToken).then((answer) => {
      if (!live) return;
      if (isRefusal(answer)) setError(answer.error);
      else apply(answer);
      setPhase("idle");
    });
    return () => {
      live = false;
    };
  }, [cabinet.id, accessToken, apply]);

  const busy = useRef(false);
  /** The balance after the round's payout, held back until the round has been shown. */
  const pendingBalance = useRef<number | null>(null);

  const spin = useCallback(
    async (buy = false) => {
      if (phase !== "idle" || busy.current) return;
      busy.current = true;
      setError(null);
      setResult(null);
      setPhase("spinning");

      // The same key on a retry means the same spin, so a lost answer cannot
      // cost a second stake.
      const answer = await requestSpin(cabinet.id, lineBet, accessToken, newSpinKey(), buy);
      busy.current = false;

      if (isRefusal(answer)) {
        setError(answer.error);
        if (typeof answer.balance === "number") setBalance(answer.balance);
        setAuto(null);
        setPhase("idle");
        return;
      }
      // A machine room still on the previous version answers without the
      // bonus-game fields; read what is there rather than fall over while
      // the two are deployed one after the other.
      const spin: SpinReport = {
        ...answer.spin,
        bought: answer.spin.bought ?? false,
        expanded: answer.spin.expanded ?? [],
        basePays: answer.spin.basePays ?? answer.spin.returned,
        bonus: answer.spin.bonus ?? null,
      };
      setResult(spin);
      setState({ ...answer.state, history: answer.state.history ?? [], settled: answer.state.settled ?? null });
      if (typeof answer.balance === "number") {
        pendingBalance.current = answer.balance;
        setBalance(answer.balance - spin.returned);
      }
      setPhase("showing");
    },
    [phase, cabinet.id, lineBet, accessToken, setBalance],
  );

  /**
   * The screen has finished playing the round out. Autoplay decides here
   * whether to carry on, so a stop condition is judged on a round the player
   * has actually seen.
   */
  const presented = useCallback(() => {
    setPhase("idle");
    if (pendingBalance.current !== null) {
      setBalance(pendingBalance.current);
      pendingBalance.current = null;
    }
    const last = result;
    setAuto((run) => {
      if (!run || !last) return run;
      const net = run.net + last.returned - last.staked;
      const totalBet = lineBet * cabinet.lines.length;
      const stop =
        run.left <= 0 ||
        (run.onBonus && last.bonus !== null) ||
        (run.onWin > 0 && last.returned >= run.onWin * totalBet) ||
        (run.lossLimit > 0 && -net >= run.lossLimit);
      return stop ? null : { ...run, net };
    });
    // The round has been filed by now, or nearly: pick up its id for the history.
    window.setTimeout(refresh, 1200);
  }, [result, lineBet, cabinet.lines.length, refresh, setBalance]);

  // Autoplay: one round at a time, each waiting for the last to be shown, and
  // stopping the moment anything is refused. The counter comes down as a spin
  // is taken rather than as it lands, so a run cannot be stretched by a slow
  // answer into one more spin than was asked for.
  useEffect(() => {
    if (phase !== "idle" || !auto || auto.left <= 0) return;
    const timer = window.setTimeout(
      () => {
        setAuto((run) => (run ? { ...run, left: run.left - 1 } : run));
        void spin(false);
      },
      turbo ? 120 : 320,
    );
    return () => window.clearTimeout(timer);
  }, [phase, auto, spin, turbo]);

  const startAuto = useCallback(
    (rules: AutoRules) => setAuto({ ...rules, spins: Math.min(MAX_AUTO_SPINS, Math.max(0, Math.floor(rules.spins))), left: Math.min(MAX_AUTO_SPINS, rules.spins), net: 0 }),
    [],
  );
  const stopAuto = useCallback(() => setAuto(null), []);

  const setSeed = useCallback(
    async (value: string) => {
      const answer = await saveSeed(value, accessToken);
      if (isRefusal(answer)) {
        setError(answer.error);
        return;
      }
      setState((current) => (current ? { ...current, clientSeed: answer.clientSeed } : current));
    },
    [accessToken],
  );

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 4500);
    return () => window.clearTimeout(timer);
  }, [error]);

  return {
    state,
    phase,
    result,
    error,
    notice,
    dismissNotice: () => setNotice(null),
    lineBet,
    setLineBet,
    canChangeBet: phase === "idle" && !auto,
    spin,
    presented,
    auto,
    startAuto,
    stopAuto,
    turbo,
    setTurbo,
    setSeed,
  };
}
