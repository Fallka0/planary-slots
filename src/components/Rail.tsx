"use client";

import { formatChips } from "../../shared/slots";
import type { Tally } from "../../shared/protocol";

/**
 * The last two dozen spins on this machine.
 *
 * Only what actually happened: no running total dressed up as a trend, and no
 * streak counter, because a machine has no memory and pretending otherwise is
 * the oldest lie in the room. Each entry is a spin and what it returned.
 */
export function Rail({ history }: { history: Tally[] }) {
  if (history.length === 0) {
    return (
      <section className="panel rail-panel" aria-labelledby="rail-title">
        <h2 id="rail-title" className="poster panel-title">
          This session
        </h2>
        <p className="rail-empty">Nothing yet. Your spins will show up here as you take them.</p>
      </section>
    );
  }

  const staked = history.reduce((sum, spin) => sum + spin.staked, 0);
  const returned = history.reduce((sum, spin) => sum + spin.returned, 0);
  const net = returned - staked;

  return (
    <section className="panel rail-panel" aria-labelledby="rail-title">
      <h2 id="rail-title" className="poster panel-title">
        This session
      </h2>
      <ul className="rail">
        {history.map((spin) => (
          <li key={spin.nonce} data-won={spin.returned > 0 || undefined}>
            <span className="rail-nonce num">#{spin.nonce}</span>
            <span className="rail-outcome">{spin.outcome}</span>
            <span className="rail-amount num">
              {spin.returned > 0 ? `+${formatChips(spin.returned)}` : spin.free ? "free" : `−${formatChips(spin.staked)}`}
            </span>
          </li>
        ))}
      </ul>
      <p className="rail-sum">
        <span>
          {history.length} spin{history.length === 1 ? "" : "s"}, {formatChips(staked)} staked
        </span>
        <strong className="num" data-up={net > 0 || undefined} data-down={net < 0 || undefined}>
          {net > 0 ? "+" : net < 0 ? "−" : ""}
          {formatChips(Math.abs(net))}
        </strong>
      </p>
    </section>
  );
}
