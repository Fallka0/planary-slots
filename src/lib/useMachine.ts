"use client";

import { useCallback, useEffect, useState } from "react";
import type { Machine } from "../../shared/slots";
import type { MachineState, SpinReport } from "../../shared/protocol";
import { isRefusal, MAX_AUTO_SPINS } from "../../shared/protocol";
import { useAuth } from "@/components/AuthProvider";
import { useWallet } from "@/components/WalletProvider";
import { fetchState, newSpinKey, requestSpin, saveSeed } from "./machine";

export type Phase = "loading" | "idle" | "spinning" | "reading";

/**
 * One machine, as the screen sees it.
 *
 * The spin itself is a single request: the machine room decides everything and
 * answers with the whole result. What happens here afterwards is theatre — the
 * reels are already stopped before they appear to stop, and this hook simply
 * holds the result back until the drums have finished turning.
 *
 * `phase` is therefore about the animation, never about the money. The chips
 * have already moved by the time `reading` begins.
 */
export function useMachine(cabinet: Machine) {
  const { accessToken } = useAuth();
  const { setBalance } = useWallet();

  const [state, setState] = useState<MachineState | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [result, setResult] = useState<SpinReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lineBet, setLineBet] = useState(cabinet.lineBets[1] ?? cabinet.lineBets[0]);
  const [autoLeft, setAutoLeft] = useState(0);

  useEffect(() => {
    let live = true;
    void fetchState(cabinet.id, accessToken).then((answer) => {
      if (!live) return;
      if (isRefusal(answer)) {
        setError(answer.error);
        setPhase("idle");
        return;
      }
      setState(answer);
      if (typeof answer.balance === "number") setBalance(answer.balance);
      setPhase("idle");
    });
    return () => {
      live = false;
    };
  }, [cabinet.id, accessToken, setBalance]);

  const spin = useCallback(async () => {
    if (phase !== "idle") return;
    setError(null);
    setResult(null);
    setPhase("spinning");

    // The same key on a retry means the same spin, so a lost answer cannot
    // cost a second stake.
    const answer = await requestSpin(cabinet.id, lineBet, accessToken, newSpinKey());

    if (isRefusal(answer)) {
      setError(answer.error);
      if (typeof answer.balance === "number") setBalance(answer.balance);
      setAutoLeft(0);
      setPhase("idle");
      return;
    }
    setResult(answer.spin);
    setState(answer.state);
    if (typeof answer.balance === "number") setBalance(answer.balance);
    // The reels are turning: `settled()` lets go of the result when they stop.
    setPhase("reading");
  }, [phase, cabinet.id, lineBet, accessToken, setBalance]);

  /** Called by the reels when the last drum has stopped. */
  const settled = useCallback(() => setPhase("idle"), []);

  // Autoplay: one spin at a time, each waiting for the last to land, and
  // stopping the moment anything is refused. The counter comes down as a spin
  // is taken rather than as it lands, so a run cannot be stretched by a slow
  // answer into one more spin than was asked for.
  useEffect(() => {
    if (phase !== "idle" || autoLeft <= 0) return;
    const timer = window.setTimeout(() => {
      setAutoLeft((left) => Math.max(0, left - 1));
      void spin();
    }, 260);
    return () => window.clearTimeout(timer);
  }, [phase, autoLeft, spin]);

  const startAuto = useCallback((spins: number) => setAutoLeft(Math.min(MAX_AUTO_SPINS, Math.max(0, Math.floor(spins)))), []);
  const stopAuto = useCallback(() => setAutoLeft(0), []);

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

  // A free spin is played at the stake that won it, so the picker follows.
  const freeSpins = state?.freeSpins ?? 0;
  const stake = freeSpins > 0 ? state?.freeSpinBet || lineBet : lineBet;

  return {
    state,
    phase,
    result,
    error,
    lineBet: stake,
    setLineBet,
    canChangeBet: phase === "idle" && freeSpins === 0 && autoLeft === 0,
    freeSpins,
    spin,
    settled,
    autoLeft,
    startAuto,
    stopAuto,
    setSeed,
  };
}
