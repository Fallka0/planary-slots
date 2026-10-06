import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";
import { commit, newServerSeed, sanitiseClientSeed } from "../shared/fair";
import { describe, type Machine as Cabinet, machineById, type MachineId, payOut, stopsFor, windowAt } from "../shared/slots";
import { HISTORY_LENGTH, type MachineState, SPIN_COOLDOWN_MS, type SpinReport, type Tally } from "../shared/protocol";

/**
 * One player's machine room.
 *
 * There is a Durable Object per Planary account, and it is the only thing in
 * the building that knows where the reels will stop. A browser cannot be
 * trusted with that for the obvious reason, and it cannot be trusted with the
 * stake either, so both live here: the object draws the seed, publishes only
 * its hash, takes the chips through the casino wallet, resolves the spin, pays
 * what is owed, files the round and then publishes the seed.
 *
 * ── Why the commitment is drawn in advance ──────────────────────────
 * The seed for the *next* spin is drawn and committed as soon as the previous
 * one resolves, so the hash is already on screen when the player decides to
 * press. That ordering is the promise: the house fixed the outcome before it
 * knew whether anyone would stake on it, and the player chose after seeing the
 * commitment but before seeing the seed. Neither side can steer the result.
 *
 * ── Why every spin is its own commitment ────────────────────────────
 * The usual arrangement for a machine is one seed per session with a counter,
 * revealed when the player asks for a new seed — which means a player who
 * never asks can never check a single spin. Here the seed is published the
 * instant the spin is over, so every spin is checkable immediately and
 * unconditionally, and a round in the archive is the same shape as a roulette
 * spin or a blackjack shoe.
 */

interface Session {
  /** The player's standing seed, folded into every spin they take. */
  clientSeed: string;
  /** Per machine: spins played, the armed commitment, free spins owing, the rail. */
  machines: Record<string, Reel | undefined>;
  balance: number;
  /** False until the casino wallet has actually answered about this player. */
  walletKnown: boolean;
  /** Idempotency: the last spin, and the key the browser sent with it. */
  lastKey: string | null;
  lastReport: SpinReport | null;
  lastSpinAt: number;
}

interface Reel {
  spins: number;
  armed: { serverSeed: string; hash: string; nonce: number; commitmentId: string | null } | null;
  freeSpins: number;
  freeSpinBet: number;
  history: Tally[];
}

const BLANK: Session = { clientSeed: "", machines: {}, balance: 0, walletKnown: false, lastKey: null, lastReport: null, lastSpinAt: 0 };

function freshReel(): Reel {
  return { spins: 0, armed: null, freeSpins: 0, freeSpinBet: 0, history: [] };
}

export class Machine extends DurableObject<Env> {
  session: Session = { ...BLANK, machines: {} };
  /** Seed draws in flight, one per machine, so concurrent requests share them. */
  arming = new Map<string, Promise<void>>();
  /** The player this object belongs to, learnt from the first request. */
  userId = "";
  name = "Player";

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Nothing may be served until what is on disk is in hand: an armed
    // commitment that got lost would be a spin nobody could check.
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<Session>("session");
      if (stored) this.session = { ...BLANK, ...stored, machines: stored.machines ?? {} };
      this.userId = (await ctx.storage.get<string>("userId")) ?? "";
    });
  }

  async save() {
    await this.ctx.storage.put("session", this.session);
  }

  // ── The casino ────────────────────────────────

  async casino<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await this.env.CASINO.fetch(
      new Request(`https://casino.internal${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-key": this.env.INTERNAL_KEY },
        body: JSON.stringify(body),
      }),
    );
    if (!res.ok) throw new Error(`casino ${path} → ${res.status}`);
    return res.json<T>();
  }

  /** Who this is, and what they have. Also where the account restrictions arrive. */
  async open(userId: string, name: string): Promise<{ blocked: string | null }> {
    if (this.userId !== userId) {
      this.userId = userId;
      await this.ctx.storage.put("userId", userId);
    }
    this.name = name;
    try {
      const res = await this.casino<{ balance: number; blocked: string | null }>("/internal/wallet", { userId, name });
      this.session.balance = res.balance;
      this.session.walletKnown = true;
      return { blocked: res.blocked ?? null };
    } catch {
      return { blocked: null };
    }
  }

  // ── Commitments ───────────────────────────────

  reelFor(id: MachineId): Reel {
    const reel = this.session.machines[id] ?? freshReel();
    this.session.machines[id] = reel;
    return reel;
  }

  /**
   * Draws the seed for the next spin on this machine and publishes its hash.
   *
   * Two requests arriving together must not each draw a seed — the second
   * would overwrite the first, and a commitment a player had already seen the
   * hash of would quietly become a different one. So a draw in flight is
   * shared rather than repeated.
   */
  async arm(cabinet: Cabinet): Promise<void> {
    const reel = this.reelFor(cabinet.id);
    if (reel.armed) return;
    const inFlight = this.arming.get(cabinet.id);
    if (inFlight) return inFlight;
    const job = this.draw(cabinet).finally(() => this.arming.delete(cabinet.id));
    this.arming.set(cabinet.id, job);
    return job;
  }

  /**
   * The seed never leaves this object until the spin it belongs to is over.
   * Filing the commitment with the casino can fail — the API may be down —
   * and that must not stop a player spinning, so the round carries the
   * commitment inline when there is no id to point at.
   */
  async draw(cabinet: Cabinet): Promise<void> {
    const reel = this.reelFor(cabinet.id);
    const serverSeed = newServerSeed();
    const hash = await commit(serverSeed);
    const nonce = reel.spins + 1;
    // A spin claimed while the seed was being hashed keeps its own commitment.
    if (reel.armed) return;
    reel.armed = { serverSeed, hash, nonce, commitmentId: null };
    await this.save();

    try {
      const filed = await this.casino<{ id: string }>("/internal/commitments", {
        game: "slots",
        tableId: cabinet.id,
        kind: "spin",
        hash,
        clientSeed: "",
        nonce,
      });
      // Only if this is still the same armed spin: a slow API must not
      // attach an id to a commitment that has since been played.
      if (reel.armed?.hash === hash) {
        reel.armed.commitmentId = filed.id;
        await this.save();
      }
    } catch (error) {
      console.error("commitment not filed", error);
    }
  }

  // ── A spin ────────────────────────────────────

  /**
   * One pull of the lever.
   *
   * The order is not negotiable: commit (already done), take the stake,
   * resolve, pay, publish the seed. A spin that cannot be paid for never
   * happens, and a spin that happens is always published.
   */
  async spin(machineId: string, lineBet: number, key: string | null): Promise<{ report: SpinReport } | { error: string }> {
    const cabinet = machineById(machineId);
    if (!cabinet) return { error: "No such machine." };

    // A retried request is the same spin, not another one.
    if (key && key === this.session.lastKey && this.session.lastReport) return { report: this.session.lastReport };

    const since = Date.now() - this.session.lastSpinAt;
    if (since < SPIN_COOLDOWN_MS) return { error: "One at a time." };

    const reel = this.reelFor(cabinet.id);
    const free = reel.freeSpins > 0;
    // A free spin is played at the stake that won it, so the house cannot be
    // handed a bigger bill than the one it agreed to.
    const bet = free ? reel.freeSpinBet : lineBet;
    if (!cabinet.lineBets.includes(bet)) return { error: "That is not a stake this machine takes." };

    if (!reel.armed) await this.arm(cabinet);
    const armed = reel.armed;
    if (!armed) return { error: "The machine is still drawing its seed. Try again." };

    // Claimed here, with nothing awaited in between: two requests that arrive
    // together must not play the same commitment twice, which would file two
    // rounds against one promise and try to publish one seed twice.
    reel.armed = null;
    this.session.lastSpinAt = Date.now();
    if (free) reel.freeSpins -= 1;

    const totalBet = bet * cabinet.lines.length;
    if (!free) {
      let taken: { ok?: boolean; balance: number; reason?: string };
      try {
        taken = await this.casino<{ ok?: boolean; balance: number; reason?: string }>("/internal/debit", {
          userId: this.userId,
          amount: totalBet,
          game: "slots",
          ref: cabinet.id,
        });
      } catch {
        // Nothing was staked and nothing was published, so the commitment goes
        // back on the hook with the same hash the player is already looking at.
        reel.armed = armed;
        return { error: "Chips are unavailable right now. Try again in a moment." };
      }
      this.session.balance = taken.balance;
      this.session.walletKnown = true;
      if (!taken.ok) {
        reel.armed = armed;
        return { error: taken.reason ?? "Not enough chips for that stake." };
      }
    }

    const startedAt = Date.now();
    const clientSeed = this.session.clientSeed;
    const stops = await stopsFor(cabinet, armed.serverSeed, clientSeed, armed.nonce);
    const window = windowAt(cabinet, stops);
    const result = payOut(cabinet, window, bet, free);

    if (result.returned > 0) {
      try {
        const paid = await this.casino<{ balance: number }>("/internal/credit", {
          userId: this.userId,
          amount: result.returned,
          game: "slots",
          ref: cabinet.id,
        });
        this.session.balance = paid.balance;
        this.session.walletKnown = true;
      } catch (error) {
        // The spin stands and the player is owed: louder than a thrown error,
        // because a dropped payout has to be findable in the logs.
        console.error("payout failed", this.userId, cabinet.id, armed.nonce, result.returned, error);
      }
    }

    // The free spin that paid for this one was spent when it was claimed.
    reel.freeSpins += result.freeSpins;
    if (result.freeSpins > 0 && !free) reel.freeSpinBet = bet;
    if (reel.freeSpins === 0) reel.freeSpinBet = 0;

    reel.spins = armed.nonce;
    const outcome = describe(cabinet, result);
    const report: SpinReport = {
      machine: cabinet.id,
      version: cabinet.version,
      nonce: armed.nonce,
      stops,
      window,
      lines: result.lines,
      scatter: result.scatter,
      staked: result.staked,
      returned: result.returned,
      free,
      freeSpinsLeft: reel.freeSpins,
      outcome,
      // The seed goes out with the result, because the spin is over.
      proof: { hash: armed.hash, serverSeed: armed.serverSeed, clientSeed, nonce: armed.nonce },
      roundId: null,
    };

    reel.history = [{ nonce: armed.nonce, staked: result.staked, returned: result.returned, free, outcome }, ...reel.history].slice(0, HISTORY_LENGTH);
    const spent = armed;
    reel.armed = null;
    this.session.lastKey = key;
    this.session.lastReport = report;
    await this.save();

    // Filing the round, publishing the seed and drawing the next commitment
    // all happen after the player has their result. None of them can change
    // what just happened, and none of them should make anybody wait.
    this.ctx.waitUntil(
      (async () => {
        await this.file(cabinet, spent, clientSeed, report, startedAt, bet);
        await this.arm(cabinet);
      })(),
    );

    return { report };
  }

  /** Files the spin, then opens the commitment behind it — in that order. */
  async file(
    cabinet: Cabinet,
    spent: { serverSeed: string; hash: string; nonce: number; commitmentId: string | null },
    clientSeed: string,
    report: SpinReport,
    startedAt: number,
    lineBet: number,
  ) {
    try {
      const filed = await this.casino<{ id: string }>("/internal/archive", {
        game: "slots",
        tableId: cabinet.id,
        commitmentId: spent.commitmentId ?? undefined,
        commitment: spent.commitmentId
          ? undefined
          : { game: "slots", tableId: cabinet.id, kind: "spin", hash: spent.hash, clientSeed, nonce: spent.nonce },
        startedAt,
        endedAt: Date.now(),
        outcome: report.outcome,
        // Enough to redraw the screen and recheck the sum without asking us
        // anything: the machine, the version of its strips, and where it stopped.
        log: {
          game: "slots",
          machine: cabinet.id,
          version: cabinet.version,
          spin: spent.nonce,
          stops: report.stops,
          lineBet,
          free: report.free,
          rtp: cabinet.rtp,
        },
        players: [
          {
            userId: this.userId,
            staked: report.staked,
            returned: report.returned,
            detail: { lines: report.lines, scatter: report.scatter, free: report.free, freeSpinsWon: report.scatter?.freeSpins ?? 0 },
          },
        ],
      });
      if (this.session.lastReport?.nonce === spent.nonce && this.session.lastReport.machine === cabinet.id) {
        this.session.lastReport.roundId = filed.id;
        await this.save();
      }
    } catch (error) {
      console.error("round not archived", error);
    }

    if (spent.commitmentId) {
      // Sealing the player's seed and publishing the server seed: the two
      // halves of the promise, written down in the order they were made.
      await this.casino(`/internal/commitments/${spent.commitmentId}/seal`, { clientSeed }).catch((error) => console.error("seal failed", error));
      await this.casino(`/internal/commitments/${spent.commitmentId}/reveal`, { serverSeed: spent.serverSeed }).catch((error) =>
        console.error("reveal failed", error),
      );
    }
  }

  // ── The rest of the panel ─────────────────────

  /**
   * Sets the seed the player contributes.
   *
   * Taken at any time, and it applies from the next spin on. It cannot change
   * a spin already armed into something the player has seen the hash of —
   * the hash commits the house's half, this commits theirs, and the two are
   * chosen in that order on purpose.
   */
  async setSeed(value: string): Promise<string> {
    this.session.clientSeed = sanitiseClientSeed(value);
    await this.save();
    return this.session.clientSeed;
  }

  async state(machineId: string): Promise<MachineState | { error: string }> {
    const cabinet = machineById(machineId);
    if (!cabinet) return { error: "No such machine." };
    await this.arm(cabinet);
    const reel = this.reelFor(cabinet.id);
    return {
      machine: cabinet.id,
      spins: reel.spins,
      armed: reel.armed ? { hash: reel.armed.hash, nonce: reel.armed.nonce } : null,
      clientSeed: this.session.clientSeed,
      freeSpins: reel.freeSpins,
      freeSpinBet: reel.freeSpinBet,
      history: reel.history,
      balance: this.session.walletKnown ? this.session.balance : null,
    };
  }
}
