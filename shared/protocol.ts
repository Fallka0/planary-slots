/**
 * What the machine and the browser say to each other.
 *
 * Shared by both sides so neither can drift. The browser is told what it needs
 * to draw and nothing it could use to see a spin coming: the committed hash,
 * never the seed behind it.
 */

import type { MachineId, Pip, ScatterWin, LineWin } from "./slots";

export const VERIFY_URL = "https://casino.planary.ch/verify";

/** Where chips come from and go back to, for everything but the spin itself. */
export const CASINO_URL = "https://casino.planary.ch";

/** The least time between two spins. A machine is not a stress test. */
export const SPIN_COOLDOWN_MS = 250;

/** How many results the rail remembers, per machine. */
export const HISTORY_LENGTH = 24;

/** The longest autoplay run the machine will accept in one go. */
export const MAX_AUTO_SPINS = 100;

/**
 * A spin the machine has drawn a seed for but not yet played.
 *
 * The hash is on screen before the lever moves, which is the whole point: the
 * outcome was fixed before the player chose to stake anything, and the seed
 * that proves it is published the moment the spin resolves.
 */
export interface Armed {
  hash: string;
  /** The spin number this commitment is for. */
  nonce: number;
}

/** Everything the browser is told about a finished spin. */
export interface SpinReport {
  machine: MachineId;
  version: number;
  nonce: number;
  stops: number[];
  window: Pip[][];
  lines: LineWin[];
  scatter: ScatterWin | null;
  staked: number;
  returned: number;
  /** True when the house paid for this one. */
  free: boolean;
  /** Free spins left after this one, including any just awarded. */
  freeSpinsLeft: number;
  /** One line a person can read: "Three sevens". */
  outcome: string;
  /** The seed is in here, because by now the spin is over. */
  proof: { hash: string; serverSeed: string; clientSeed: string; nonce: number };
  /** The archived round, once the casino has filed it. */
  roundId: string | null;
}

/** A spin as the rail remembers it. */
export interface Tally {
  nonce: number;
  staked: number;
  returned: number;
  free: boolean;
  outcome: string;
}

/** The machine as the browser sees it between spins. */
export interface MachineState {
  machine: MachineId;
  /** Spins played on this machine by this player. */
  spins: number;
  /** The commitment for the next spin. Null only while one is being drawn. */
  armed: Armed | null;
  /** The player's standing seed, folded into every spin they take. */
  clientSeed: string;
  /** Free spins waiting, and the stake they will be played at. */
  freeSpins: number;
  freeSpinBet: number;
  history: Tally[];
  /** Chips, as the casino last reported them. */
  balance: number;
}

export interface SpinResponse {
  spin: SpinReport;
  state: MachineState;
  balance: number;
}

export interface Refusal {
  error: string;
  /** Present when the wallet is the one refusing, so the balance can still be shown. */
  balance?: number;
}

export function isRefusal(value: unknown): value is Refusal {
  return typeof value === "object" && value !== null && typeof (value as Refusal).error === "string";
}
