"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";

export const CASINO_API = process.env.NEXT_PUBLIC_CASINO_API || "https://planary-casino-api.planary.workers.dev";

interface WalletState {
  /** Null until the first answer from the casino wallet. */
  balance: number | null;
  refresh: () => void;
  /** The machine reports the balance as it moves chips; use it without a round trip. */
  setBalance: (balance: number) => void;
}

const WalletContext = createContext<WalletState | null>(null);

/**
 * Chips live in the Planary Casino wallet, never here.
 *
 * The machine room moves them and reports the new balance with every spin, so
 * this mostly sits still; the poll is for chips that arrive from somewhere else
 * — the daily bonus, a transfer from a friend — while a machine is open.
 */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuth();
  const pathname = usePathname();
  const [balance, setBalance] = useState<number | null>(null);

  const refresh = useCallback(() => {
    fetch(`${CASINO_API}/v1/me`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((me: { balance: number } | null) => {
        if (me) setBalance(me.balance);
      })
      .catch(() => {});
  }, [accessToken]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  // Friends in the casino lobby see which machine you are at.
  const machine = pathname.match(/^\/m\/([a-z]+)/)?.[1] ?? null;
  useEffect(() => {
    const ping = () =>
      fetch(`${CASINO_API}/v1/presence`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ where: "slots", table: machine }),
        keepalive: true,
      }).catch(() => {});
    void ping();
    const timer = window.setInterval(ping, 30_000);
    return () => window.clearInterval(timer);
  }, [accessToken, machine]);

  return <WalletContext.Provider value={{ balance, refresh, setBalance }}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
