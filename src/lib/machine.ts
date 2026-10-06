import type { MachineState, SpinResponse } from "../../shared/protocol";

export const MACHINE_API = process.env.NEXT_PUBLIC_MACHINE_API || "https://planary-slots.planary.workers.dev";

/**
 * Talking to the machine room.
 *
 * Every call carries the Planary access token, and the worker decides from it
 * which player's object to open — so there is no player id in any of these
 * requests to get wrong or to tamper with.
 */

async function call<T>(path: string, token: string, init?: RequestInit): Promise<T | { error: string; balance?: number }> {
  try {
    const res = await fetch(`${MACHINE_API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as T | { error: string } | null;
    if (!body) return { error: "The machine room gave an answer nobody could read." };
    return body;
  } catch {
    return { error: "The machine room is not answering. Check your connection." };
  }
}

export function fetchState(machine: string, token: string) {
  return call<MachineState>(`/v1/state?machine=${encodeURIComponent(machine)}`, token);
}

/**
 * One spin.
 *
 * `key` makes a retry the same spin rather than another one: if the answer is
 * lost on the way back, asking again with the same key returns the spin that
 * already happened instead of staking a second time.
 */
export function requestSpin(machine: string, lineBet: number, token: string, key: string) {
  return call<SpinResponse>("/v1/spin", token, { method: "POST", body: JSON.stringify({ machine, lineBet, key }) });
}

export function saveSeed(clientSeed: string, token: string) {
  return call<{ clientSeed: string }>("/v1/seed", token, { method: "POST", body: JSON.stringify({ clientSeed }) });
}

export function newSpinKey() {
  return crypto.randomUUID();
}
