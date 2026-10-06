/**
 * What the machine and the browser say to each other.
 *
 * Shared by both sides so neither can drift. The browser is told what it needs
 * to draw and nothing it could use to see a spin coming: the committed hash,
 * never the seed behind it.
 */

import type { BonusPlay, LineWin, MachineId, Pip, ScatterWin } from "./slots";

export const VERIFY_URL = "https://casino.planary.ch/verify";

/** Where chips come from and go back to, for everything but the spin itself. */
export const CASINO_URL = "https://casino.planary.ch";

/** The least time between two spins. A machine is not a stress test. */
export const SPIN_COOLDOWN_MS = 250;

/** How many results the rail remembers, per machine. */
export const HISTORY_LENGTH = 30;

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

/**
 * Everything the browser is told about a finished round.
 *
 * A round is the spin and the whole bonus game it started, if any: the free
 * spins, the respins, the wheel. All of it came out of one commitment, so all
 * of it arrives at once, and the screen then plays it out in order.
 */
export interface SpinReport {
  machine: MachineId;
  version: number;
  nonce: number;
  /** The bonus was bought: the reels did not turn, and `stops` and `window` are null. */
  bought: boolean;
  stops: number[] | null;
  window: Pip[][] | null;
  lines: LineWin[];
  scatter: ScatterWin | null;
  /** Reels a wild filled. */
  expanded: number[];
  /** What the reels paid, before the bonus game. */
  basePays: number;
  bonus: BonusPlay | null;
  staked: number;
  /** Everything paid back, the bonus game included. */
  returned: number;
  /** One line a person can read: "Three novas · 12 free spins". */
  outcome: string;
  /** The seed is in here, because by now the round is over. */
  proof: { hash: string; serverSeed: string; clientSeed: string; nonce: number };
  /** The archived round, once the casino has filed it. */
  roundId: string | null;
}

/** A round as the history remembers it. */
export interface Tally {
  nonce: number;
  staked: number;
  returned: number;
  /** A free spin the version-1 machine still owed, settled when it was replaced. */
  free: boolean;
  bought?: boolean;
  /** Which bonus game this round played, if any. */
  bonus?: BonusPlay["kind"] | null;
  outcome: string;
  /** Where to check it, once the casino has filed it. */
  roundId?: string | null;
  at?: number;
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
  history: Tally[];
  /**
   * Chips, as the casino last reported them — null when it has not answered
   * yet. Never 0 as a stand-in for "unknown": a wallet the machine cannot
   * reach would otherwise read on screen as a player with nothing, which is a
   * different and much more alarming thing than a machine that is offline.
   */
  balance: number | null;
  /**
   * Free spins the version-1 machine still owed when it was replaced, and what
   * they paid when the machine settled them. Shown once, then cleared.
   */
  settled: { spins: number; returned: number } | null;
}

export interface SpinResponse {
  spin: SpinReport;
  state: MachineState;
  balance: number | null;
}

export interface Refusal {
  error: string;
  /** Present when the wallet is the one refusing, so the balance can still be shown. */
  balance?: number;
}

export function isRefusal(value: unknown): value is Refusal {
  return typeof value === "object" && value !== null && typeof (value as Refusal).error === "string";
}
