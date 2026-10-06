"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatChips, type Machine, oddsOf, type Pip as PipId } from "../../shared/slots";
import { Pip, PIP_NAMES } from "./Pip";

/**
 * The paytable, with the odds on it.
 *
 * A machine's paytable normally tells you what a combination pays and never
 * how often it lands, which is precisely the half that matters. Both halves
 * are here, worked out from the strips in shared/slots.ts at the moment this
 * renders — so the column on the right is not marketing copy, it is the same
 * arithmetic the game runs on, and `npm run rtp` checks it against every
 * window the machine can show.
 */
export function Paytable({ cabinet, lineBet }: { cabinet: Machine; lineBet: number }) {
  const [open, setOpen] = useState(true);
  const odds = useMemo(() => oddsOf(cabinet), [cabinet]);

  /** Only the run lengths this machine actually pays for get a column. */
  const runs = useMemo(() => {
    const lengths = new Set<number>();
    for (const table of Object.values(cabinet.pays)) table?.forEach((pays, i) => (pays > 0 ? lengths.add(i + 1) : null));
    return [...lengths].sort((a, b) => a - b);
  }, [cabinet.pays]);

  const ladder = useMemo(() => {
    const order: PipId[] = ["seven", "star", "bell", "bar", "cherry"];
    return order.filter((pip) => cabinet.pays[pip]?.some((pays) => pays > 0));
  }, [cabinet.pays]);

  /** How often one line pays this combination, as "once in N". */
  const chanceOf = (pip: PipId, run: number) => odds.bySymbol.find((row) => row.symbol === pip && row.run === run)?.chance ?? 0;

  return (
    <section className={`panel pays${open ? " is-open" : ""}`} aria-labelledby="pays-title">
      <button type="button" className="panel-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <h2 id="pays-title" className="poster">
          Paytable
        </h2>
        <span className="pays-rtp num">{(cabinet.rtp * 100).toFixed(2)}%</span>
        <ChevronDown size={16} className="panel-chevron" aria-hidden="true" />
      </button>

      {open ? (
        <div className="panel-body">
          <table className="pay-grid">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Symbol</span>
                </th>
                {runs.map((run) => (
                  <th scope="col" key={run} className="num">
                    {run}×
                  </th>
                ))}
                <th scope="col" className="pay-odds">
                  Lands
                </th>
              </tr>
            </thead>
            <tbody>
              {ladder.map((pip) => {
                const best = runs[runs.length - 1];
                const chance = chanceOf(pip, best);
                return (
                  <tr key={pip}>
                    <th scope="row">
                      <Pip pip={pip} size={30} ink="var(--paper)" paper="var(--field)" />
                      <span>{PIP_NAMES[pip]}</span>
                    </th>
                    {runs.map((run) => {
                      const pays = cabinet.pays[pip]?.[run - 1] ?? 0;
                      return (
                        <td key={run} className="num">
                          {pays > 0 ? formatChips(pays * lineBet) : <span className="pay-none">·</span>}
                        </td>
                      );
                    })}
                    <td className="num pay-odds">{chance > 0 ? `1 in ${formatChips(Math.round(1 / chance))}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {cabinet.scatter ? (
            <div className="pay-scatter">
              <Pip pip={cabinet.scatter.symbol} size={34} ink="var(--paper)" paper="var(--field)" />
              <div>
                <strong>Chips pay anywhere</strong>
                <p>
                  {cabinet.scatter.pays
                    .map((pays, i) => (pays > 0 ? `${i + 1} chips pay ${pays}× your stake` : null))
                    .filter(Boolean)
                    .join(", ")}
                  . Three or more also win{" "}
                  {cabinet.scatter.freeSpins
                    .map((spins, i) => (spins > 0 ? `${spins} free spins for ${i + 1}` : null))
                    .filter(Boolean)
                    .join(", ")}
                  . A free spin stakes nothing and cannot win more free spins.
                </p>
              </div>
            </div>
          ) : null}

          <dl className="pay-facts">
            <div>
              <dt>Lines</dt>
              <dd className="num">{cabinet.lines.length}</dd>
            </div>
            <div>
              <dt>Stake</dt>
              <dd className="num">
                {formatChips(lineBet)} × {cabinet.lines.length} = {formatChips(lineBet * cabinet.lines.length)}
              </dd>
            </div>
            <div>
              <dt>Pays on</dt>
              <dd className="num">{(cabinet.hitRate * 100).toFixed(1)}% of spins</dd>
            </div>
            <div>
              <dt>Returns</dt>
              <dd className="num">{(cabinet.rtp * 100).toFixed(2)}%</dd>
            </div>
          </dl>

          <p className="pay-note">
            Pays are shown for your current stake. The return above is not an estimate: it is worked out from the reel strips, which are
            published in the open, and checked against every one of the{" "}
            {formatChips(cabinet.reels.reduce((total, reel) => total * reel.length, 1))} windows this machine can show. Over{" "}
            {(cabinet.rtp * 100).toFixed(2)}% back means the house keeps {((1 - cabinet.rtp) * 100).toFixed(2)}% of everything staked, in the
            long run — not on your next spin, and not on your next hundred.
          </p>
        </div>
      ) : null}
    </section>
  );
}
