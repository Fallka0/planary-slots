import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";
import { commit, newServerSeed, open as openStream, sanitiseClientSeed } from "../shared/fair";
import {
  buyPrice,
  describe,
  describeRound,
  type Machine as Cabinet,
  machineById,
  type MachineId,
  machineVersion,
  payOut,
  play,
  stopsFor,
  windowAt,
} from "../shared/slots";
import { HISTORY_LENGTH, type MachineState, SPIN_COOLDOWN_MS, type SpinReport, type Tally } from "../shared/protocol";

/**
 * One player's machine room.
 *
 * There is a Durable Object per Planary account, and it is the only thing in
 * the building that knows where the reels will stop. A browser cannot be
 * trusted with that for the obvious reason, and it cannot be trusted with the
 * stake either, so both live here: the object draws the seed, publishes only
 * its hash, takes the chips through the casino wallet, resolves the round,
 * pays what is owed, files the round and then publishes the seed.
 *
 * ── Why the commitment is drawn in advance ──────────────────────────
 * The seed for the *next* spin is drawn and committed as soon as the previous
 * one resolves, so the hash is already on screen when the player decides to
 * press. That ordering is the promise: the house fixed the outcome before it
 * knew whether anyone would stake on it, and the player chose after seeing the
 * commitment but before seeing the seed. Neither side can steer the result.
 *
 * ── Why a whole bonus game is one round ─────────────────────────────
 * Free spins, respins and the wheel are drawn from the same committed stream
 * as the spin that started them, straight after its reel stops. So a bonus
 * game is fixed by the same promise as the spin — nothing about it is decided
 * later, when the house could know more — and it is filed, paid and checked
 * as one round.
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

interface Armed {
  serverSeed: string;
  hash: string;
  nonce: number;
  commitmentId: string | null;
}

interface Reel {
  spins: number;
  armed: Armed | null;
  /** Version 1 only: free spins still owed, and the line stake they are owed at. */
  freeSpins: number;
  freeSpinBet: number;
  history: Tally[];
  /** What settling the version-1 free spins paid, until the player has seen it. */
  settled?: { spins: number; returned: number } | null;
}

const BLANK: Session = { clientSeed: "", machines: {}, balance: 0, walletKnown: false, lastKey: null, lastReport: null, lastSpinAt: 0 };

function freshReel(): Reel {
  return { spins: 0, armed: null, freeSpins: 0, freeSpinBet: 0, history: [] };
}

export class Machine extends DurableObject<Env> {
  session: Session = { ...BLANK, machines: {} };
  /** Seed draws in flight, one per machine, so concurrent requests share them. */
  arming = new Map<string, Promise<void>>();
  /** Settling old free spins, one run per machine at a time. */
  settling = new Map<string, Promise<void>>();
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
  async arm(id: MachineId): Promise<void> {
    const reel = this.reelFor(id);
    if (reel.armed) return;
    const inFlight = this.arming.get(id);
    if (inFlight) return inFlight;
    const job = this.draw(id).finally(() => this.arming.delete(id));
    this.arming.set(id, job);
    return job;
  }

  /**
   * The seed never leaves this object until the spin it belongs to is over.
   * Filing the commitment with the casino can fail — the API may be down —
   * and that must not stop a player spinning, so the round carries the
   * commitment inline when there is no id to point at.
   */
  async draw(id: MachineId): Promise<void> {
    const reel = this.reelFor(id);
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
        tableId: id,
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

  /** Takes the armed commitment, drawing one first if there isn't one. Null if none could be drawn. */
  async claim(id: MachineId): Promise<Armed | null> {
    const reel = this.reelFor(id);
    if (!reel.armed) await this.arm(id);
    const armed = reel.armed;
    // Claimed here, with nothing awaited in between: two requests that arrive
    // together must not play the same commitment twice, which would file two
    // rounds against one promise and try to publish one seed twice.
    reel.armed = null;
    return armed;
  }

  async credit(amount: number, ref: string, nonce: number): Promise<void> {
    if (amount <= 0) return;
    try {
      const paid = await this.casino<{ balance: number }>("/internal/credit", { userId: this.userId, amount, game: "slots", ref });
      this.session.balance = paid.balance;
      this.session.walletKnown = true;
    } catch (error) {
      // The spin stands and the player is owed: louder than a thrown error,
      // because a dropped payout has to be findable in the logs.
      console.error("payout failed", this.userId, ref, nonce, amount, error);
    }
  }

  // ── A round ───────────────────────────────────

  /**
   * One pull of the lever, or one bought bonus.
   *
   * The order is not negotiable: commit (already done), take the stake,
   * resolve, pay, publish the seed. A round that cannot be paid for never
   * happens, and a round that happens is always published.
   */
  async spin(machineId: string, lineBet: number, key: string | null, buy: boolean): Promise<{ report: SpinReport } | { error: string }> {
    const cabinet = machineById(machineId);
    if (!cabinet) return { error: "No such machine." };

    // A retried request is the same spin, not another one.
    if (key && key === this.session.lastKey && this.session.lastReport) return { report: this.session.lastReport };

    const since = Date.now() - this.session.lastSpinAt;
    if (since < SPIN_COOLDOWN_MS) return { error: "One at a time." };
    if (!cabinet.lineBets.includes(lineBet)) return { error: "That is not a stake this machine takes." };
    if (buy && !cabinet.buy) return { error: "This machine's bonus cannot be bought." };

    // Anything the old machine still owes is paid out before a new round.
    await this.settleLegacy(cabinet.id);

    const reel = this.reelFor(cabinet.id);
    const armed = await this.claim(cabinet.id);
    if (!armed) return { error: "The machine is still drawing its seed. Try again." };
    this.session.lastSpinAt = Date.now();

    const cost = buy ? buyPrice(cabinet, lineBet)! : lineBet * cabinet.lines.length;
    let taken: { ok?: boolean; balance: number; reason?: string };
    try {
      taken = await this.casino<{ ok?: boolean; balance: number; reason?: string }>("/internal/debit", {
        userId: this.userId,
        amount: cost,
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
      return { error: taken.reason ?? (buy ? "Not enough chips to buy the bonus at that stake." : "Not enough chips for that stake.") };
    }

    const startedAt = Date.now();
    const clientSeed = this.session.clientSeed;
    const round = await play(cabinet, openStream(armed.serverSeed, clientSeed, armed.nonce), lineBet, buy);
    await this.credit(round.returned, cabinet.id, armed.nonce);

    reel.spins = armed.nonce;
    const outcome = describeRound(cabinet, round);
    const report: SpinReport = {
      machine: cabinet.id,
      version: cabinet.version,
      nonce: armed.nonce,
      bought: round.bought,
      stops: round.stops,
      window: round.window,
      lines: round.lines,
      scatter: round.scatter,
      expanded: round.expanded,
      basePays: round.basePays,
      bonus: round.bonus,
      staked: round.staked,
      returned: round.returned,
      outcome,
      // The seed goes out with the result, because the round is over.
      proof: { hash: armed.hash, serverSeed: armed.serverSeed, clientSeed, nonce: armed.nonce },
      roundId: null,
    };

    this.remember(reel, {
      nonce: armed.nonce,
      staked: round.staked,
      returned: round.returned,
      free: false,
      bought: round.bought,
      bonus: round.bonus?.kind ?? null,
      outcome,
      roundId: null,
      at: Date.now(),
    });
    this.session.lastKey = key;
    this.session.lastReport = report;
    await this.save();

    // Filing the round, publishing the seed and drawing the next commitment
    // all happen after the player has their result. None of them can change
    // what just happened, and none of them should make anybody wait.
    this.ctx.waitUntil(
      (async () => {
        await this.file(cabinet, armed, clientSeed, report, startedAt, lineBet);
        await this.arm(cabinet.id);
      })(),
    );

    return { report };
  }

  remember(reel: Reel, tally: Tally) {
    reel.history = [tally, ...reel.history].slice(0, HISTORY_LENGTH);
  }

  /** Files the round, then opens the commitment behind it — in that order. */
  async file(cabinet: Cabinet, spent: Armed, clientSeed: string, report: SpinReport, startedAt: number, lineBet: number) {
    try {
      const bonus = report.bonus;
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
        // Enough to replay the whole round without asking us anything: the
        // machine, the version of its strips, the stake, whether the bonus
        // was bought, and where the reels stopped. The bonus game comes out
        // of the same seed, so the verifier redraws it from the proof.
        log: {
          game: "slots",
          machine: cabinet.id,
          version: cabinet.version,
          spin: spent.nonce,
          stops: report.stops,
          lineBet,
          bought: report.bought,
          free: false,
          rtp: cabinet.rtp,
          bonus: bonus
            ? { kind: bonus.kind, pays: bonus.pays, ...(bonus.kind === "free" ? { spins: bonus.spins.length } : { multiple: bonus.multiple }) }
            : null,
        },
        players: [
          {
            userId: this.userId,
            staked: report.staked,
            returned: report.returned,
            detail: { lines: report.lines, scatter: report.scatter, basePays: report.basePays, bonus: bonus?.kind ?? null, bonusPays: bonus?.pays ?? 0 },
          },
        ],
      });
      this.attachRound(cabinet.id, spent.nonce, filed.id);
      await this.save();
    } catch (error) {
      console.error("round not archived", error);
    }
    await this.reveal(spent, clientSeed);
  }

  /** Points the history and the last report at the filed round, so both can link to it. */
  attachRound(id: MachineId, nonce: number, roundId: string) {
    if (this.session.lastReport?.nonce === nonce && this.session.lastReport.machine === id) this.session.lastReport.roundId = roundId;
    const tally = this.reelFor(id).history.find((t) => t.nonce === nonce);
    if (tally) tally.roundId = roundId;
  }

  /** Sealing the player's seed and publishing the server seed: the two halves of the promise, in the order they were made. */
  async reveal(spent: Armed, clientSeed: string) {
    if (!spent.commitmentId) return;
    await this.casino(`/internal/commitments/${spent.commitmentId}/seal`, { clientSeed }).catch((error) => console.error("seal failed", error));
    await this.casino(`/internal/commitments/${spent.commitmentId}/reveal`, { serverSeed: spent.serverSeed }).catch((error) =>
      console.error("reveal failed", error),
    );
  }

  // ── Version 1's free spins ────────────────────

  /**
   * Plays out any free spins the version-1 machine still owed.
   *
   * They were won on that machine, so they are played on it: each one draws
   * its own commitment, exactly as it would have, is checked against the
   * version-1 strips, pays at the stake that won it, and is filed and
   * published like any other spin. Then the machine moves on.
   */
  async settleLegacy(id: MachineId): Promise<void> {
    const reel = this.reelFor(id);
    if (reel.freeSpins <= 0) return;
    const inFlight = this.settling.get(id);
    if (inFlight) return inFlight;
    const job = this.playLegacy(id).finally(() => this.settling.delete(id));
    this.settling.set(id, job);
    return job;
  }

  async playLegacy(id: MachineId): Promise<void> {
    const reel = this.reelFor(id);
    const old = machineVersion(id, 1);
    if (!old || !old.lineBets.includes(reel.freeSpinBet)) {
      console.error("legacy free spins could not be settled", this.userId, id, reel.freeSpins, reel.freeSpinBet);
      reel.freeSpins = 0;
      reel.freeSpinBet = 0;
      await this.save();
      return;
    }
    let spins = 0;
    let returned = 0;
    while (reel.freeSpins > 0) {
      const armed = await this.claim(id);
      if (!armed) break;
      reel.freeSpins -= 1;
      const startedAt = Date.now();
      const clientSeed = this.session.clientSeed;
      const stops = await stopsFor(old, armed.serverSeed, clientSeed, armed.nonce);
      const window = windowAt(old, stops);
      const result = payOut(old, window, reel.freeSpinBet, true);
      await this.credit(result.returned, id, armed.nonce);
      reel.spins = armed.nonce;
      spins += 1;
      returned += result.returned;
      const outcome = `Free spin from ${old.name}: ${describe(old, result)}`;
      this.remember(reel, { nonce: armed.nonce, staked: 0, returned: result.returned, free: true, outcome, roundId: null, at: Date.now() });
      await this.save();
      try {
        const filed = await this.casino<{ id: string }>("/internal/archive", {
          game: "slots",
          tableId: id,
          commitmentId: armed.commitmentId ?? undefined,
          commitment: armed.commitmentId ? undefined : { game: "slots", tableId: id, kind: "spin", hash: armed.hash, clientSeed, nonce: armed.nonce },
          startedAt,
          endedAt: Date.now(),
          outcome,
          log: { game: "slots", machine: id, version: 1, spin: armed.nonce, stops, lineBet: reel.freeSpinBet, free: true, rtp: old.rtp },
          players: [{ userId: this.userId, staked: 0, returned: result.returned, detail: { lines: result.lines, scatter: result.scatter, free: true } }],
        });
        this.attachRound(id, armed.nonce, filed.id);
      } catch (error) {
        console.error("legacy round not archived", error);
      }
      await this.reveal(armed, clientSeed);
    }
    if (reel.freeSpins === 0) reel.freeSpinBet = 0;
    reel.settled = { spins, returned };
    await this.save();
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
    await this.settleLegacy(cabinet.id);
    await this.arm(cabinet.id);
    const reel = this.reelFor(cabinet.id);
    const settled = reel.settled ?? null;
    if (settled) {
      // Told once; the history keeps the spins themselves.
      reel.settled = null;
      await this.save();
    }
    return {
      machine: cabinet.id,
      spins: reel.spins,
      armed: reel.armed ? { hash: reel.armed.hash, nonce: reel.armed.nonce } : null,
      clientSeed: this.session.clientSeed,
      history: reel.history,
      balance: this.session.walletKnown ? this.session.balance : null,
      settled,
    };
  }
}
