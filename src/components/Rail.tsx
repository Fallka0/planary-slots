"use client";

import { ExternalLink } from "lucide-react";
import { formatChips } from "../../shared/slots";
import { type Tally, VERIFY_URL } from "../../shared/protocol";

const BONUS_TAG = { wheel: "Wheel", hold: "Hold & Win", free: "Free spins" } as const;

function clock(at: number | undefined) {
  if (!at) return "";
  return new Date(at).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
}

/**
 * The win history: the last rounds on this machine.
 *
 * Only what actually happened: no running total dressed up as a trend, and no
 * streak counter, because a machine has no memory and pretending otherwise is
 * the oldest lie in the room. Each entry is a round, what it cost, what it
 * returned, and a link that hands it to the casino's verifier.
 */
export function Rail({ history }: { history: Tally[] }) {
  if (history.length === 0) {
    return (
      <section className="panel rail-panel" aria-labelledby="rail-title">
        <h2 id="rail-title" className="poster panel-title">
          History
        </h2>
        <p className="rail-empty">Nothing yet. Your rounds will show up here as you play them, each with a link to check it.</p>
      </section>
    );
  }

  const staked = history.reduce((sum, spin) => sum + spin.staked, 0);
  const returned = history.reduce((sum, spin) => sum + spin.returned, 0);
  const net = returned - staked;
  const best = history.reduce((top, spin) => (spin.returned > top ? spin.returned : top), 0);

  return (
    <section className="panel rail-panel" aria-labelledby="rail-title">
      <h2 id="rail-title" className="poster panel-title">
        History
      </h2>
      <ul className="rail">
        {history.map((spin) => (
          <li key={`${spin.nonce}-${spin.free}`} data-won={spin.returned > 0 || undefined} data-best={(best > 0 && spin.returned === best) || undefined}>
            <span className="rail-nonce num">#{spin.nonce}</span>
            <span className="rail-outcome">
              {spin.bonus ? <em className="rail-tag">{BONUS_TAG[spin.bonus]}</em> : null}
              {spin.bought ? <em className="rail-tag is-bought">Bought</em> : null}
              {spin.free ? <em className="rail-tag">Owed</em> : null}
              <span className="rail-words">{spin.outcome}</span>
            </span>
            <span className="rail-money num">
              <span className="rail-staked">{spin.staked ? `−${formatChips(spin.staked)}` : "free"}</span>
              <span className="rail-amount">{spin.returned > 0 ? `+${formatChips(spin.returned)}` : "·"}</span>
            </span>
            <span className="rail-when num">{clock(spin.at)}</span>
            {spin.roundId ? (
              <a className="rail-check" href={`${VERIFY_URL}?round=${encodeURIComponent(spin.roundId)}`} target="_blank" rel="noreferrer" aria-label={`Check round ${spin.nonce}`}>
                <ExternalLink size={13} aria-hidden="true" />
              </a>
            ) : (
              <span className="rail-check is-pending" title="Being filed" aria-hidden="true" />
            )}
          </li>
        ))}
      </ul>
      <p className="rail-sum">
        <span>
          {history.length} round{history.length === 1 ? "" : "s"}, {formatChips(staked)} staked, best {formatChips(best)}
        </span>
        <strong className="num" data-up={net > 0 || undefined} data-down={net < 0 || undefined}>
          {net > 0 ? "+" : net < 0 ? "−" : ""}
          {formatChips(Math.abs(net))}
        </strong>
      </p>
    </section>
  );
}
